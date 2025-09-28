"""
Webhook Validator Utility
Handles webhook signature verification and security validation
"""

import hmac
import hashlib
import json
import logging
from typing import Dict, Any, Optional
from datetime import datetime, timedelta
import base64

logger = logging.getLogger(__name__)


class WebhookValidator:
    """Validates webhook requests from Azure services"""

    def __init__(self, secret_key: str):
        """
        Initialize webhook validator

        Args:
            secret_key: Secret key for webhook signature validation
        """
        self.secret_key = secret_key
        self.max_timestamp_age = 300  # 5 minutes

    def validate_signature(
        self,
        payload: Dict[str, Any],
        signature: str,
        algorithm: str = "sha256"
    ) -> bool:
        """
        Validate webhook signature using HMAC

        Args:
            payload: Webhook payload
            signature: Signature to validate
            algorithm: Hash algorithm (default: sha256)

        Returns:
            True if signature is valid, False otherwise
        """
        try:
            # Convert payload to JSON string (canonical form)
            payload_str = json.dumps(payload, separators=(",", ":"), sort_keys=True)
            payload_bytes = payload_str.encode("utf-8")

            # Calculate expected signature
            if algorithm == "sha256":
                expected_sig = hmac.new(
                    self.secret_key.encode(),
                    payload_bytes,
                    hashlib.sha256
                ).hexdigest()
            elif algorithm == "sha1":
                expected_sig = hmac.new(
                    self.secret_key.encode(),
                    payload_bytes,
                    hashlib.sha1
                ).hexdigest()
            else:
                logger.error(f"Unsupported algorithm: {algorithm}")
                return False

            # Compare signatures (constant time comparison)
            return hmac.compare_digest(expected_sig, signature)

        except Exception as e:
            logger.error(f"Signature validation error: {e}")
            return False

    def validate_azure_signature(
        self,
        payload: str,
        signature: str
    ) -> bool:
        """
        Validate Azure-specific webhook signature

        Args:
            payload: Raw payload string
            signature: Azure signature header value

        Returns:
            True if signature is valid, False otherwise
        """
        try:
            # Azure uses base64 encoded HMAC-SHA256
            payload_bytes = payload.encode("utf-8")

            # Calculate expected signature
            expected_sig_bytes = hmac.new(
                base64.b64decode(self.secret_key),
                payload_bytes,
                hashlib.sha256
            ).digest()

            expected_sig = base64.b64encode(expected_sig_bytes).decode()

            # Compare signatures
            return hmac.compare_digest(expected_sig, signature)

        except Exception as e:
            logger.error(f"Azure signature validation error: {e}")
            return False

    def validate_timestamp(
        self,
        timestamp: str,
        max_age_seconds: Optional[int] = None
    ) -> bool:
        """
        Validate webhook timestamp to prevent replay attacks

        Args:
            timestamp: ISO format timestamp string
            max_age_seconds: Maximum age in seconds (default: 300)

        Returns:
            True if timestamp is within acceptable range, False otherwise
        """
        try:
            max_age = max_age_seconds or self.max_timestamp_age

            # Parse timestamp
            webhook_time = datetime.fromisoformat(timestamp.replace("Z", "+00:00"))
            current_time = datetime.now().replace(tzinfo=webhook_time.tzinfo)

            # Check if timestamp is within acceptable range
            time_diff = abs((current_time - webhook_time).total_seconds())

            if time_diff > max_age:
                logger.warning(f"Webhook timestamp too old: {time_diff} seconds")
                return False

            return True

        except Exception as e:
            logger.error(f"Timestamp validation error: {e}")
            return False

    def validate_logic_app_webhook(
        self,
        headers: Dict[str, str],
        body: str
    ) -> Dict[str, Any]:
        """
        Validate Logic App webhook request

        Args:
            headers: Request headers
            body: Raw request body

        Returns:
            Validation result with status and details
        """
        result = {
            "valid": False,
            "errors": [],
            "warnings": []
        }

        # Check for Logic App specific headers
        logic_app_headers = [
            "x-ms-workflow-id",
            "x-ms-workflow-run-id",
            "x-ms-workflow-operation-name"
        ]

        for header in logic_app_headers:
            if header not in headers:
                result["warnings"].append(f"Missing Logic App header: {header}")

        # Validate signature if present
        if "x-logic-apps-signature" in headers:
            if not self.validate_azure_signature(body, headers["x-logic-apps-signature"]):
                result["errors"].append("Invalid Logic App signature")
                return result

        # Validate content type
        content_type = headers.get("content-type", "")
        if "application/json" not in content_type:
            result["warnings"].append(f"Unexpected content type: {content_type}")

        # Parse and validate body
        try:
            payload = json.loads(body)

            # Check for required fields
            if "workflow_id" not in payload and "x-ms-workflow-id" not in headers:
                result["warnings"].append("No workflow ID found")

            # Validate timestamp if present
            if "timestamp" in payload:
                if not self.validate_timestamp(payload["timestamp"]):
                    result["errors"].append("Timestamp validation failed")
                    return result

            result["valid"] = len(result["errors"]) == 0
            result["payload"] = payload

        except json.JSONDecodeError as e:
            result["errors"].append(f"Invalid JSON payload: {e}")

        return result

    def validate_ai_foundry_webhook(
        self,
        headers: Dict[str, str],
        body: str
    ) -> Dict[str, Any]:
        """
        Validate AI Foundry webhook request

        Args:
            headers: Request headers
            body: Raw request body

        Returns:
            Validation result with status and details
        """
        result = {
            "valid": False,
            "errors": [],
            "warnings": []
        }

        # Check for AI Foundry specific headers
        ai_foundry_headers = [
            "x-ai-foundry-agent-id",
            "x-ai-foundry-project",
            "x-ai-foundry-signature"
        ]

        for header in ai_foundry_headers:
            if header not in headers:
                result["warnings"].append(f"Missing AI Foundry header: {header}")

        # Validate signature if present
        if "x-ai-foundry-signature" in headers:
            if not self.validate_signature(
                json.loads(body),
                headers["x-ai-foundry-signature"]
            ):
                result["errors"].append("Invalid AI Foundry signature")
                return result

        # Parse and validate body
        try:
            payload = json.loads(body)

            # Check for required fields
            required_fields = ["agent_id", "thread_id", "action"]
            for field in required_fields:
                if field not in payload:
                    result["errors"].append(f"Missing required field: {field}")

            # Validate timestamp
            if "timestamp" in payload:
                if not self.validate_timestamp(payload["timestamp"]):
                    result["errors"].append("Timestamp validation failed")
                    return result

            result["valid"] = len(result["errors"]) == 0
            result["payload"] = payload

        except json.JSONDecodeError as e:
            result["errors"].append(f"Invalid JSON payload: {e}")

        return result

    def generate_response_signature(
        self,
        response: Dict[str, Any],
        algorithm: str = "sha256"
    ) -> str:
        """
        Generate signature for webhook response

        Args:
            response: Response payload
            algorithm: Hash algorithm

        Returns:
            Response signature
        """
        try:
            # Add timestamp to response
            response["timestamp"] = datetime.now().isoformat()

            # Convert to JSON string
            response_str = json.dumps(response, separators=(",", ":"), sort_keys=True)
            response_bytes = response_str.encode("utf-8")

            # Generate signature
            if algorithm == "sha256":
                signature = hmac.new(
                    self.secret_key.encode(),
                    response_bytes,
                    hashlib.sha256
                ).hexdigest()
            else:
                signature = hmac.new(
                    self.secret_key.encode(),
                    response_bytes,
                    hashlib.sha1
                ).hexdigest()

            return signature

        except Exception as e:
            logger.error(f"Response signature generation error: {e}")
            return ""

    @staticmethod
    def extract_bearer_token(authorization_header: str) -> Optional[str]:
        """
        Extract bearer token from authorization header

        Args:
            authorization_header: Authorization header value

        Returns:
            Bearer token or None
        """
        if not authorization_header:
            return None

        parts = authorization_header.split()
        if len(parts) == 2 and parts[0].lower() == "bearer":
            return parts[1]

        return None

    def validate_request(
        self,
        webhook_type: str,
        headers: Dict[str, str],
        body: str
    ) -> Dict[str, Any]:
        """
        Validate webhook request based on type

        Args:
            webhook_type: Type of webhook (logic_app, ai_foundry, etc.)
            headers: Request headers
            body: Raw request body

        Returns:
            Validation result
        """
        if webhook_type == "logic_app":
            return self.validate_logic_app_webhook(headers, body)
        elif webhook_type == "ai_foundry":
            return self.validate_ai_foundry_webhook(headers, body)
        else:
            # Generic validation
            try:
                payload = json.loads(body)
                return {
                    "valid": True,
                    "payload": payload,
                    "warnings": [f"No specific validation for webhook type: {webhook_type}"]
                }
            except json.JSONDecodeError as e:
                return {
                    "valid": False,
                    "errors": [f"Invalid JSON: {e}"]
                }