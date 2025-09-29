"""
Authentication and Authorization Service
Implements OAuth 2.0 with MSAL, JWT tokens, and RBAC with Azure Entra ID
OWASP Authentication Best Practices Compliant
"""

import os
import json
import secrets
import hashlib
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any, List, Tuple
from functools import wraps
import re

from fastapi import HTTPException, Request, status, Depends
from fastapi.security import OAuth2PasswordBearer, HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from passlib.context import CryptContext
from msal import ConfidentialClientApplication
from pydantic import BaseModel, Field, validator
import redis
from loguru import logger

from app.config import settings


# Security Constants (OWASP compliant)
SECRET_KEY = os.getenv("JWT_SECRET_KEY", secrets.token_urlsafe(64))
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 24
REFRESH_TOKEN_EXPIRE_DAYS = 7
MAX_LOGIN_ATTEMPTS = 5
LOCKOUT_DURATION_MINUTES = 30
PASSWORD_MIN_LENGTH = 12
PASSWORD_COMPLEXITY_REGEX = r"^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]"

# OAuth2 scheme
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/token")
http_bearer = HTTPBearer()

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto", bcrypt__rounds=12)

# Redis client for session management
redis_client = redis.Redis(
    host=os.getenv("REDIS_HOST", "localhost"),
    port=int(os.getenv("REDIS_PORT", 6379)),
    decode_responses=True,
    ssl=os.getenv("REDIS_SSL", "false").lower() == "true"
)


class UserRole:
    """RBAC Role definitions"""
    ADMIN = "admin"
    ANALYST = "analyst"
    VIEWER = "viewer"
    DEVELOPER = "developer"
    AUDITOR = "auditor"


class Permission:
    """Permission definitions for RBAC"""
    READ_DATA = "read:data"
    WRITE_DATA = "write:data"
    DELETE_DATA = "delete:data"
    EXECUTE_QUERY = "execute:query"
    MANAGE_USERS = "manage:users"
    VIEW_AUDIT_LOG = "view:audit"
    CONFIGURE_SYSTEM = "configure:system"
    EXPORT_DATA = "export:data"


# Role-Permission mapping
ROLE_PERMISSIONS = {
    UserRole.ADMIN: [
        Permission.READ_DATA, Permission.WRITE_DATA, Permission.DELETE_DATA,
        Permission.EXECUTE_QUERY, Permission.MANAGE_USERS, Permission.VIEW_AUDIT_LOG,
        Permission.CONFIGURE_SYSTEM, Permission.EXPORT_DATA
    ],
    UserRole.DEVELOPER: [
        Permission.READ_DATA, Permission.WRITE_DATA, Permission.EXECUTE_QUERY,
        Permission.VIEW_AUDIT_LOG, Permission.EXPORT_DATA
    ],
    UserRole.ANALYST: [
        Permission.READ_DATA, Permission.EXECUTE_QUERY, Permission.EXPORT_DATA
    ],
    UserRole.VIEWER: [
        Permission.READ_DATA
    ],
    UserRole.AUDITOR: [
        Permission.READ_DATA, Permission.VIEW_AUDIT_LOG
    ]
}


class TokenData(BaseModel):
    """Token payload model"""
    username: str
    user_id: str
    roles: List[str]
    permissions: List[str]
    session_id: str
    iat: datetime
    exp: datetime


class UserAuth(BaseModel):
    """User authentication model"""
    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=PASSWORD_MIN_LENGTH)
    mfa_token: Optional[str] = None

    @validator('password')
    def validate_password_strength(cls, v):
        """Validate password complexity"""
        if not re.match(PASSWORD_COMPLEXITY_REGEX, v):
            raise ValueError(
                "Password must contain uppercase, lowercase, number, and special character"
            )
        return v


