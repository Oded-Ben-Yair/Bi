"""
Audit Logging Service for SOC 2 Type 2 and ISO 27001 Compliance
Implements comprehensive audit trail for all system activities
"""

import os
import json
import hashlib
import uuid
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List
from enum import Enum
import asyncio
from contextlib import asynccontextmanager

import redis
from loguru import logger
from pydantic import BaseModel, Field
import httpx

from app.config import settings


class AuditEventType(str, Enum):
    """Audit event types for SOC 2 compliance"""
    # Authentication Events
    LOGIN_SUCCESS = "auth.login.success"
    LOGIN_FAILURE = "auth.login.failure"
    LOGOUT = "auth.logout"
    SESSION_CREATED = "auth.session.created"
    SESSION_EXPIRED = "auth.session.expired"
    PASSWORD_CHANGED = "auth.password.changed"
    MFA_ENABLED = "auth.mfa.enabled"
    MFA_DISABLED = "auth.mfa.disabled"

    # Data Access Events
    DATA_READ = "data.read"
    DATA_WRITE = "data.write"
    DATA_DELETE = "data.delete"
    DATA_EXPORT = "data.export"
    QUERY_EXECUTED = "data.query.executed"

    # User Management Events
    USER_CREATED = "user.created"
    USER_UPDATED = "user.updated"
    USER_DELETED = "user.deleted"
    ROLE_ASSIGNED = "user.role.assigned"
    ROLE_REVOKED = "user.role.revoked"
    PERMISSION_GRANTED = "user.permission.granted"
    PERMISSION_REVOKED = "user.permission.revoked"

    # System Events
    CONFIG_CHANGED = "system.config.changed"
    SERVICE_STARTED = "system.service.started"
    SERVICE_STOPPED = "system.service.stopped"
    ERROR_OCCURRED = "system.error"
    SECURITY_ALERT = "system.security.alert"

    # Compliance Events
    GDPR_CONSENT_GIVEN = "compliance.gdpr.consent.given"
    GDPR_CONSENT_WITHDRAWN = "compliance.gdpr.consent.withdrawn"
    GDPR_DATA_REQUESTED = "compliance.gdpr.data.requested"
    GDPR_DATA_DELETED = "compliance.gdpr.data.deleted"
    AUDIT_ACCESSED = "compliance.audit.accessed"


class AuditSeverity(str, Enum):
    """Audit event severity levels"""
    INFO = "info"
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class AuditEvent(BaseModel):
    """Audit event model for SOC 2 compliance"""
    event_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    event_type: AuditEventType
    severity: AuditSeverity
    user_id: Optional[str] = None
    username: Optional[str] = None
    session_id: Optional[str] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    resource_type: Optional[str] = None
    resource_id: Optional[str] = None
    action: str
    result: str  # success, failure, error
    details: Dict[str, Any] = Field(default_factory=dict)
    error_message: Optional[str] = None
    data_classification: Optional[str] = None  # public, internal, confidential, restricted
    compliance_tags: List[str] = Field(default_factory=list)
    hash: Optional[str] = None  # Integrity hash for tamper detection


