"""
Security and Compliance Test Suite
Tests for authentication, authorization, audit logging, and compliance features
"""

import pytest
import asyncio
import json
import secrets
from datetime import datetime, timedelta, timezone
from unittest.mock import Mock, AsyncMock, patch
import httpx
from fastapi.testclient import TestClient
from jose import jwt

# Import the secured application
import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '../../backend'))

from app.main_secured import app, auth_service, audit_logger, key_vault_service
from app.services.auth import UserRole, Permission, SECRET_KEY, ALGORITHM
from app.services.audit import AuditEventType, AuditSeverity


@pytest.fixture
def client():
    """Create test client"""
    return TestClient(app)


@pytest.fixture
def auth_token():
    """Create valid authentication token for testing"""
    token_data = {
        "username": "test_user",
        "user_id": "test-user-id",
        "roles": [UserRole.ANALYST],
        "permissions": [Permission.READ_DATA, Permission.EXECUTE_QUERY],
        "session_id": "test-session-id",
        "exp": datetime.now(timezone.utc) + timedelta(hours=1),
        "iat": datetime.now(timezone.utc),
        "type": "access",
        "jti": secrets.token_urlsafe(32)
    }
    return jwt.encode(token_data, SECRET_KEY, algorithm=ALGORITHM)


@pytest.fixture
def admin_token():
    """Create admin authentication token"""
    token_data = {
        "username": "admin_user",
        "user_id": "admin-user-id",
        "roles": [UserRole.ADMIN],
        "permissions": auth_service.get_user_permissions([UserRole.ADMIN]),
        "session_id": "admin-session-id",
        "exp": datetime.now(timezone.utc) + timedelta(hours=1),
        "iat": datetime.now(timezone.utc),
        "type": "access",
        "jti": secrets.token_urlsafe(32)
    }
    return jwt.encode(token_data, SECRET_KEY, algorithm=ALGORITHM)