class AuthService:
    """Main authentication service"""

    def __init__(self):
        """Initialize auth service with MSAL client"""
        self.msal_app = None
        self._initialize_msal()

    def _initialize_msal(self):
        """Initialize MSAL for Azure Entra ID integration"""
        try:
            tenant_id = os.getenv("AZURE_TENANT_ID")
            client_id = os.getenv("AZURE_CLIENT_ID")
            client_secret = os.getenv("AZURE_CLIENT_SECRET")

            if all([tenant_id, client_id, client_secret]):
                authority = f"https://login.microsoftonline.com/{tenant_id}"
                self.msal_app = ConfidentialClientApplication(
                    client_id,
                    authority=authority,
                    client_credential=client_secret
                )
                logger.info("MSAL client initialized successfully")
            else:
                logger.warning("Azure credentials not configured, using local auth only")
        except Exception as e:
            logger.error(f"Failed to initialize MSAL: {str(e)}")

    def hash_password(self, password: str) -> str:
        """Hash password using bcrypt with salt"""
        return pwd_context.hash(password)

    def verify_password(self, plain_password: str, hashed_password: str) -> bool:
        """Verify password against hash"""
        return pwd_context.verify(plain_password, hashed_password)

    def _check_login_attempts(self, username: str) -> bool:
        """Check if user is locked out due to failed attempts"""
        key = f"login_attempts:{username}"
        attempts = redis_client.get(key)

        if attempts and int(attempts) >= MAX_LOGIN_ATTEMPTS:
            lockout_key = f"lockout:{username}"
            if redis_client.exists(lockout_key):
                return False
        return True

    def _record_failed_attempt(self, username: str):
        """Record failed login attempt"""
        key = f"login_attempts:{username}"
        attempts = redis_client.incr(key)
        redis_client.expire(key, LOCKOUT_DURATION_MINUTES * 60)

        if attempts >= MAX_LOGIN_ATTEMPTS:
            lockout_key = f"lockout:{username}"
            redis_client.setex(lockout_key, LOCKOUT_DURATION_MINUTES * 60, "1")
            logger.warning(f"User {username} locked out after {MAX_LOGIN_ATTEMPTS} failed attempts")

    def _clear_failed_attempts(self, username: str):
        """Clear failed login attempts on successful login"""
        redis_client.delete(f"login_attempts:{username}")
        redis_client.delete(f"lockout:{username}")

    def create_access_token(self, data: Dict[str, Any]) -> str:
        """Create JWT access token with 24-hour expiration"""
        to_encode = data.copy()
        expire = datetime.now(timezone.utc) + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)
        to_encode.update({
            "exp": expire,
            "iat": datetime.now(timezone.utc),
            "type": "access",
            "jti": secrets.token_urlsafe(32)  # JWT ID for revocation
        })
        return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

    def create_refresh_token(self, data: Dict[str, Any]) -> str:
        """Create JWT refresh token"""
        to_encode = data.copy()
        expire = datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
        to_encode.update({
            "exp": expire,
            "iat": datetime.now(timezone.utc),
            "type": "refresh",
            "jti": secrets.token_urlsafe(32)
        })
        return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

    def decode_token(self, token: str) -> Dict[str, Any]:
        """Decode and validate JWT token"""
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])

            # Check if token is blacklisted
            jti = payload.get("jti")
            if jti and redis_client.exists(f"blacklist:{jti}"):
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Token has been revoked"
                )

            return payload
        except JWTError as e:
            logger.error(f"JWT decode error: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication token"
            )

    def revoke_token(self, token: str):
        """Revoke a token by adding to blacklist"""
        try:
            payload = self.decode_token(token)
            jti = payload.get("jti")
            if jti:
                # Store in blacklist until token expiration
                exp_timestamp = payload.get("exp")
                if exp_timestamp:
                    ttl = exp_timestamp - datetime.now(timezone.utc).timestamp()
                    if ttl > 0:
                        redis_client.setex(f"blacklist:{jti}", int(ttl), "1")
                        logger.info(f"Token {jti} revoked")
        except Exception as e:
            logger.error(f"Failed to revoke token: {str(e)}")

    async def authenticate_azure_user(self, username: str, password: str) -> Optional[Dict]:
        """Authenticate user with Azure Entra ID"""
        if not self.msal_app:
            return None

        try:
            # Acquire token using username/password flow
            result = self.msal_app.acquire_token_by_username_password(
                username,
                password,
                scopes=["https://graph.microsoft.com/.default"]
            )

            if "access_token" in result:
                # Get user details from Microsoft Graph
                import httpx
                async with httpx.AsyncClient() as client:
                    headers = {"Authorization": f"Bearer {result['access_token']}"}
                    response = await client.get(
                        "https://graph.microsoft.com/v1.0/me",
                        headers=headers
                    )
                    if response.status_code == 200:
                        user_data = response.json()
                        return {
                            "user_id": user_data.get("id"),
                            "username": user_data.get("userPrincipalName"),
                            "email": user_data.get("mail"),
                            "display_name": user_data.get("displayName"),
                            "roles": self._get_azure_roles(user_data.get("id"))
                        }
            return None
        except Exception as e:
            logger.error(f"Azure authentication failed: {str(e)}")
            return None

    def _get_azure_roles(self, user_id: str) -> List[str]:
        """Get user roles from Azure Entra ID"""
        # In production, fetch actual roles from Azure
        # For now, return default role
        return [UserRole.ANALYST]

    def get_user_permissions(self, roles: List[str]) -> List[str]:
        """Get permissions based on user roles"""
        permissions = set()
        for role in roles:
            if role in ROLE_PERMISSIONS:
                permissions.update(ROLE_PERMISSIONS[role])
        return list(permissions)

    def create_session(self, user_id: str, metadata: Dict[str, Any]) -> str:
        """Create user session in Redis"""
        session_id = secrets.token_urlsafe(32)
        session_data = {
            "user_id": user_id,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "last_activity": datetime.now(timezone.utc).isoformat(),
            "ip_address": metadata.get("ip_address"),
            "user_agent": metadata.get("user_agent"),
            **metadata
        }

        # Store session with expiration
        redis_client.setex(
            f"session:{session_id}",
            ACCESS_TOKEN_EXPIRE_HOURS * 3600,
            json.dumps(session_data)
        )

        # Add to user's active sessions
        redis_client.sadd(f"user_sessions:{user_id}", session_id)

        return session_id

    def validate_session(self, session_id: str) -> Optional[Dict]:
        """Validate and update session"""
        session_data = redis_client.get(f"session:{session_id}")
        if session_data:
            data = json.loads(session_data)
            # Update last activity
            data["last_activity"] = datetime.now(timezone.utc).isoformat()
            redis_client.setex(
                f"session:{session_id}",
                ACCESS_TOKEN_EXPIRE_HOURS * 3600,
                json.dumps(data)
            )
            return data
        return None

    def terminate_session(self, session_id: str):
        """Terminate user session"""
        session_data = redis_client.get(f"session:{session_id}")
        if session_data:
            data = json.loads(session_data)
            user_id = data.get("user_id")

            # Remove session
            redis_client.delete(f"session:{session_id}")

            # Remove from user's active sessions
            if user_id:
                redis_client.srem(f"user_sessions:{user_id}", session_id)

            logger.info(f"Session {session_id} terminated")

    def terminate_all_sessions(self, user_id: str):
        """Terminate all sessions for a user"""
        sessions = redis_client.smembers(f"user_sessions:{user_id}")
        for session_id in sessions:
            redis_client.delete(f"session:{session_id}")
        redis_client.delete(f"user_sessions:{user_id}")
        logger.info(f"All sessions terminated for user {user_id}")


