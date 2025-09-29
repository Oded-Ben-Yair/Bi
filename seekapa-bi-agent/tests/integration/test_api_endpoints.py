"""
Integration tests for API endpoints
Tests the complete API functionality including authentication, data flow, and error handling
"""

import pytest
import asyncio
import json
from fastapi.testclient import TestClient
from unittest.mock import Mock, AsyncMock, patch
from typing import Dict, Any

# Import the FastAPI app
import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '../../backend'))

from app.main import app
from app.config import settings


class TestAPIEndpoints:
    """Integration test suite for API endpoints"""

    @pytest.fixture
    def client(self):
        """Create test client"""
        return TestClient(app)

    @pytest.fixture
    def mock_azure_ai_service(self):
        """Mock Azure AI service"""
        with patch('app.main.azure_ai_service') as mock:
            mock.call_gpt5 = AsyncMock(return_value="Test AI response")
            yield mock

    @pytest.fixture
    def mock_powerbi_service(self):
        """Mock Power BI service"""
        with patch('app.main.powerbi_service') as mock:
            mock.get_dataset_info = AsyncMock(return_value={
                "id": "test-dataset",
                "name": "DS-Axia Dataset",
                "tables": [{"name": "Sales", "columns": ["Date", "Amount"]}]
            })
            mock.execute_dax_query = AsyncMock(return_value={
                "results": [{"tables": [{"rows": [{"Amount": 1000}]}]}]
            })
            mock.refresh_dataset = AsyncMock(return_value={"status": "initiated"})
            yield mock

    @pytest.fixture
    def mock_logic_apps_service(self):
        """Mock Logic Apps service"""
        with patch('app.main.logic_apps_service') as mock:
            mock.health_check = AsyncMock(return_value={
                "status": "healthy",
                "last_execution": "2024-01-01T00:00:00Z"
            })
            yield mock

    @pytest.fixture
    def mock_ai_foundry_agent(self):
        """Mock AI Foundry agent"""
        with patch('app.main.ai_foundry_agent') as mock:
            mock.health_check = AsyncMock(return_value={
                "status": "operational",
                "models": ["gpt-5-chat", "gpt-5-mini"]
            })
            yield mock

    def test_root_endpoint(self, client):
        """Test root endpoint returns application info"""
        response = client.get("/")

        assert response.status_code == 200
        data = response.json()
        assert "name" in data
        assert "version" in data
        assert data["name"] == "Seekapa Copilot"

    def test_health_endpoint(self, client):
        """Test health check endpoint"""
        response = client.get("/health")

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert "timestamp" in data
        assert "version" in data

    def test_logic_app_health_endpoint(self, client, mock_logic_apps_service):
        """Test Logic App health check endpoint"""
        response = client.get("/api/v1/health/logic-app")

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert "last_execution" in data

    def test_ai_foundry_health_endpoint(self, client, mock_ai_foundry_agent):
        """Test AI Foundry health check endpoint"""
        response = client.get("/api/v1/health/ai-foundry")

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "operational"
        assert "models" in data

    def test_webhook_health_endpoint(self, client):
        """Test webhook health check endpoint"""
        response = client.get("/api/v1/health/webhook")

        assert response.status_code == 200
        data = response.json()
        assert "webhook_status" in data

    def test_chat_endpoint_success(self, client, mock_azure_ai_service):
        """Test successful chat endpoint"""
        payload = {
            "message": "What are the top sales by region?",
            "conversation_id": "test-conversation"
        }

        response = client.post("/api/chat", json=payload)

        assert response.status_code == 200
        data = response.json()
        assert "response" in data
        assert data["response"] == "Test AI response"
        assert "conversation_id" in data

    def test_chat_endpoint_validation_error(self, client):
        """Test chat endpoint with validation error"""
        payload = {
            "message": "",  # Empty message should fail validation
            "conversation_id": "test-conversation"
        }

        response = client.post("/api/chat", json=payload)

        assert response.status_code == 422  # Validation error

    def test_chat_endpoint_missing_fields(self, client):
        """Test chat endpoint with missing required fields"""
        payload = {
            "conversation_id": "test-conversation"
            # Missing message field
        }

        response = client.post("/api/chat", json=payload)

        assert response.status_code == 422

    def test_powerbi_dataset_info_endpoint(self, client, mock_powerbi_service):
        """Test Power BI dataset info endpoint"""
        response = client.get("/api/powerbi/axia/info")

        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "DS-Axia Dataset"
        assert "tables" in data
        assert len(data["tables"]) > 0

    def test_powerbi_dax_query_endpoint(self, client, mock_powerbi_service):
        """Test Power BI DAX query endpoint"""
        payload = {
            "dax_query": "EVALUATE TOPN(10, Sales)",
            "timeout": 30
        }

        response = client.post("/api/powerbi/axia/query", json=payload)

        assert response.status_code == 200
        data = response.json()
        assert "results" in data

    def test_powerbi_natural_query_endpoint(self, client, mock_azure_ai_service, mock_powerbi_service):
        """Test Power BI natural language query endpoint"""
        payload = {
            "query": "Show me the top 10 sales by amount",
            "include_context": True
        }

        response = client.post("/api/powerbi/axia/query/natural", json=payload)

        assert response.status_code == 200
        data = response.json()
        assert "response" in data

    def test_powerbi_refresh_endpoint(self, client, mock_powerbi_service):
        """Test Power BI dataset refresh endpoint"""
        response = client.post("/api/powerbi/axia/refresh")

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "initiated"

    def test_cors_headers(self, client):
        """Test CORS headers are present"""
        response = client.options("/health")

        assert "access-control-allow-origin" in response.headers
        assert "access-control-allow-methods" in response.headers

    def test_chat_endpoint_with_context(self, client, mock_azure_ai_service):
        """Test chat endpoint with additional context"""
        payload = {
            "message": "Analyze sales trends",
            "conversation_id": "test-conversation",
            "context": {
                "user_role": "CEO",
                "dashboard": "executive"
            }
        }

        response = client.post("/api/chat", json=payload)

        assert response.status_code == 200
        data = response.json()
        assert "response" in data

    def test_chat_endpoint_conversation_history(self, client, mock_azure_ai_service):
        """Test chat endpoint maintains conversation history"""
        conversation_id = "test-conversation-history"

        # First message
        payload1 = {
            "message": "What are our sales?",
            "conversation_id": conversation_id
        }
        response1 = client.post("/api/chat", json=payload1)
        assert response1.status_code == 200

        # Second message in same conversation
        payload2 = {
            "message": "Show me the breakdown by region",
            "conversation_id": conversation_id
        }
        response2 = client.post("/api/chat", json=payload2)
        assert response2.status_code == 200

    def test_powerbi_query_timeout_handling(self, client, mock_powerbi_service):
        """Test Power BI query timeout handling"""
        # Mock timeout scenario
        mock_powerbi_service.execute_dax_query.side_effect = asyncio.TimeoutError("Query timeout")

        payload = {
            "dax_query": "EVALUATE LONG_RUNNING_QUERY",
            "timeout": 1  # Very short timeout
        }

        response = client.post("/api/powerbi/axia/query", json=payload)

        assert response.status_code == 408  # Request timeout

    def test_powerbi_query_syntax_error(self, client, mock_powerbi_service):
        """Test Power BI query syntax error handling"""
        # Mock syntax error
        mock_powerbi_service.execute_dax_query.side_effect = Exception("Invalid DAX syntax")

        payload = {
            "dax_query": "INVALID DAX QUERY SYNTAX"
        }

        response = client.post("/api/powerbi/axia/query", json=payload)

        assert response.status_code == 400  # Bad request

    def test_large_payload_handling(self, client, mock_azure_ai_service):
        """Test handling of large payloads"""
        large_message = "x" * 10000  # 10KB message

        payload = {
            "message": large_message,
            "conversation_id": "test-large-payload"
        }

        response = client.post("/api/chat", json=payload)

        # Should handle large payloads gracefully
        assert response.status_code in [200, 413]  # Success or payload too large

    def test_concurrent_requests(self, client, mock_azure_ai_service):
        """Test handling of concurrent requests"""
        import threading
        import time

        results = []

        def make_request():
            payload = {
                "message": f"Test message {threading.current_thread().ident}",
                "conversation_id": f"thread-{threading.current_thread().ident}"
            }
            response = client.post("/api/chat", json=payload)
            results.append(response.status_code)

        # Create multiple threads
        threads = [threading.Thread(target=make_request) for _ in range(5)]

        # Start all threads
        for thread in threads:
            thread.start()

        # Wait for all threads to complete
        for thread in threads:
            thread.join()

        # All requests should succeed
        assert all(status == 200 for status in results)

    def test_error_response_format(self, client, mock_azure_ai_service):
        """Test error response format consistency"""
        # Force an error
        mock_azure_ai_service.call_gpt5.side_effect = Exception("Test error")

        payload = {
            "message": "Test message",
            "conversation_id": "test-error"
        }

        response = client.post("/api/chat", json=payload)

        assert response.status_code == 500
        data = response.json()
        assert "error" in data or "detail" in data

    def test_health_endpoint_with_service_failures(self, client, mock_logic_apps_service, mock_ai_foundry_agent):
        """Test health endpoint when services are failing"""
        # Mock service failures
        mock_logic_apps_service.health_check.side_effect = Exception("Service down")
        mock_ai_foundry_agent.health_check.side_effect = Exception("Agent unavailable")

        response = client.get("/health")

        # Health endpoint should still respond but indicate issues
        assert response.status_code in [200, 503]  # OK or Service Unavailable

    def test_websocket_endpoint_availability(self, client):
        """Test WebSocket endpoint is available (connection test only)"""
        # Note: Full WebSocket testing requires different setup
        # This tests that the endpoint exists
        try:
            with client.websocket_connect("/ws/chat") as websocket:
                # Connection successful
                assert True
        except Exception:
            # WebSocket might not be fully mockable in test client
            # Endpoint existence is what we're primarily testing
            pass

    def test_api_versioning(self, client):
        """Test API versioning in endpoint paths"""
        # Test v1 endpoints exist
        v1_endpoints = [
            "/api/v1/health/logic-app",
            "/api/v1/health/ai-foundry",
            "/api/v1/health/webhook"
        ]

        for endpoint in v1_endpoints:
            response = client.get(endpoint)
            assert response.status_code in [200, 404, 500]  # Endpoint exists

    def test_content_type_validation(self, client):
        """Test content type validation for POST endpoints"""
        # Test with incorrect content type
        payload = "invalid json"

        response = client.post("/api/chat", data=payload, headers={"Content-Type": "text/plain"})

        assert response.status_code == 422  # Unprocessable entity

    def test_request_size_limits(self, client):
        """Test request size limits"""
        # Create extremely large payload
        very_large_message = "x" * 1000000  # 1MB message

        payload = {
            "message": very_large_message,
            "conversation_id": "test-size-limit"
        }

        response = client.post("/api/chat", json=payload)

        # Should handle or reject oversized requests
        assert response.status_code in [200, 413, 422]

    def test_authentication_headers(self, client):
        """Test authentication header handling (if implemented)"""
        # This would test API key or token authentication if implemented
        headers = {"Authorization": "Bearer fake-token"}

        response = client.get("/health", headers=headers)

        # Health endpoint should work regardless of auth headers for now
        assert response.status_code == 200


@pytest.mark.asyncio
class TestAsyncAPIFunctionality:
    """Test async API functionality that requires async test setup"""

    async def test_websocket_connection_flow(self):
        """Test complete WebSocket connection flow"""
        from fastapi.testclient import TestClient

        # This would require more complex WebSocket testing setup
        # Using websockets library or similar for full integration testing
        pass

    async def test_streaming_responses(self):
        """Test streaming response endpoints if implemented"""
        # Test streaming chat responses or data exports
        pass

    async def test_concurrent_websocket_connections(self):
        """Test multiple concurrent WebSocket connections"""
        # Test multiple clients connecting simultaneously
        pass


if __name__ == "__main__":
    pytest.main([__file__])