class AuditLogger:
    """Main audit logging service with SOC 2 Type 2 compliance"""

    def __init__(self):
        """Initialize audit logger with Redis and optional external logging"""
        self.redis_client = redis.Redis(
            host=os.getenv("REDIS_HOST", "localhost"),
            port=int(os.getenv("REDIS_PORT", 6379)),
            decode_responses=True,
            ssl=os.getenv("REDIS_SSL", "false").lower() == "true"
        )

        # External audit service endpoint (e.g., Splunk, ELK, Azure Monitor)
        self.external_endpoint = os.getenv("AUDIT_EXTERNAL_ENDPOINT")
        self.external_api_key = os.getenv("AUDIT_EXTERNAL_API_KEY")

        # Retention settings
        self.retention_days = int(os.getenv("AUDIT_RETENTION_DAYS", 2555))  # 7 years for SOC 2
        self.batch_size = int(os.getenv("AUDIT_BATCH_SIZE", 100))

        # Start background processor
        self.processing = True
        self._start_background_processor()

    def _calculate_event_hash(self, event: AuditEvent) -> str:
        """Calculate integrity hash for audit event"""
        # Create a deterministic string representation
        hash_data = f"{event.event_id}:{event.timestamp.isoformat()}:{event.event_type}:{event.action}:{event.result}"
        if event.user_id:
            hash_data += f":{event.user_id}"

        # Add previous event hash for chain integrity
        last_hash = self.redis_client.get("audit:last_hash")
        if last_hash:
            hash_data += f":{last_hash}"

        # Calculate SHA-256 hash
        return hashlib.sha256(hash_data.encode()).hexdigest()

    async def log_event(
        self,
        event_type: AuditEventType,
        action: str,
        result: str = "success",
        severity: AuditSeverity = AuditSeverity.INFO,
        user_id: Optional[str] = None,
        username: Optional[str] = None,
        session_id: Optional[str] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        resource_type: Optional[str] = None,
        resource_id: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None,
        error_message: Optional[str] = None,
        data_classification: Optional[str] = None,
        compliance_tags: Optional[List[str]] = None
    ):
        """Log an audit event with full SOC 2 compliance"""
        try:
            # Create audit event
            event = AuditEvent(
                event_type=event_type,
                severity=severity,
                user_id=user_id,
                username=username,
                session_id=session_id,
                ip_address=ip_address,
                user_agent=user_agent,
                resource_type=resource_type,
                resource_id=resource_id,
                action=action,
                result=result,
                details=details or {},
                error_message=error_message,
                data_classification=data_classification,
                compliance_tags=compliance_tags or []
            )

            # Calculate integrity hash
            event.hash = self._calculate_event_hash(event)

            # Store in Redis with expiration
            event_key = f"audit:event:{event.event_id}"
            self.redis_client.setex(
                event_key,
                self.retention_days * 86400,
                event.model_dump_json()
            )

            # Update last hash for chain integrity
            self.redis_client.set("audit:last_hash", event.hash)

            # Add to processing queue
            self.redis_client.lpush("audit:queue", event.event_id)

            # Add to user's audit trail
            if user_id:
                user_key = f"audit:user:{user_id}"
                self.redis_client.zadd(
                    user_key,
                    {event.event_id: event.timestamp.timestamp()}
                )
                self.redis_client.expire(user_key, self.retention_days * 86400)

            # Add to daily index for compliance reporting
            date_key = f"audit:date:{event.timestamp.date().isoformat()}"
            self.redis_client.zadd(
                date_key,
                {event.event_id: event.timestamp.timestamp()}
            )
            self.redis_client.expire(date_key, self.retention_days * 86400)

            # Log critical events immediately
            if severity in [AuditSeverity.HIGH, AuditSeverity.CRITICAL]:
                await self._send_to_external(event)
                logger.warning(f"Critical audit event: {event_type} - {action}")

            logger.debug(f"Audit event logged: {event.event_id}")

        except Exception as e:
            logger.error(f"Failed to log audit event: {str(e)}")
            # Fall back to file logging for critical events
            self._fallback_log(event_type, action, str(e))

    def _fallback_log(self, event_type: str, action: str, error: str):
        """Fallback logging to file when Redis fails"""
        try:
            with open("/var/log/seekapa_audit_fallback.log", "a") as f:
                f.write(f"{datetime.now(timezone.utc).isoformat()} - {event_type} - {action} - ERROR: {error}\n")
        except:
            logger.critical(f"Audit logging failed completely: {event_type} - {action}")

    async def _send_to_external(self, event: AuditEvent):
        """Send audit event to external logging service"""
        if not self.external_endpoint:
            return

        try:
            async with httpx.AsyncClient() as client:
                headers = {}
                if self.external_api_key:
                    headers["Authorization"] = f"Bearer {self.external_api_key}"

                response = await client.post(
                    self.external_endpoint,
                    json=event.model_dump(mode="json", exclude_none=True),
                    headers=headers,
                    timeout=5.0
                )

                if response.status_code not in [200, 201, 202]:
                    logger.error(f"External audit log failed: {response.status_code}")

        except Exception as e:
            logger.error(f"Failed to send to external audit: {str(e)}")

    def _start_background_processor(self):
        """Start background processor for batch sending"""
        asyncio.create_task(self._process_queue())

    async def _process_queue(self):
        """Process audit queue in batches"""
        while self.processing:
            try:
                # Get batch of events
                batch = []
                for _ in range(self.batch_size):
                    event_id = self.redis_client.rpop("audit:queue")
                    if not event_id:
                        break

                    event_data = self.redis_client.get(f"audit:event:{event_id}")
                    if event_data:
                        batch.append(json.loads(event_data))

                # Send batch to external service
                if batch and self.external_endpoint:
                    await self._send_batch_to_external(batch)

                # Sleep before next batch
                await asyncio.sleep(10)

            except Exception as e:
                logger.error(f"Audit queue processor error: {str(e)}")
                await asyncio.sleep(30)

    async def _send_batch_to_external(self, events: List[Dict]):
        """Send batch of events to external service"""
        try:
            async with httpx.AsyncClient() as client:
                headers = {}
                if self.external_api_key:
                    headers["Authorization"] = f"Bearer {self.external_api_key}"

                response = await client.post(
                    f"{self.external_endpoint}/batch",
                    json={"events": events},
                    headers=headers,
                    timeout=30.0
                )

                if response.status_code not in [200, 201, 202]:
                    logger.error(f"Batch audit log failed: {response.status_code}")
                    # Re-queue failed events
                    for event in events:
                        self.redis_client.lpush("audit:queue", event.get("event_id"))

        except Exception as e:
            logger.error(f"Failed to send batch to external: {str(e)}")
            # Re-queue failed events
            for event in events:
                self.redis_client.lpush("audit:queue", event.get("event_id"))

    async def query_events(
        self,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        event_type: Optional[AuditEventType] = None,
        user_id: Optional[str] = None,
        severity: Optional[AuditSeverity] = None,
        limit: int = 100,
        offset: int = 0
    ) -> List[AuditEvent]:
        """Query audit events for compliance reporting"""
        events = []

        try:
            if user_id:
                # Query by user
                key = f"audit:user:{user_id}"
                event_ids = self.redis_client.zrevrange(key, offset, offset + limit - 1)
            elif start_date and end_date:
                # Query by date range
                event_ids = []
                current = start_date.date()
                while current <= end_date.date():
                    date_key = f"audit:date:{current.isoformat()}"
                    day_events = self.redis_client.zrevrange(date_key, 0, -1)
                    event_ids.extend(day_events)
                    current = current + timedelta(days=1)
                # Apply limit and offset
                event_ids = event_ids[offset:offset + limit]
            else:
                # Recent events
                event_ids = []
                for i in range(7):  # Last 7 days
                    date = (datetime.now(timezone.utc) - timedelta(days=i)).date()
                    date_key = f"audit:date:{date.isoformat()}"
                    day_events = self.redis_client.zrevrange(date_key, 0, limit)
                    event_ids.extend(day_events)
                    if len(event_ids) >= limit:
                        break

            # Retrieve and filter events
            for event_id in event_ids[:limit]:
                event_data = self.redis_client.get(f"audit:event:{event_id}")
                if event_data:
                    event = AuditEvent.model_validate_json(event_data)

                    # Apply filters
                    if event_type and event.event_type != event_type:
                        continue
                    if severity and event.severity != severity:
                        continue

                    events.append(event)

        except Exception as e:
            logger.error(f"Failed to query audit events: {str(e)}")

        return events

    async def generate_compliance_report(
        self,
        compliance_type: str,
        start_date: datetime,
        end_date: datetime
    ) -> Dict[str, Any]:
        """Generate compliance report for SOC 2 or ISO 27001"""
        report = {
            "compliance_type": compliance_type,
            "period": {
                "start": start_date.isoformat(),
                "end": end_date.isoformat()
            },
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "summary": {},
            "details": []
        }

        try:
            # Get all events in period
            events = await self.query_events(
                start_date=start_date,
                end_date=end_date,
                limit=10000
            )

            # Calculate statistics
            report["summary"] = {
                "total_events": len(events),
                "login_attempts": sum(1 for e in events if e.event_type in [
                    AuditEventType.LOGIN_SUCCESS, AuditEventType.LOGIN_FAILURE
                ]),
                "failed_logins": sum(1 for e in events if e.event_type == AuditEventType.LOGIN_FAILURE),
                "data_access_events": sum(1 for e in events if e.event_type.startswith("data.")),
                "security_alerts": sum(1 for e in events if e.event_type == AuditEventType.SECURITY_ALERT),
                "configuration_changes": sum(1 for e in events if e.event_type == AuditEventType.CONFIG_CHANGED),
                "gdpr_events": sum(1 for e in events if e.event_type.startswith("compliance.gdpr"))
            }

            # Group by severity
            severity_counts = {}
            for event in events:
                severity_counts[event.severity] = severity_counts.get(event.severity, 0) + 1
            report["summary"]["by_severity"] = severity_counts

            # Add critical events to details
            critical_events = [e for e in events if e.severity in [AuditSeverity.HIGH, AuditSeverity.CRITICAL]]
            report["details"] = [e.model_dump(mode="json") for e in critical_events[:100]]

            # Verify audit trail integrity
            report["integrity_verified"] = await self._verify_integrity(events)

        except Exception as e:
            logger.error(f"Failed to generate compliance report: {str(e)}")
            report["error"] = str(e)

        return report

    async def _verify_integrity(self, events: List[AuditEvent]) -> bool:
        """Verify audit trail integrity using hash chain"""
        try:
            previous_hash = None
            for event in sorted(events, key=lambda e: e.timestamp):
                # Recalculate hash
                expected_hash = self._calculate_event_hash(event)
                if event.hash != expected_hash:
                    logger.error(f"Integrity check failed for event {event.event_id}")
                    return False
            return True
        except Exception as e:
            logger.error(f"Integrity verification failed: {str(e)}")
            return False

    async def cleanup(self):
        """Cleanup audit service"""
        self.processing = False
        logger.info("Audit service cleanup completed")


