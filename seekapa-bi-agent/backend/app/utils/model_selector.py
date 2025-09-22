"""
Intelligent Model Selection Service
Selects the appropriate GPT-5 model based on query complexity and context
"""

import re
from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime
from app.config import settings
import tiktoken


class ModelSelector:
    """Intelligent model selection based on query analysis"""

    def __init__(self):
        self.settings = settings
        self.encoder = None
        try:
            self.encoder = tiktoken.get_encoding("cl100k_base")
        except:
            pass

        # Keywords for complexity detection
        self.complex_keywords = [
            "analyze", "compare", "forecast", "predict", "trend",
            "correlation", "regression", "model", "statistical",
            "variance", "deviation", "distribution", "hypothesis",
            "optimize", "strategy", "recommendation", "insight"
        ]

        self.simple_keywords = [
            "what", "when", "where", "count", "total", "sum",
            "how many", "list", "show", "get", "find", "name"
        ]

        self.medium_keywords = [
            "explain", "describe", "why", "how", "summarize",
            "overview", "breakdown", "detail", "calculate"
        ]

    def count_tokens(self, text: str) -> int:
        """Count tokens in text"""
        if self.encoder:
            return len(self.encoder.encode(text))
        # Fallback: estimate 4 chars per token
        return len(text) // 4

    def analyze_query_complexity(self, query: str) -> Tuple[str, float]:
        """
        Analyze query complexity and return complexity level with confidence score

        Returns:
            Tuple of (complexity_level, confidence_score)
            complexity_level: "simple", "medium", "complex", "advanced"
            confidence_score: 0.0 to 1.0
        """
        query_lower = query.lower()
        word_count = len(query.split())
        token_count = self.count_tokens(query)

        # Initialize scores
        complexity_scores = {
            "simple": 0.0,
            "medium": 0.0,
            "complex": 0.0,
            "advanced": 0.0
        }

        # Check for complex keywords
        complex_matches = sum(1 for keyword in self.complex_keywords if keyword in query_lower)
        if complex_matches > 0:
            complexity_scores["complex"] += complex_matches * 0.3
            if complex_matches > 3:
                complexity_scores["advanced"] += (complex_matches - 3) * 0.2

        # Check for simple keywords
        simple_matches = sum(1 for keyword in self.simple_keywords if keyword in query_lower)
        if simple_matches > 0:
            complexity_scores["simple"] += simple_matches * 0.4

        # Check for medium keywords
        medium_matches = sum(1 for keyword in self.medium_keywords if keyword in query_lower)
        if medium_matches > 0:
            complexity_scores["medium"] += medium_matches * 0.35

        # Factor in query length
        if word_count < 10:
            complexity_scores["simple"] += 0.3
        elif word_count < 25:
            complexity_scores["medium"] += 0.3
        elif word_count < 50:
            complexity_scores["complex"] += 0.3
        else:
            complexity_scores["advanced"] += 0.4

        # Token count factor
        if token_count < 20:
            complexity_scores["simple"] += 0.2
        elif token_count < 50:
            complexity_scores["medium"] += 0.2
        elif token_count < 100:
            complexity_scores["complex"] += 0.2
        else:
            complexity_scores["advanced"] += 0.3

        # Check for special patterns
        if re.search(r'\b(YoY|QoQ|MoM|YTD|MTD)\b', query, re.IGNORECASE):
            complexity_scores["complex"] += 0.3

        if re.search(r'\b(DAX|SQL|query|formula)\b', query, re.IGNORECASE):
            complexity_scores["complex"] += 0.2

        if re.search(r'\b(machine learning|AI|deep learning|neural)\b', query_lower):
            complexity_scores["advanced"] += 0.4

        # Normalize scores
        total_score = sum(complexity_scores.values())
        if total_score > 0:
            for key in complexity_scores:
                complexity_scores[key] /= total_score

        # Determine complexity level
        complexity_level = max(complexity_scores, key=complexity_scores.get)
        confidence_score = complexity_scores[complexity_level]

        return complexity_level, confidence_score

    def select_model(
        self,
        query: str,
        context: Optional[Dict[str, Any]] = None,
        conversation_history: Optional[List[Dict[str, str]]] = None
    ) -> Dict[str, Any]:
        """
        Select appropriate GPT-5 model based on query and context

        Args:
            query: User query
            context: Additional context (dataset info, user preferences, etc.)
            conversation_history: Previous messages in conversation

        Returns:
            Model configuration dictionary
        """
        # Analyze query complexity
        complexity_level, confidence = self.analyze_query_complexity(query)

        # Consider conversation history length
        conversation_depth = len(conversation_history) if conversation_history else 0

        # Get base model recommendation
        model_config = self._get_model_by_complexity(complexity_level)

        # Override based on specific context
        if context:
            # Check for explicit model preference
            if context.get("preferred_model"):
                preferred = context["preferred_model"]
                if preferred in self.settings.GPT5_MODELS:
                    model_config = self.settings.GPT5_MODELS[preferred].copy()

            # Check for time-sensitive queries
            if context.get("real_time", False) and complexity_level != "advanced":
                # Use faster model for real-time needs
                model_config = self.settings.GPT5_MODELS["gpt-5-nano"].copy()

            # Check for high-accuracy requirements
            if context.get("high_accuracy", False):
                # Use most capable model
                model_config = self.settings.GPT5_MODELS["gpt-5"].copy()

        # Adjust for conversation depth
        if conversation_depth > 5 and complexity_level in ["simple", "medium"]:
            # Use chat model for long conversations
            model_config = self.settings.GPT5_MODELS["gpt-5-chat"].copy()

        # Add selection metadata
        model_config["selection_metadata"] = {
            "complexity_level": complexity_level,
            "confidence_score": confidence,
            "conversation_depth": conversation_depth,
            "timestamp": datetime.now().isoformat(),
            "query_length": len(query),
            "selected_reason": self._get_selection_reason(complexity_level, context)
        }

        return model_config

    def _get_model_by_complexity(self, complexity_level: str) -> Dict[str, Any]:
        """Get model configuration based on complexity level"""
        model_mapping = {
            "simple": "gpt-5-nano",
            "medium": "gpt-5-mini",
            "complex": "gpt-5-chat",
            "advanced": "gpt-5"
        }

        model_name = model_mapping.get(complexity_level, "gpt-5-chat")
        return self.settings.GPT5_MODELS[model_name].copy()

    def _get_selection_reason(self, complexity_level: str, context: Optional[Dict] = None) -> str:
        """Generate human-readable reason for model selection"""
        reasons = {
            "simple": "Simple query requiring quick factual response",
            "medium": "Moderate complexity requiring balanced analysis",
            "complex": "Complex query requiring detailed analysis",
            "advanced": "Advanced query requiring comprehensive analysis and forecasting"
        }

        base_reason = reasons.get(complexity_level, "Standard query processing")

        if context:
            if context.get("real_time"):
                base_reason += " (optimized for real-time response)"
            if context.get("high_accuracy"):
                base_reason += " (high accuracy mode)"
            if context.get("preferred_model"):
                base_reason += f" (user preference: {context['preferred_model']})"

        return base_reason

    def estimate_cost(self, model_name: str, input_tokens: int, output_tokens: int) -> float:
        """
        Estimate cost for model usage

        Note: These are example rates - update with actual Azure pricing
        """
        # Example pricing per 1K tokens (update with actual rates)
        pricing = {
            "gpt-5": {"input": 0.03, "output": 0.06},
            "gpt-5-chat": {"input": 0.02, "output": 0.04},
            "gpt-5-mini": {"input": 0.01, "output": 0.02},
            "gpt-5-nano": {"input": 0.005, "output": 0.01}
        }

        if model_name not in pricing:
            return 0.0

        input_cost = (input_tokens / 1000) * pricing[model_name]["input"]
        output_cost = (output_tokens / 1000) * pricing[model_name]["output"]

        return round(input_cost + output_cost, 4)