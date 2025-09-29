"""
Azure Key Vault Integration Service
Secure secrets management with Azure Key Vault
"""

import os
import json
from typing import Optional, Dict, Any, List
from datetime import datetime, timezone
import asyncio
from functools import lru_cache

from azure.keyvault.secrets.aio import SecretClient
from azure.keyvault.keys.aio import KeyClient
from azure.keyvault.keys.crypto.aio import CryptographyClient
from azure.identity.aio import DefaultAzureCredential, ClientSecretCredential
from azure.core.exceptions import AzureError, ResourceNotFoundError
from loguru import logger
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2
import secrets
import base64

from app.services.audit import audit_logger, AuditEventType, AuditSeverity


class KeyVaultService:
    """Azure Key Vault service for secure secrets management"""

    def __init__(self):
        """Initialize Key Vault service"""
        self.vault_url = os.getenv("AZURE_KEY_VAULT_URL")
        self.tenant_id = os.getenv("AZURE_TENANT_ID")
        self.client_id = os.getenv("AZURE_CLIENT_ID")
        self.client_secret = os.getenv("AZURE_CLIENT_SECRET")

        self.secret_client: Optional[SecretClient] = None
        self.key_client: Optional[KeyClient] = None
        self.crypto_clients: Dict[str, CryptographyClient] = {}
        self.credential = None

        # Local cache for frequently accessed secrets (with TTL)
        self._secret_cache: Dict[str, Dict[str, Any]] = {}
        self._cache_ttl_seconds = int(os.getenv("KEY_VAULT_CACHE_TTL", 300))  # 5 minutes

        # Encryption for local cache
        self._cache_key = self._generate_cache_key()
        self._aesgcm = AESGCM(self._cache_key)

        # Initialize if credentials are available
        if self.vault_url and all([self.tenant_id, self.client_id, self.client_secret]):
            asyncio.create_task(self.initialize())

    def _generate_cache_key(self) -> bytes:
        """Generate encryption key for local cache"""
        password = os.getenv("CACHE_ENCRYPTION_PASSWORD", secrets.token_urlsafe(32))
        salt = os.getenv("CACHE_ENCRYPTION_SALT", secrets.token_bytes(16))

        kdf = PBKDF2(
            algorithm=hashes.SHA256(),
            length=32,
            salt=salt if isinstance(salt, bytes) else salt.encode(),
            iterations=100000,
        )

        key = kdf.derive(password.encode() if isinstance(password, str) else password)
        return key

    async def initialize(self):
        """Initialize Azure Key Vault clients"""
        try:
            # Create credential
            if self.client_id and self.client_secret:
                self.credential = ClientSecretCredential(
                    tenant_id=self.tenant_id,
                    client_id=self.client_id,
                    client_secret=self.client_secret
                )
            else:
                self.credential = DefaultAzureCredential()

            # Initialize clients
            self.secret_client = SecretClient(
                vault_url=self.vault_url,
                credential=self.credential
            )

            self.key_client = KeyClient(
                vault_url=self.vault_url,
                credential=self.credential
            )

            logger.info(f"Azure Key Vault initialized: {self.vault_url}")

            # Log initialization
            await audit_logger.log_event(
                event_type=AuditEventType.SERVICE_STARTED,
                action="Azure Key Vault service initialized",
                details={"vault_url": self.vault_url}
            )

        except Exception as e:
            logger.error(f"Failed to initialize Azure Key Vault: {str(e)}")
            await audit_logger.log_event(
                event_type=AuditEventType.ERROR_OCCURRED,
                action="Key Vault initialization failed",
                severity=AuditSeverity.HIGH,
                error_message=str(e)
            )

    def _encrypt_for_cache(self, data: str) -> str:
        """Encrypt data for local cache"""
        nonce = secrets.token_bytes(12)
        encrypted = self._aesgcm.encrypt(nonce, data.encode(), None)
        return base64.b64encode(nonce + encrypted).decode()

    def _decrypt_from_cache(self, encrypted_data: str) -> str:
        """Decrypt data from local cache"""
        data = base64.b64decode(encrypted_data)
        nonce = data[:12]
        ciphertext = data[12:]
        decrypted = self._aesgcm.decrypt(nonce, ciphertext, None)
        return decrypted.decode()

    async def get_secret(
        self,
        secret_name: str,
        version: Optional[str] = None,
        use_cache: bool = True
    ) -> Optional[str]:
        """Get secret from Key Vault with caching"""
        if not self.secret_client:
            logger.warning("Key Vault not initialized, using environment variable")
            return os.getenv(secret_name.upper().replace("-", "_"))

        try:
            # Check cache first
            if use_cache and secret_name in self._secret_cache:
                cached = self._secret_cache[secret_name]
                if (datetime.now(timezone.utc) - cached["timestamp"]).total_seconds() < self._cache_ttl_seconds:
                    return self._decrypt_from_cache(cached["value"])

            # Get from Key Vault
            secret = await self.secret_client.get_secret(secret_name, version=version)

            # Cache encrypted value
            if use_cache:
                self._secret_cache[secret_name] = {
                    "value": self._encrypt_for_cache(secret.value),
                    "timestamp": datetime.now(timezone.utc)
                }

            # Log secret access
            await audit_logger.log_event(
                event_type=AuditEventType.DATA_READ,
                action="Secret retrieved from Key Vault",
                resource_type="secret",
                resource_id=secret_name,
                data_classification="restricted"
            )

            return secret.value

        except ResourceNotFoundError:
            logger.warning(f"Secret not found: {secret_name}")
            return None
        except Exception as e:
            logger.error(f"Failed to get secret {secret_name}: {str(e)}")
            await audit_logger.log_event(
                event_type=AuditEventType.ERROR_OCCURRED,
                action="Failed to retrieve secret",
                severity=AuditSeverity.HIGH,
                resource_id=secret_name,
                error_message=str(e)
            )
            return None

    async def set_secret(
        self,
        secret_name: str,
        secret_value: str,
        content_type: Optional[str] = None,
        tags: Optional[Dict[str, str]] = None
    ) -> bool:
        """Set secret in Key Vault"""
        if not self.secret_client:
            logger.error("Key Vault not initialized")
            return False

        try:
            await self.secret_client.set_secret(
                secret_name,
                secret_value,
                content_type=content_type,
                tags=tags
            )

            # Clear cache for this secret
            if secret_name in self._secret_cache:
                del self._secret_cache[secret_name]

            # Log secret creation/update
            await audit_logger.log_event(
                event_type=AuditEventType.CONFIG_CHANGED,
                action="Secret created/updated in Key Vault",
                severity=AuditSeverity.MEDIUM,
                resource_type="secret",
                resource_id=secret_name,
                data_classification="restricted"
            )

            return True

        except Exception as e:
            logger.error(f"Failed to set secret {secret_name}: {str(e)}")
            await audit_logger.log_event(
                event_type=AuditEventType.ERROR_OCCURRED,
                action="Failed to set secret",
                severity=AuditSeverity.HIGH,
                resource_id=secret_name,
                error_message=str(e)
            )
            return False

    async def delete_secret(self, secret_name: str) -> bool:
        """Delete secret from Key Vault"""
        if not self.secret_client:
            logger.error("Key Vault not initialized")
            return False

        try:
            await self.secret_client.begin_delete_secret(secret_name)

            # Clear cache
            if secret_name in self._secret_cache:
                del self._secret_cache[secret_name]

            # Log secret deletion
            await audit_logger.log_event(
                event_type=AuditEventType.DATA_DELETE,
                action="Secret deleted from Key Vault",
                severity=AuditSeverity.HIGH,
                resource_type="secret",
                resource_id=secret_name,
                data_classification="restricted"
            )

            return True

        except Exception as e:
            logger.error(f"Failed to delete secret {secret_name}: {str(e)}")
            return False

    async def list_secrets(self) -> List[Dict[str, Any]]:
        """List all secrets in Key Vault"""
        if not self.secret_client:
            logger.error("Key Vault not initialized")
            return []

        try:
            secrets = []
            async for secret_properties in self.secret_client.list_properties_of_secrets():
                secrets.append({
                    "name": secret_properties.name,
                    "enabled": secret_properties.enabled,
                    "created_on": secret_properties.created_on.isoformat() if secret_properties.created_on else None,
                    "updated_on": secret_properties.updated_on.isoformat() if secret_properties.updated_on else None,
                    "tags": secret_properties.tags
                })

            return secrets

        except Exception as e:
            logger.error(f"Failed to list secrets: {str(e)}")
            return []

    async def create_key(
        self,
        key_name: str,
        key_type: str = "RSA",
        key_size: int = 2048
    ) -> bool:
        """Create encryption key in Key Vault"""
        if not self.key_client:
            logger.error("Key Vault not initialized")
            return False

        try:
            key = await self.key_client.create_key(
                key_name,
                key_type,
                size=key_size
            )

            # Create crypto client for this key
            self.crypto_clients[key_name] = CryptographyClient(
                key,
                credential=self.credential
            )

            # Log key creation
            await audit_logger.log_event(
                event_type=AuditEventType.CONFIG_CHANGED,
                action="Encryption key created in Key Vault",
                severity=AuditSeverity.HIGH,
                resource_type="key",
                resource_id=key_name,
                details={"key_type": key_type, "key_size": key_size}
            )

            return True

        except Exception as e:
            logger.error(f"Failed to create key {key_name}: {str(e)}")
            return False

    async def encrypt_data(
        self,
        key_name: str,
        plaintext: bytes,
        algorithm: str = "RSA-OAEP"
    ) -> Optional[bytes]:
        """Encrypt data using Key Vault key"""
        try:
            # Get or create crypto client
            if key_name not in self.crypto_clients:
                key = await self.key_client.get_key(key_name)
                self.crypto_clients[key_name] = CryptographyClient(
                    key,
                    credential=self.credential
                )

            crypto_client = self.crypto_clients[key_name]
            result = await crypto_client.encrypt(algorithm, plaintext)

            return result.ciphertext

        except Exception as e:
            logger.error(f"Failed to encrypt data with key {key_name}: {str(e)}")
            return None

    async def decrypt_data(
        self,
        key_name: str,
        ciphertext: bytes,
        algorithm: str = "RSA-OAEP"
    ) -> Optional[bytes]:
        """Decrypt data using Key Vault key"""
        try:
            # Get or create crypto client
            if key_name not in self.crypto_clients:
                key = await self.key_client.get_key(key_name)
                self.crypto_clients[key_name] = CryptographyClient(
                    key,
                    credential=self.credential
                )

            crypto_client = self.crypto_clients[key_name]
            result = await crypto_client.decrypt(algorithm, ciphertext)

            return result.plaintext

        except Exception as e:
            logger.error(f"Failed to decrypt data with key {key_name}: {str(e)}")
            return None

    async def rotate_secrets(self) -> Dict[str, bool]:
        """Rotate all secrets in Key Vault"""
        results = {}

        try:
            # Get list of secrets to rotate
            secrets_list = await self.list_secrets()

            for secret_info in secrets_list:
                secret_name = secret_info["name"]

                # Skip system secrets
                if secret_name.startswith("system-") or secret_name.startswith("azure-"):
                    continue

                try:
                    # Generate new secret value
                    new_value = secrets.token_urlsafe(32)

                    # Set new secret value
                    success = await self.set_secret(
                        secret_name,
                        new_value,
                        tags={"rotated": datetime.now(timezone.utc).isoformat()}
                    )

                    results[secret_name] = success

                    if success:
                        await audit_logger.log_event(
                            event_type=AuditEventType.CONFIG_CHANGED,
                            action=f"Secret rotated: {secret_name}",
                            severity=AuditSeverity.MEDIUM,
                            resource_type="secret",
                            resource_id=secret_name
                        )

                except Exception as e:
                    logger.error(f"Failed to rotate secret {secret_name}: {str(e)}")
                    results[secret_name] = False

        except Exception as e:
            logger.error(f"Secret rotation failed: {str(e)}")

        return results

    async def get_connection_string(self, service_name: str) -> Optional[str]:
        """Get connection string from Key Vault"""
        secret_name = f"{service_name}-connection-string"
        return await self.get_secret(secret_name)

    async def get_api_key(self, service_name: str) -> Optional[str]:
        """Get API key from Key Vault"""
        secret_name = f"{service_name}-api-key"
        return await self.get_secret(secret_name)

    async def store_certificate(
        self,
        cert_name: str,
        cert_value: str,
        password: Optional[str] = None
    ) -> bool:
        """Store certificate in Key Vault"""
        try:
            # Store certificate as secret
            cert_data = {
                "certificate": cert_value,
                "password": password
            }

            return await self.set_secret(
                f"cert-{cert_name}",
                json.dumps(cert_data),
                content_type="application/x-pkcs12"
            )

        except Exception as e:
            logger.error(f"Failed to store certificate {cert_name}: {str(e)}")
            return False

    async def cleanup(self):
        """Cleanup Key Vault connections"""
        try:
            # Clear cache
            self._secret_cache.clear()

            # Close clients
            if self.secret_client:
                await self.secret_client.close()
            if self.key_client:
                await self.key_client.close()

            for crypto_client in self.crypto_clients.values():
                await crypto_client.close()

            if self.credential:
                await self.credential.close()

            logger.info("Key Vault service cleaned up")

        except Exception as e:
            logger.error(f"Key Vault cleanup error: {str(e)}")


# Singleton instance
key_vault_service = KeyVaultService()


# Helper function to get secrets with fallback
async def get_secret_or_env(name: str, env_name: Optional[str] = None) -> Optional[str]:
    """Get secret from Key Vault or fall back to environment variable"""
    # Try Key Vault first
    secret = await key_vault_service.get_secret(name)
    if secret:
        return secret

    # Fall back to environment variable
    if env_name:
        return os.getenv(env_name)

    # Try converting name to env variable format
    env_var = name.upper().replace("-", "_")
    return os.getenv(env_var)