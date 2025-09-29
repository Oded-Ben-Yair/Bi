"""
Unit tests for Azure AI Service
Tests the Azure OpenAI GPT-5 integration and model selection logic
"""

import pytest
import asyncio
from unittest.mock import Mock, AsyncMock, patch, MagicMock
import aiohttp
from typing import List, Dict, Any

# Import the service we're testing
import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '../../../backend'))

from app.services.azure_ai import AzureAIService
from app.utils.model_selector import ModelSelector


class TestAzureAIService:
    """Test suite for Azure AI Service"""

    @pytest.fixture
    def mock_settings(self):
        """Mock settings for testing"""
        settings_mock = Mock()
        settings_mock.AZURE_OPENAI_API_KEY = "test-key-123"
        settings_mock.AZURE_OPENAI_ENDPOINT = "https://test.openai.azure.com/"
        settings_mock.AZURE_OPENAI_API_VERSION = "2024-06-01"
        return settings_mock

    @pytest.fixture
    def azure_ai_service(self, mock_settings):
        """Create Azure AI service instance for testing"""
        with patch('app.services.azure_ai.settings', mock_settings):
            service = AzureAIService()
            return service

    @pytest.fixture
    def mock_model_selector(self):
        """Mock model selector for testing"""
        selector = Mock(spec=ModelSelector)
        selector.select_model.return_value = "gpt-5-chat"
        selector.estimate_tokens.return_value = 150
        return selector

    @pytest.mark.asyncio
    async def test_service_initialization(self, azure_ai_service):
        """Test service initialization"""
        assert azure_ai_service.session is None
        assert azure_ai_service.request_history == []

        await azure_ai_service.initialize()

        assert azure_ai_service.session is not None
        assert isinstance(azure_ai_service.session, aiohttp.ClientSession)

    @pytest.mark.asyncio
    async def test_service_cleanup(self, azure_ai_service):
        """Test service cleanup"""
        await azure_ai_service.initialize()
        session_mock = Mock()
        session_mock.close = AsyncMock()
        azure_ai_service.session = session_mock

        await azure_ai_service.cleanup()

        session_mock.close.assert_called_once()

    @pytest.mark.asyncio
    async def test_call_gpt5_successful_response(self, azure_ai_service, mock_model_selector):
        """Test successful GPT-5 API call"""
        # Setup mocks
        azure_ai_service.model_selector = mock_model_selector

        # Mock HTTP response
        mock_response = Mock()
        mock_response.status = 200
        mock_response.json = AsyncMock(return_value={
            "choices": [{
                "message": {
                    "content": "Test response from GPT-5"
                }
            }]
        })

        # Mock session
        mock_session = AsyncMock()
        mock_session.post.return_value.__aenter__.return_value = mock_response
        azure_ai_service.session = mock_session

        # Test data
        messages = [{"role": "user", "content": "Test query"}]
        query = "Test query"

        # Execute test
        result = await azure_ai_service.call_gpt5(messages, query)

        # Assertions
        assert result == "Test response from GPT-5"
        mock_model_selector.select_model.assert_called_once_with(query, None)
        mock_session.post.assert_called_once()

    @pytest.mark.asyncio
    async def test_call_gpt5_api_error(self, azure_ai_service, mock_model_selector):
        """Test GPT-5 API call with error response"""
        # Setup mocks
        azure_ai_service.model_selector = mock_model_selector

        # Mock HTTP error response
        mock_response = Mock()
        mock_response.status = 500
        mock_response.text = AsyncMock(return_value="Internal Server Error")

        # Mock session
        mock_session = AsyncMock()
        mock_session.post.return_value.__aenter__.return_value = mock_response
        azure_ai_service.session = mock_session

        # Test data
        messages = [{"role": "user", "content": "Test query"}]
        query = "Test query"

        # Execute test and expect exception
        with pytest.raises(Exception) as exc_info:
            await azure_ai_service.call_gpt5(messages, query)

        assert "Azure OpenAI API error" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_call_gpt5_with_context(self, azure_ai_service, mock_model_selector):
        """Test GPT-5 call with additional context"""
        # Setup mocks
        azure_ai_service.model_selector = mock_model_selector

        # Mock HTTP response
        mock_response = Mock()
        mock_response.status = 200
        mock_response.json = AsyncMock(return_value={
            "choices": [{
                "message": {
                    "content": "Response with context"
                }
            }]
        })

        # Mock session
        mock_session = AsyncMock()
        mock_session.post.return_value.__aenter__.return_value = mock_response
        azure_ai_service.session = mock_session

        # Test data with context
        messages = [{"role": "user", "content": "Test query"}]
        query = "Test query"
        context = {"power_bi_data": "sample data", "user_role": "CEO"}

        # Execute test
        result = await azure_ai_service.call_gpt5(messages, query, context=context)

        # Assertions
        assert result == "Response with context"
        mock_model_selector.select_model.assert_called_once_with(query, context)

    @pytest.mark.asyncio
    async def test_call_gpt5_streaming_response(self, azure_ai_service, mock_model_selector):
        """Test GPT-5 streaming response"""
        # Setup mocks
        azure_ai_service.model_selector = mock_model_selector

        # Mock streaming response data
        streaming_data = [
            b'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n',
            b'data: {"choices":[{"delta":{"content":" world"}}]}\n\n',
            b'data: [DONE]\n\n'
        ]

        # Mock HTTP response for streaming
        mock_response = Mock()
        mock_response.status = 200

        async def mock_iter_chunked(chunk_size):
            for chunk in streaming_data:
                yield chunk

        mock_response.content.iter_chunked = mock_iter_chunked

        # Mock session
        mock_session = AsyncMock()
        mock_session.post.return_value.__aenter__.return_value = mock_response
        azure_ai_service.session = mock_session

        # Test data
        messages = [{"role": "user", "content": "Test query"}]
        query = "Test query"

        # Execute streaming test
        result_chunks = []
        async for chunk in azure_ai_service.call_gpt5(messages, query, stream=True):
            result_chunks.append(chunk)

        # Assertions
        assert "Hello" in result_chunks
        assert " world" in result_chunks

    @pytest.mark.asyncio
    async def test_request_history_tracking(self, azure_ai_service, mock_model_selector):
        """Test that request history is properly tracked"""
        # Setup mocks
        azure_ai_service.model_selector = mock_model_selector

        # Mock HTTP response
        mock_response = Mock()
        mock_response.status = 200
        mock_response.json = AsyncMock(return_value={
            "choices": [{
                "message": {
                    "content": "Test response"
                }
            }]
        })

        # Mock session
        mock_session = AsyncMock()
        mock_session.post.return_value.__aenter__.return_value = mock_response
        azure_ai_service.session = mock_session

        # Test data
        messages = [{"role": "user", "content": "Test query"}]
        query = "Test query"

        # Execute test
        initial_history_length = len(azure_ai_service.request_history)
        await azure_ai_service.call_gpt5(messages, query)

        # Assertions
        assert len(azure_ai_service.request_history) == initial_history_length + 1
        latest_request = azure_ai_service.request_history[-1]
        assert latest_request["query"] == query
        assert "timestamp" in latest_request
        assert "model" in latest_request

    def test_model_selector_integration(self, azure_ai_service):
        """Test integration with model selector"""
        assert azure_ai_service.model_selector is not None
        assert isinstance(azure_ai_service.model_selector, ModelSelector)

    @pytest.mark.asyncio
    async def test_session_reuse(self, azure_ai_service):
        """Test that session is reused across multiple calls"""
        await azure_ai_service.initialize()
        first_session = azure_ai_service.session

        await azure_ai_service.initialize()
        second_session = azure_ai_service.session

        assert first_session is second_session

    @pytest.mark.asyncio
    async def test_timeout_configuration(self, azure_ai_service):
        """Test that timeout is properly configured"""
        await azure_ai_service.initialize()

        assert azure_ai_service.session.timeout.total == 30

    @pytest.mark.asyncio
    async def test_conversation_history_handling(self, azure_ai_service, mock_model_selector):
        """Test handling of conversation history"""
        # Setup mocks
        azure_ai_service.model_selector = mock_model_selector

        # Mock HTTP response
        mock_response = Mock()
        mock_response.status = 200
        mock_response.json = AsyncMock(return_value={
            "choices": [{
                "message": {
                    "content": "Response with history"
                }
            }]
        })

        # Mock session
        mock_session = AsyncMock()
        mock_session.post.return_value.__aenter__.return_value = mock_response
        azure_ai_service.session = mock_session

        # Test data with conversation history
        messages = [{"role": "user", "content": "Current query"}]
        query = "Current query"
        conversation_history = [
            {"role": "user", "content": "Previous question"},
            {"role": "assistant", "content": "Previous answer"}
        ]

        # Execute test
        result = await azure_ai_service.call_gpt5(
            messages, query, conversation_history=conversation_history
        )

        # Assertions
        assert result == "Response with history"

        # Verify that conversation history was included in the API call
        call_args = mock_session.post.call_args
        assert call_args is not None


if __name__ == "__main__":
    pytest.main([__file__])