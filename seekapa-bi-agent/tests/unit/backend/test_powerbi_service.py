"""
Unit tests for Power BI Service
Tests the Power BI REST API integration and OAuth authentication
"""

import pytest
import asyncio
from unittest.mock import Mock, AsyncMock, patch, MagicMock
import aiohttp
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List

# Import the service we're testing
import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '../../../backend'))

from app.services.powerbi import PowerBIService


class TestPowerBIService:
    """Test suite for Power BI Service"""

    @pytest.fixture
    def mock_settings(self):
        """Mock settings for testing"""
        settings_mock = Mock()
        settings_mock.POWERBI_CLIENT_ID = "test-client-id"
        settings_mock.POWERBI_CLIENT_SECRET = "test-client-secret"
        settings_mock.POWERBI_TENANT_ID = "test-tenant-id"
        settings_mock.POWERBI_USERNAME = "test@example.com"
        settings_mock.POWERBI_PASSWORD = "test-password"
        settings_mock.POWERBI_DATASET_ID = "test-dataset-id"
        return settings_mock

    @pytest.fixture
    def powerbi_service(self, mock_settings):
        """Create Power BI service instance for testing"""
        with patch('app.services.powerbi.settings', mock_settings):
            service = PowerBIService()
            return service

    @pytest.mark.asyncio
    async def test_service_initialization(self, powerbi_service):
        """Test service initialization"""
        assert powerbi_service.session is None
        assert powerbi_service.token_cache["token"] is None
        assert powerbi_service.dataset_cache == {}

        await powerbi_service.initialize()

        assert powerbi_service.session is not None
        assert isinstance(powerbi_service.session, aiohttp.ClientSession)

    @pytest.mark.asyncio
    async def test_service_cleanup(self, powerbi_service):
        """Test service cleanup"""
        await powerbi_service.initialize()
        session_mock = Mock()
        session_mock.close = AsyncMock()
        powerbi_service.session = session_mock

        await powerbi_service.cleanup()

        session_mock.close.assert_called_once()

    @pytest.mark.asyncio
    async def test_get_access_token_success(self, powerbi_service):
        """Test successful access token retrieval"""
        # Mock HTTP response for token request
        mock_response = Mock()
        mock_response.status = 200
        mock_response.json = AsyncMock(return_value={
            "access_token": "test-access-token",
            "expires_in": 3600,
            "refresh_token": "test-refresh-token"
        })

        # Mock session
        mock_session = AsyncMock()
        mock_session.post.return_value.__aenter__.return_value = mock_response
        powerbi_service.session = mock_session

        # Execute test
        token = await powerbi_service.get_access_token()

        # Assertions
        assert token == "test-access-token"
        assert powerbi_service.token_cache["token"] == "test-access-token"
        assert powerbi_service.token_cache["refresh_token"] == "test-refresh-token"
        assert powerbi_service.token_cache["expires"] is not None

    @pytest.mark.asyncio
    async def test_get_access_token_cached(self, powerbi_service):
        """Test access token retrieval from cache"""
        # Set up cached token that's not expired
        future_expiry = datetime.utcnow() + timedelta(minutes=30)
        powerbi_service.token_cache = {
            "token": "cached-token",
            "expires": future_expiry,
            "refresh_token": "cached-refresh-token"
        }

        # Execute test
        token = await powerbi_service.get_access_token()

        # Assertions
        assert token == "cached-token"

    @pytest.mark.asyncio
    async def test_get_access_token_expired_cache(self, powerbi_service):
        """Test access token retrieval when cached token is expired"""
        # Set up expired cached token
        past_expiry = datetime.utcnow() - timedelta(minutes=30)
        powerbi_service.token_cache = {
            "token": "expired-token",
            "expires": past_expiry,
            "refresh_token": "expired-refresh-token"
        }

        # Mock HTTP response for new token request
        mock_response = Mock()
        mock_response.status = 200
        mock_response.json = AsyncMock(return_value={
            "access_token": "new-access-token",
            "expires_in": 3600,
            "refresh_token": "new-refresh-token"
        })

        # Mock session
        mock_session = AsyncMock()
        mock_session.post.return_value.__aenter__.return_value = mock_response
        powerbi_service.session = mock_session

        # Execute test
        token = await powerbi_service.get_access_token()

        # Assertions
        assert token == "new-access-token"
        assert powerbi_service.token_cache["token"] == "new-access-token"

    @pytest.mark.asyncio
    async def test_get_access_token_failure(self, powerbi_service):
        """Test access token retrieval failure"""
        # Mock HTTP error response
        mock_response = Mock()
        mock_response.status = 400
        mock_response.text = AsyncMock(return_value="Bad Request")

        # Mock session
        mock_session = AsyncMock()
        mock_session.post.return_value.__aenter__.return_value = mock_response
        powerbi_service.session = mock_session

        # Execute test and expect exception
        with pytest.raises(Exception) as exc_info:
            await powerbi_service.get_access_token()

        assert "Failed to get access token" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_get_dataset_info_success(self, powerbi_service):
        """Test successful dataset information retrieval"""
        # Mock access token
        powerbi_service.get_access_token = AsyncMock(return_value="test-token")

        # Mock HTTP response for dataset info
        mock_response = Mock()
        mock_response.status = 200
        mock_response.json = AsyncMock(return_value={
            "id": "test-dataset-id",
            "name": "DS-Axia Dataset",
            "tables": [
                {"name": "Sales", "columns": ["Date", "Amount", "Customer"]},
                {"name": "Products", "columns": ["ProductID", "Name", "Category"]}
            ]
        })

        # Mock session
        mock_session = AsyncMock()
        mock_session.get.return_value.__aenter__.return_value = mock_response
        powerbi_service.session = mock_session

        # Execute test
        dataset_info = await powerbi_service.get_dataset_info()

        # Assertions
        assert dataset_info["name"] == "DS-Axia Dataset"
        assert len(dataset_info["tables"]) == 2
        assert dataset_info["tables"][0]["name"] == "Sales"

    @pytest.mark.asyncio
    async def test_execute_dax_query_success(self, powerbi_service):
        """Test successful DAX query execution"""
        # Mock access token
        powerbi_service.get_access_token = AsyncMock(return_value="test-token")

        # Mock HTTP response for DAX query
        mock_response = Mock()
        mock_response.status = 200
        mock_response.json = AsyncMock(return_value={
            "results": [{
                "tables": [{
                    "rows": [
                        {"[Sales].[Amount]": 1000, "[Sales].[Date]": "2024-01-01"},
                        {"[Sales].[Amount]": 1500, "[Sales].[Date]": "2024-01-02"}
                    ]
                }]
            }]
        })

        # Mock session
        mock_session = AsyncMock()
        mock_session.post.return_value.__aenter__.return_value = mock_response
        powerbi_service.session = mock_session

        # Execute test
        dax_query = "EVALUATE TOPN(10, Sales)"
        result = await powerbi_service.execute_dax_query(dax_query)

        # Assertions
        assert "results" in result
        assert len(result["results"][0]["tables"][0]["rows"]) == 2

    @pytest.mark.asyncio
    async def test_execute_dax_query_invalid_syntax(self, powerbi_service):
        """Test DAX query execution with invalid syntax"""
        # Mock access token
        powerbi_service.get_access_token = AsyncMock(return_value="test-token")

        # Mock HTTP error response for invalid DAX
        mock_response = Mock()
        mock_response.status = 400
        mock_response.json = AsyncMock(return_value={
            "error": {
                "code": "InvalidSyntax",
                "message": "Invalid DAX syntax"
            }
        })

        # Mock session
        mock_session = AsyncMock()
        mock_session.post.return_value.__aenter__.return_value = mock_response
        powerbi_service.session = mock_session

        # Execute test and expect exception
        with pytest.raises(Exception) as exc_info:
            await powerbi_service.execute_dax_query("INVALID DAX QUERY")

        assert "DAX query failed" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_get_dataset_tables_success(self, powerbi_service):
        """Test successful dataset tables retrieval"""
        # Mock access token
        powerbi_service.get_access_token = AsyncMock(return_value="test-token")

        # Mock HTTP response for tables
        mock_response = Mock()
        mock_response.status = 200
        mock_response.json = AsyncMock(return_value={
            "value": [
                {
                    "name": "Sales",
                    "columns": [
                        {"name": "Date", "dataType": "DateTime"},
                        {"name": "Amount", "dataType": "Double"},
                        {"name": "Customer", "dataType": "String"}
                    ]
                },
                {
                    "name": "Products",
                    "columns": [
                        {"name": "ProductID", "dataType": "String"},
                        {"name": "Name", "dataType": "String"},
                        {"name": "Category", "dataType": "String"}
                    ]
                }
            ]
        })

        # Mock session
        mock_session = AsyncMock()
        mock_session.get.return_value.__aenter__.return_value = mock_response
        powerbi_service.session = mock_session

        # Execute test
        tables = await powerbi_service.get_dataset_tables()

        # Assertions
        assert len(tables["value"]) == 2
        assert tables["value"][0]["name"] == "Sales"
        assert len(tables["value"][0]["columns"]) == 3

    @pytest.mark.asyncio
    async def test_refresh_dataset_success(self, powerbi_service):
        """Test successful dataset refresh"""
        # Mock access token
        powerbi_service.get_access_token = AsyncMock(return_value="test-token")

        # Mock HTTP response for refresh
        mock_response = Mock()
        mock_response.status = 202
        mock_response.headers = {"Location": "https://api.powerbi.com/refresh/123"}

        # Mock session
        mock_session = AsyncMock()
        mock_session.post.return_value.__aenter__.return_value = mock_response
        powerbi_service.session = mock_session

        # Execute test
        result = await powerbi_service.refresh_dataset()

        # Assertions
        assert result["status"] == "initiated"
        assert "location" in result

    @pytest.mark.asyncio
    async def test_dataset_caching(self, powerbi_service):
        """Test dataset information caching"""
        # Mock access token
        powerbi_service.get_access_token = AsyncMock(return_value="test-token")

        # Mock HTTP response
        mock_response = Mock()
        mock_response.status = 200
        mock_response.json = AsyncMock(return_value={"name": "Test Dataset"})

        # Mock session
        mock_session = AsyncMock()
        mock_session.get.return_value.__aenter__.return_value = mock_response
        powerbi_service.session = mock_session

        # First call should make HTTP request
        result1 = await powerbi_service.get_dataset_info()
        assert mock_session.get.call_count == 1

        # Second call should use cache (if implemented)
        result2 = await powerbi_service.get_dataset_info()

        assert result1 == result2

    @pytest.mark.asyncio
    async def test_error_handling_network_failure(self, powerbi_service):
        """Test error handling for network failures"""
        # Mock network failure
        mock_session = AsyncMock()
        mock_session.post.side_effect = aiohttp.ClientError("Network error")
        powerbi_service.session = mock_session

        # Execute test and expect exception
        with pytest.raises(Exception) as exc_info:
            await powerbi_service.get_access_token()

        assert "Network error" in str(exc_info.value)

    def test_token_cache_initialization(self, powerbi_service):
        """Test token cache is properly initialized"""
        assert powerbi_service.token_cache["token"] is None
        assert powerbi_service.token_cache["expires"] is None
        assert powerbi_service.token_cache["refresh_token"] is None

    @pytest.mark.asyncio
    async def test_concurrent_token_requests(self, powerbi_service):
        """Test handling of concurrent token requests"""
        # Mock HTTP response for token request
        mock_response = Mock()
        mock_response.status = 200
        mock_response.json = AsyncMock(return_value={
            "access_token": "test-token",
            "expires_in": 3600
        })

        # Mock session
        mock_session = AsyncMock()
        mock_session.post.return_value.__aenter__.return_value = mock_response
        powerbi_service.session = mock_session

        # Execute concurrent requests
        tasks = [powerbi_service.get_access_token() for _ in range(5)]
        results = await asyncio.gather(*tasks)

        # All should return the same token
        assert all(token == "test-token" for token in results)


if __name__ == "__main__":
    pytest.main([__file__])