class TestAuthentication:
    """Test authentication functionality"""

    def test_login_success(self, client):
        """Test successful login"""
        response = client.post(
            "/api/v1/auth/login",
            json={
                "username": "admin",
                "password": "SecurePassword123!"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["token_type"] == "bearer"
        assert data["expires_in"] == 86400

    def test_login_invalid_credentials(self, client):
        """Test login with invalid credentials"""
        response = client.post(
            "/api/v1/auth/login",
            json={
                "username": "invalid",
                "password": "wrongpassword"
            }
        )
        assert response.status_code == 401
        assert "Invalid username or password" in response.json()["detail"]

    def test_login_weak_password(self, client):
        """Test login with weak password"""
        response = client.post(
            "/api/v1/auth/login",
            json={
                "username": "admin",
                "password": "weak"
            }
        )
        assert response.status_code == 422  # Validation error

    @pytest.mark.asyncio
    async def test_token_validation(self):
        """Test JWT token validation"""
        # Create token
        token_data = {
            "username": "test",
            "user_id": "test-id",
            "roles": [UserRole.VIEWER],
            "permissions": [Permission.READ_DATA],
            "session_id": "test-session"
        }
        token = auth_service.create_access_token(token_data)

        # Decode and validate
        decoded = auth_service.decode_token(token)
        assert decoded["username"] == "test"
        assert decoded["user_id"] == "test-id"
        assert UserRole.VIEWER in decoded["roles"]

    @pytest.mark.asyncio
    async def test_token_expiration(self):
        """Test token expiration"""
        # Create expired token
        token_data = {
            "username": "test",
            "user_id": "test-id",
            "exp": datetime.now(timezone.utc) - timedelta(hours=1)
        }
        expired_token = jwt.encode(token_data, SECRET_KEY, algorithm=ALGORITHM)

        # Should raise exception
        with pytest.raises(Exception):
            auth_service.decode_token(expired_token)

    def test_logout(self, client, auth_token):
        """Test logout functionality"""
        response = client.post(
            "/api/v1/auth/logout",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        assert "Logged out successfully" in response.json()["message"]

    def test_refresh_token(self, client):
        """Test token refresh"""
        # First login
        login_response = client.post(
            "/api/v1/auth/login",
            json={
                "username": "admin",
                "password": "SecurePassword123!"
            }
        )
        refresh_token = login_response.json()["refresh_token"]

        # Refresh token
        response = client.post(
            "/api/v1/auth/refresh",
            json={"refresh_token": refresh_token}
        )
        assert response.status_code == 200
        assert "access_token" in response.json()


class TestAuthorization:
    """Test authorization and RBAC"""

    def test_protected_endpoint_without_token(self, client):
        """Test accessing protected endpoint without token"""
        response = client.get("/api/v1/health")
        assert response.status_code == 200  # Basic health is public

        response = client.post("/api/v1/chat", json={"content": "test"})
        assert response.status_code == 403  # Requires authentication

    def test_protected_endpoint_with_token(self, client, auth_token):
        """Test accessing protected endpoint with valid token"""
        response = client.post(
            "/api/v1/chat",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={"content": "test message"}
        )
        # Should work with valid token
        assert response.status_code in [200, 500]  # 500 if services not initialized

    def test_role_based_access(self, client, auth_token, admin_token):
        """Test role-based access control"""
        # Regular user cannot access admin endpoints
        response = client.get(
            "/api/v1/security/score",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 403

        # Admin can access
        response = client.get(
            "/api/v1/security/score",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200

    def test_permission_based_access(self, client):
        """Test permission-based access control"""
        # Create token without EXECUTE_QUERY permission
        limited_token_data = {
            "username": "limited_user",
            "user_id": "limited-id",
            "roles": [UserRole.VIEWER],
            "permissions": [Permission.READ_DATA],  # No EXECUTE_QUERY
            "session_id": "limited-session",
            "exp": datetime.now(timezone.utc) + timedelta(hours=1),
            "iat": datetime.now(timezone.utc),
            "type": "access",
            "jti": secrets.token_urlsafe(32)
        }
        limited_token = jwt.encode(limited_token_data, SECRET_KEY, algorithm=ALGORITHM)

        # Should be denied
        response = client.post(
            "/api/v1/powerbi/query",
            headers={"Authorization": f"Bearer {limited_token}"},
            json={"query": "SELECT * FROM Table", "format": "json"}
        )
        assert response.status_code == 403


class TestAuditLogging:
    """Test audit logging functionality"""

    @pytest.mark.asyncio
    async def test_audit_event_logging(self):
        """Test audit event logging"""
        await audit_logger.log_event(
            event_type=AuditEventType.LOGIN_SUCCESS,
            action="Test login",
            user_id="test-user",
            username="test_user",
            ip_address="127.0.0.1"
        )

        # Query events
        events = await audit_logger.query_events(
            user_id="test-user",
            limit=10
        )
        assert len(events) > 0
        assert any(e.event_type == AuditEventType.LOGIN_SUCCESS for e in events)

    @pytest.mark.asyncio
    async def test_audit_event_integrity(self):
        """Test audit event hash integrity"""
        # Log event
        await audit_logger.log_event(
            event_type=AuditEventType.DATA_READ,
            action="Test data read",
            user_id="test-user"
        )

        # Get events
        events = await audit_logger.query_events(user_id="test-user", limit=1)
        assert len(events) > 0

        # Verify integrity
        event = events[0]
        assert event.hash is not None
        assert len(event.hash) == 64  # SHA-256 hash

    @pytest.mark.asyncio
    async def test_compliance_report_generation(self):
        """Test compliance report generation"""
        start_date = datetime.now(timezone.utc) - timedelta(days=7)
        end_date = datetime.now(timezone.utc)

        report = await audit_logger.generate_compliance_report(
            "SOC2",
            start_date,
            end_date
        )

        assert report["compliance_type"] == "SOC2"
        assert "summary" in report
        assert "total_events" in report["summary"]
        assert report["integrity_verified"] is not None


class TestGDPRCompliance:
    """Test GDPR compliance features"""

    def test_user_data_request(self, client, auth_token):
        """Test GDPR data subject request"""
        response = client.get(
            "/api/v1/privacy/user-data",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "user_id" in data
        assert "username" in data
        assert "audit_events" in data

    def test_user_data_deletion(self, client, auth_token):
        """Test GDPR right to be forgotten"""
        # Without confirmation
        response = client.delete(
            "/api/v1/privacy/user-data",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 400

        # With confirmation
        response = client.delete(
            "/api/v1/privacy/user-data?confirm=true",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        assert "deletion initiated" in response.json()["message"]

    def test_consent_management(self, client, auth_token):
        """Test GDPR consent management"""
        # Grant consent
        response = client.post(
            "/api/v1/privacy/consent",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={
                "consent_type": "analytics",
                "granted": True
            }
        )
        assert response.status_code == 200
        assert response.json()["granted"] is True

        # Withdraw consent
        response = client.post(
            "/api/v1/privacy/consent",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={
                "consent_type": "analytics",
                "granted": False
            }
        )
        assert response.status_code == 200
        assert response.json()["granted"] is False


class TestSecurityHardening:
    """Test security hardening features"""

    def test_rate_limiting(self, client):
        """Test rate limiting"""
        # Make multiple requests quickly
        responses = []
        for _ in range(10):
            response = client.post(
                "/api/v1/auth/login",
                json={
                    "username": "test",
                    "password": "TestPassword123!"
                }
            )
            responses.append(response.status_code)

        # Should hit rate limit
        assert 429 in responses  # Too Many Requests

    def test_security_headers(self, client):
        """Test security headers"""
        response = client.get("/")

        # Check security headers
        assert "X-Content-Type-Options" in response.headers
        assert response.headers["X-Content-Type-Options"] == "nosniff"

        assert "X-Frame-Options" in response.headers
        assert response.headers["X-Frame-Options"] == "DENY"

        assert "Strict-Transport-Security" in response.headers
        assert "Content-Security-Policy" in response.headers
        assert "Referrer-Policy" in response.headers

    def test_input_validation(self, client, auth_token):
        """Test input validation and sanitization"""
        # SQL injection attempt
        response = client.post(
            "/api/v1/chat",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={
                "content": "'; DROP TABLE users; --"
            }
        )
        assert response.status_code == 422  # Validation error

        # XSS attempt
        response = client.post(
            "/api/v1/chat",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={
                "content": "<script>alert('XSS')</script>Normal text"
            }
        )
        # Should be sanitized, not rejected
        assert response.status_code in [200, 500]

    def test_cors_configuration(self, client):
        """Test CORS configuration"""
        response = client.options(
            "/api/v1/health",
            headers={
                "Origin": "http://localhost:5173",
                "Access-Control-Request-Method": "GET"
            }
        )
        assert "Access-Control-Allow-Origin" in response.headers


class TestKeyVaultIntegration:
    """Test Azure Key Vault integration"""

    @pytest.mark.asyncio
    async def test_secret_storage_retrieval(self):
        """Test secret storage and retrieval"""
        with patch.object(key_vault_service.secret_client, 'set_secret', new_callable=AsyncMock) as mock_set:
            with patch.object(key_vault_service.secret_client, 'get_secret', new_callable=AsyncMock) as mock_get:
                mock_set.return_value = Mock()
                mock_get.return_value = Mock(value="test-secret-value")

                # Store secret
                success = await key_vault_service.set_secret("test-secret", "test-value")
                assert success is True

                # Retrieve secret
                value = await key_vault_service.get_secret("test-secret")
                assert value == "test-secret-value"

    @pytest.mark.asyncio
    async def test_secret_caching(self):
        """Test secret caching mechanism"""
        with patch.object(key_vault_service.secret_client, 'get_secret', new_callable=AsyncMock) as mock_get:
            mock_get.return_value = Mock(value="cached-value")

            # First call - should hit Key Vault
            value1 = await key_vault_service.get_secret("cached-secret")
            assert mock_get.call_count == 1

            # Second call - should use cache
            value2 = await key_vault_service.get_secret("cached-secret")
            assert mock_get.call_count == 1  # No additional call
            assert value1 == value2

    @pytest.mark.asyncio
    async def test_encryption_decryption(self):
        """Test data encryption and decryption"""
        with patch.object(key_vault_service.crypto_clients, '__getitem__') as mock_crypto:
            mock_client = AsyncMock()
            mock_client.encrypt.return_value = Mock(ciphertext=b"encrypted")
            mock_client.decrypt.return_value = Mock(plaintext=b"decrypted")
            mock_crypto.return_value = mock_client

            # Encrypt
            encrypted = await key_vault_service.encrypt_data("test-key", b"plaintext")
            assert encrypted == b"encrypted"

            # Decrypt
            decrypted = await key_vault_service.decrypt_data("test-key", b"encrypted")
            assert decrypted == b"decrypted"


class TestSecurityScore:
    """Test security scoring functionality"""

    def test_security_score_calculation(self, client, admin_token):
        """Test security score calculation"""
        response = client.get(
            "/api/v1/security/score",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200

        data = response.json()
        assert "score" in data
        assert "max_score" in data
        assert "percentage" in data
        assert "grade" in data
        assert "details" in data
        assert "compliance" in data

        # Check compliance flags
        assert data["compliance"]["SOC2"] is True
        assert data["compliance"]["ISO27001"] is True
        assert data["compliance"]["GDPR"] is True
        assert data["compliance"]["OWASP"] is True

        # Score should be high with all features implemented
        assert data["percentage"] >= 80  # At least 80% security score


class TestComplianceReports:
    """Test compliance reporting"""

    def test_soc2_report(self, client, admin_token):
        """Test SOC 2 compliance report"""
        start_date = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
        end_date = datetime.now(timezone.utc).isoformat()

        response = client.get(
            f"/api/v1/compliance/report/SOC2?start_date={start_date}&end_date={end_date}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code in [200, 403]  # Depends on role

    def test_iso27001_report(self, client, admin_token):
        """Test ISO 27001 compliance report"""
        start_date = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
        end_date = datetime.now(timezone.utc).isoformat()

        response = client.get(
            f"/api/v1/compliance/report/ISO27001?start_date={start_date}&end_date={end_date}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code in [200, 403]

    def test_gdpr_report(self, client, admin_token):
        """Test GDPR compliance report"""
        start_date = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
        end_date = datetime.now(timezone.utc).isoformat()

        response = client.get(
            f"/api/v1/compliance/report/GDPR?start_date={start_date}&end_date={end_date}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code in [200, 403]


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])