# Singleton instance
auth_service = AuthService()


# Dependency functions for FastAPI
async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(http_bearer)
) -> TokenData:
    """Get current authenticated user from JWT token"""
    token = credentials.credentials

    try:
        payload = auth_service.decode_token(token)

        # Validate session
        session_id = payload.get("session_id")
        if session_id:
            session = auth_service.validate_session(session_id)
            if not session:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Session expired or invalid"
                )

        return TokenData(
            username=payload.get("username"),
            user_id=payload.get("user_id"),
            roles=payload.get("roles", []),
            permissions=payload.get("permissions", []),
            session_id=session_id,
            iat=datetime.fromtimestamp(payload.get("iat"), tz=timezone.utc),
            exp=datetime.fromtimestamp(payload.get("exp"), tz=timezone.utc)
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Authentication error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials"
        )


def require_permission(permission: str):
    """Decorator to check if user has required permission"""
    async def permission_checker(user: TokenData = Depends(get_current_user)):
        if permission not in user.permissions:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permission denied. Required: {permission}"
            )
        return user
    return permission_checker


def require_role(role: str):
    """Decorator to check if user has required role"""
    async def role_checker(user: TokenData = Depends(get_current_user)):
        if role not in user.roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role denied. Required: {role}"
            )
        return user
    return role_checker


# Security headers middleware
async def add_security_headers(request: Request, call_next):
    """Add security headers to all responses"""
    response = await call_next(request)

    # OWASP recommended security headers
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; "
        "script-src 'self' 'unsafe-inline' 'unsafe-eval'; "
        "style-src 'self' 'unsafe-inline'; "
        "img-src 'self' data: https:; "
        "font-src 'self' data:; "
        "connect-src 'self' wss: https:;"
    )
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = (
        "geolocation=(), microphone=(), camera=(), "
        "magnetometer=(), gyroscope=(), fullscreen=(self)"
    )

    return response