"""
Azure AI Service
Manages interactions with GPT-5 models and provides intelligent responses
"""

import aiohttp
import asyncio
import json
from typing import List, Dict, Any, AsyncGenerator, Optional
from datetime import datetime
import logging
from app.config import settings
from app.utils.model_selector import ModelSelector

logger = logging.getLogger(__name__)


class AzureAIService:
    """Service for interacting with Azure OpenAI GPT-5 models"""

    def __init__(self):
        self.model_selector = ModelSelector()
        self.settings = settings
        self.session: Optional[aiohttp.ClientSession] = None
        self.request_history: List[Dict] = []

    async def initialize(self):
        """Initialize the service with an aiohttp session"""
        if not self.session:
            timeout = aiohttp.ClientTimeout(total=30)
            self.session = aiohttp.ClientSession(timeout=timeout)

    async def cleanup(self):
        """Cleanup resources"""
        if self.session:
            await self.session.close()

    async def call_gpt5(
        self,
        messages: List[Dict[str, str]],
        query: str,
        context: Optional[Dict[str, Any]] = None,
        stream: bool = False,
        conversation_history: Optional[List[Dict[str, str]]] = None
    ) -> AsyncGenerator[str, None] | str:
        """
        Call appropriate GPT-5 model based on query complexity

        Args:
            messages: Conversation messages
            query: Current user query
            context: Additional context
            stream: Whether to stream the response
            conversation_history: Previous conversation turns

        Returns:
            Response from GPT-5 model (streaming or complete)
        """
        if not self.session:
            await self.initialize()

        # Check if API key is configured
        if not self.settings.AZURE_OPENAI_API_KEY or self.settings.AZURE_OPENAI_API_KEY == "":
            logger.warning("Azure OpenAI API key not configured, using fallback response")
            fallback_response = (
                "I'm currently unable to connect to the Azure AI service. "
                "Please ensure the Azure OpenAI API credentials are properly configured. "
                "In the meantime, I can help you understand the DS-Axia dataset structure "
                "and provide general guidance about Power BI analytics."
            )
            if stream:
                async def fallback_stream():
                    yield fallback_response
                return fallback_stream()
            return fallback_response

        # Select the best model for this query (force GPT-5 for now)
        model_config = {
            'deployment_name': self.settings.GPT5_DEPLOYMENT_NAME,
            'model_name': 'gpt-5',
            'max_tokens': 4000,
            'temperature': 0.7
        }

        # Prepare optimized system message for GPT-5
        system_message = {
            "role": "system",
            "content": "You are Seekapa Copilot, a helpful AI assistant for business analytics. Answer questions about revenue, sales, and business metrics clearly and concisely. Provide specific insights and recommendations based on the DS-Axia dataset."
        }

        # Prepare headers
        headers = {
            "api-key": self.settings.AZURE_OPENAI_API_KEY,
            "Content-Type": "application/json"
        }

        # Prepare request body with optimized parameters for GPT-5
        body = {
            "messages": [system_message] + messages,
            "max_completion_tokens": 2000,
            "temperature": 0.9,
            "top_p": 0.95,
            "frequency_penalty": 0.1,
            "presence_penalty": 0.1,
            "stream": stream
        }

        # Log request metadata
        request_metadata = {
            "model": model_config["deployment_name"],
            "query_length": len(query),
            "timestamp": datetime.now().isoformat(),
            "stream": stream
        }
        self.request_history.append(request_metadata)
        logger.info(f"Calling {model_config['deployment_name']} model", extra=request_metadata)

        # Build the correct GPT-5 endpoint
        endpoint = f"{self.settings.AZURE_OPENAI_ENDPOINT}/openai/deployments/{model_config['deployment_name']}/chat/completions?api-version={self.settings.AZURE_API_VERSION}"

        try:
            if stream:
                return self._stream_response(endpoint, headers, body, model_config)
            else:
                return await self._get_response(endpoint, headers, body, model_config)

        except Exception as e:
            logger.error(f"Error calling GPT-5: {str(e)}", exc_info=True)
            error_msg = str(e)
            if "401" in error_msg or "Access denied" in error_msg:
                fallback = (
                    "Authentication failed with Azure OpenAI. Please check your API credentials. "
                    "I can still help you understand the DS-Axia dataset structure and Power BI concepts."
                )
            elif "404" in error_msg:
                fallback = (
                    "The specified GPT-5 model deployment was not found. "
                    "Please verify the deployment names in your Azure OpenAI resource."
                )
            else:
                fallback = (
                    f"An error occurred while processing your request: {error_msg}. "
                    "I can still provide general guidance about DS-Axia analytics."
                )

            if stream:
                async def error_stream():
                    yield fallback
                return error_stream()
            return fallback

    async def _stream_response(
        self,
        endpoint: str,
        headers: Dict[str, str],
        body: Dict[str, Any],
        model_config: Dict[str, Any]
    ) -> AsyncGenerator[str, None]:
        """Stream response from GPT-5"""
        try:
            async with self.session.post(endpoint, headers=headers, json=body) as response:
                if response.status == 200:
                    async for line in response.content:
                        if line:
                            line_str = line.decode('utf-8').strip()
                            if line_str.startswith("data: "):
                                data_str = line_str[6:]
                                if data_str == "[DONE]":
                                    break
                                try:
                                    data = json.loads(data_str)
                                    if "choices" in data and len(data["choices"]) > 0:
                                        choice = data["choices"][0]
                                        if "delta" in choice and "content" in choice["delta"]:
                                            yield choice["delta"]["content"]
                                except json.JSONDecodeError:
                                    continue
                else:
                    error_text = await response.text()
                    logger.error(f"GPT-5 API error: {response.status} - {error_text}")
                    yield f"Error: Unable to process your request. Status: {response.status}"
        except Exception as e:
            logger.error(f"Stream error: {str(e)}", exc_info=True)
            yield f"Error: Connection issue - {str(e)}"

    async def _get_response(
        self,
        endpoint: str,
        headers: Dict[str, str],
        body: Dict[str, Any],
        model_config: Dict[str, Any]
    ) -> str:
        """Get complete response from GPT-5"""
        try:
            async with self.session.post(endpoint, headers=headers, json=body) as response:
                if response.status == 200:
                    data = await response.json()
                    if "choices" in data and len(data["choices"]) > 0:
                        content = data["choices"][0].get("message", {}).get("content", "")

                        # Log successful response
                        logger.info(f"Successful response from {model_config['deployment']}")

                        return content
                    else:
                        return "No response content received."
                else:
                    error_text = await response.text()
                    logger.error(f"GPT-5 API error: {response.status} - {error_text}")
                    return f"I apologize, but I encountered an error processing your request. Please try again."
        except asyncio.TimeoutError:
            logger.error("Request timeout")
            return "The request timed out. Please try with a simpler query or try again later."
        except Exception as e:
            logger.error(f"Request error: {str(e)}", exc_info=True)
            return f"An error occurred while processing your request: {str(e)}"

    def _create_system_message(self, model_config: Dict[str, Any], context: Optional[Dict[str, Any]] = None) -> Dict[str, str]:
        """Create system message based on model and context"""
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        system_content = self.settings.SYSTEM_PROMPT_TEMPLATE.format(
            dataset_name=self.settings.POWERBI_AXIA_DATASET_NAME,
            dataset_id=self.settings.POWERBI_AXIA_DATASET_ID,
            model_name=model_config["deployment_name"],
            timestamp=timestamp
        )

        # Add context-specific instructions
        if context:
            if context.get("include_visuals"):
                system_content += "\n\nInclude visual descriptions and chart recommendations in your response."

            if context.get("technical_level") == "expert":
                system_content += "\n\nProvide technical details including DAX formulas and advanced analytics."
            elif context.get("technical_level") == "beginner":
                system_content += "\n\nExplain concepts in simple terms, avoiding technical jargon."

            if context.get("output_format") == "json":
                system_content += "\n\nFormat your response as valid JSON."
            elif context.get("output_format") == "markdown":
                system_content += "\n\nFormat your response using Markdown with proper headers and lists."

        return {"role": "system", "content": system_content}

    def _get_fallback_response(self, error: str) -> str:
        """Get fallback response when API fails"""
        return (
            "I apologize, but I'm currently unable to process your request due to a technical issue. "
            "Please try again in a moment. If the problem persists, please contact support.\n\n"
            f"Error details: {error}"
        )

    async def generate_dax_query(self, natural_language_query: str) -> Dict[str, Any]:
        """
        Generate a DAX query from natural language

        Args:
            natural_language_query: User's question in natural language

        Returns:
            Dictionary with DAX query and explanation
        """
        prompt = f"""Convert this natural language query into a DAX query for the DS-Axia dataset:

User Query: {natural_language_query}

Provide:
1. The DAX query
2. Brief explanation of what it does
3. Expected output format

Format as JSON with keys: dax_query, explanation, output_format"""

        messages = [{"role": "user", "content": prompt}]

        response = await self.call_gpt5(
            messages=messages,
            query=natural_language_query,
            context={"output_format": "json", "high_accuracy": True}
        )

        try:
            # Parse JSON response
            result = json.loads(response)
            return result
        except json.JSONDecodeError:
            # Fallback if JSON parsing fails
            return {
                "dax_query": "",
                "explanation": response,
                "output_format": "text",
                "error": "Could not parse DAX query"
            }

    async def analyze_data(
        self,
        data: Any,
        analysis_type: str = "general",
        user_question: Optional[str] = None
    ) -> str:
        """
        Analyze data and provide insights

        Args:
            data: Data to analyze (can be dict, list, or string)
            analysis_type: Type of analysis (general, trend, anomaly, forecast)
            user_question: Specific question about the data

        Returns:
            Analysis results as formatted text
        """
        # Prepare data for analysis
        if isinstance(data, (dict, list)):
            data_str = json.dumps(data, indent=2)
        else:
            data_str = str(data)

        # Truncate if too long
        if len(data_str) > 10000:
            data_str = data_str[:10000] + "... [truncated]"

        # Build analysis prompt
        prompts = {
            "general": "Analyze this data and provide key insights:",
            "trend": "Identify trends and patterns in this data:",
            "anomaly": "Detect any anomalies or unusual patterns in this data:",
            "forecast": "Based on this historical data, provide forecasts and predictions:"
        }

        base_prompt = prompts.get(analysis_type, prompts["general"])

        if user_question:
            prompt = f"{base_prompt}\n\nSpecific question: {user_question}\n\nData:\n{data_str}"
        else:
            prompt = f"{base_prompt}\n\nData:\n{data_str}"

        messages = [{"role": "user", "content": prompt}]

        # Use complex model for data analysis
        response = await self.call_gpt5(
            messages=messages,
            query=prompt,
            context={"high_accuracy": True}
        )

        return response

    def get_model_stats(self) -> Dict[str, Any]:
        """Get statistics about model usage"""
        if not self.request_history:
            return {"total_requests": 0, "models_used": {}}

        stats = {
            "total_requests": len(self.request_history),
            "models_used": {},
            "complexity_distribution": {},
            "average_query_length": 0
        }

        total_length = 0
        for request in self.request_history:
            model = request["model"]
            complexity = request["complexity"]

            stats["models_used"][model] = stats["models_used"].get(model, 0) + 1
            stats["complexity_distribution"][complexity] = stats["complexity_distribution"].get(complexity, 0) + 1
            total_length += request["query_length"]

        if self.request_history:
            stats["average_query_length"] = total_length / len(self.request_history)

        return stats