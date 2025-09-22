"""Token counting utilities for managing context windows"""

import tiktoken
from typing import List, Dict, Optional


class TokenCounter:
    """Count tokens for OpenAI models"""

    def __init__(self, model: str = "gpt-4"):
        """
        Initialize token counter

        Args:
            model: Model name for encoding
        """
        try:
            self.encoder = tiktoken.encoding_for_model(model)
        except KeyError:
            # Default to cl100k_base encoding
            self.encoder = tiktoken.get_encoding("cl100k_base")

    def count_tokens(self, text: str) -> int:
        """
        Count tokens in a text string

        Args:
            text: Text to count tokens for

        Returns:
            Number of tokens
        """
        return len(self.encoder.encode(text))

    def count_messages_tokens(self, messages: List[Dict[str, str]]) -> int:
        """
        Count tokens in a list of messages

        Args:
            messages: List of message dictionaries with 'role' and 'content'

        Returns:
            Total token count
        """
        total = 0
        for message in messages:
            # Each message has overhead tokens for formatting
            total += 4  # <im_start>, role, <im_sep>, <im_end>
            total += self.count_tokens(message.get("role", ""))
            total += self.count_tokens(message.get("content", ""))

        total += 2  # <im_start> assistant <im_sep>
        return total

    def truncate_to_token_limit(
        self,
        text: str,
        max_tokens: int,
        truncation_message: Optional[str] = None
    ) -> str:
        """
        Truncate text to fit within token limit

        Args:
            text: Text to truncate
            max_tokens: Maximum number of tokens
            truncation_message: Optional message to append when truncated

        Returns:
            Truncated text
        """
        tokens = self.encoder.encode(text)

        if len(tokens) <= max_tokens:
            return text

        # Reserve tokens for truncation message if provided
        reserved_tokens = 0
        if truncation_message:
            reserved_tokens = self.count_tokens(truncation_message)

        # Truncate tokens
        truncated_tokens = tokens[:max_tokens - reserved_tokens]
        truncated_text = self.encoder.decode(truncated_tokens)

        # Add truncation message
        if truncation_message:
            truncated_text += truncation_message

        return truncated_text

    def optimize_conversation_history(
        self,
        messages: List[Dict[str, str]],
        max_tokens: int,
        keep_system: bool = True,
        keep_last_user: bool = True
    ) -> List[Dict[str, str]]:
        """
        Optimize conversation history to fit within token limit

        Args:
            messages: List of messages
            max_tokens: Maximum token budget
            keep_system: Whether to preserve system message
            keep_last_user: Whether to preserve last user message

        Returns:
            Optimized message list
        """
        if not messages:
            return []

        # Separate messages by type
        system_messages = [m for m in messages if m.get("role") == "system"]
        user_messages = [m for m in messages if m.get("role") == "user"]
        assistant_messages = [m for m in messages if m.get("role") == "assistant"]

        optimized = []
        used_tokens = 0

        # Add system message if requested
        if keep_system and system_messages:
            system_msg = system_messages[0]
            system_tokens = self.count_tokens(system_msg["content"]) + 4
            if used_tokens + system_tokens <= max_tokens:
                optimized.append(system_msg)
                used_tokens += system_tokens

        # Add last user message if requested
        if keep_last_user and user_messages:
            last_user = user_messages[-1]
            user_tokens = self.count_tokens(last_user["content"]) + 4
            if used_tokens + user_tokens <= max_tokens:
                optimized.append(last_user)
                used_tokens += user_tokens

        # Add recent conversation turns
        conversation_pairs = []
        for i in range(len(messages) - 1, -1, -1):
            if messages[i].get("role") in ["user", "assistant"]:
                msg_tokens = self.count_tokens(messages[i]["content"]) + 4
                if used_tokens + msg_tokens <= max_tokens:
                    conversation_pairs.insert(0, messages[i])
                    used_tokens += msg_tokens
                else:
                    break

        # Combine all messages in proper order
        final_messages = []
        if keep_system and system_messages and optimized:
            final_messages.append(optimized[0])

        final_messages.extend(conversation_pairs)

        if keep_last_user and not any(m.get("role") == "user" for m in conversation_pairs):
            if len(optimized) > 1:
                final_messages.append(optimized[-1])

        return final_messages

    def estimate_completion_tokens(self, prompt_tokens: int, max_tokens: int) -> Dict[str, int]:
        """
        Estimate token usage for a completion

        Args:
            prompt_tokens: Number of tokens in prompt
            max_tokens: Maximum tokens for completion

        Returns:
            Dictionary with token estimates
        """
        return {
            "prompt_tokens": prompt_tokens,
            "max_completion_tokens": max_tokens,
            "total_max_tokens": prompt_tokens + max_tokens,
            "gpt5_context_limit": 8192,
            "gpt5_mini_context_limit": 4096,
            "gpt5_nano_context_limit": 2048,
            "recommended_model": self._recommend_model_by_tokens(prompt_tokens + max_tokens)
        }

    def _recommend_model_by_tokens(self, total_tokens: int) -> str:
        """Recommend a model based on token count"""
        if total_tokens <= 1024:
            return "gpt-5-nano"
        elif total_tokens <= 2048:
            return "gpt-5-mini"
        elif total_tokens <= 4096:
            return "gpt-5-chat"
        else:
            return "gpt-5"