# Singleton instance
audit_logger = AuditLogger()


# Decorator for automatic audit logging
def audit_action(
    event_type: AuditEventType,
    resource_type: Optional[str] = None,
    data_classification: Optional[str] = None,
    compliance_tags: Optional[List[str]] = None
):
    """Decorator to automatically log API actions"""
    def decorator(func):
        async def wrapper(*args, **kwargs):
            # Extract request context
            request = kwargs.get("request")
            user = kwargs.get("current_user")

            # Log start of action
            await audit_logger.log_event(
                event_type=event_type,
                action=f"{func.__name__} started",
                user_id=user.user_id if user else None,
                username=user.username if user else None,
                session_id=user.session_id if user else None,
                ip_address=request.client.host if request else None,
                user_agent=request.headers.get("user-agent") if request else None,
                resource_type=resource_type,
                data_classification=data_classification,
                compliance_tags=compliance_tags
            )

            try:
                # Execute function
                result = await func(*args, **kwargs)

                # Log success
                await audit_logger.log_event(
                    event_type=event_type,
                    action=f"{func.__name__} completed",
                    result="success",
                    user_id=user.user_id if user else None,
                    username=user.username if user else None,
                    session_id=user.session_id if user else None,
                    resource_type=resource_type
                )

                return result

            except Exception as e:
                # Log failure
                await audit_logger.log_event(
                    event_type=event_type,
                    action=f"{func.__name__} failed",
                    result="failure",
                    severity=AuditSeverity.HIGH,
                    user_id=user.user_id if user else None,
                    username=user.username if user else None,
                    session_id=user.session_id if user else None,
                    error_message=str(e),
                    resource_type=resource_type
                )
                raise

        return wrapper
    return decorator