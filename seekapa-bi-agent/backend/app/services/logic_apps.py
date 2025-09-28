"""
Azure Logic Apps Service
Handles Logic App triggers, webhooks, and workflow orchestration
"""

import asyncio
import json
import hmac
import hashlib
import logging
from typing import Dict, List, Any, Optional
from datetime import datetime
import aiohttp
from enum import Enum

from app.config import settings

logger = logging.getLogger(__name__)


class WorkflowStatus(Enum):
    """Workflow execution status"""
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class LogicAppsService:
    """Service for Azure Logic Apps integration"""

    def __init__(self):
        self.logic_app_url = settings.AZURE_LOGIC_APP_URL
        self.logic_app_key = settings.AZURE_LOGIC_APP_KEY
        self.workspace_id = settings.POWERBI_WORKSPACE_ID
        self.session: Optional[aiohttp.ClientSession] = None
        self.workflows: Dict[str, Dict] = {}
        self.webhook_subscriptions: Dict[str, List[str]] = {}

    async def initialize(self):
        """Initialize the Logic Apps service"""
        if not self.session:
            timeout = aiohttp.ClientTimeout(total=30)
            self.session = aiohttp.ClientSession(timeout=timeout)

        # Register default webhooks
        await self._register_default_webhooks()

        logger.info("Logic Apps Service initialized")

    async def cleanup(self):
        """Cleanup resources"""
        if self.session:
            await self.session.close()

    async def _register_default_webhooks(self):
        """Register default webhook endpoints"""
        self.webhook_subscriptions = {
            "data_refresh": ["corppowerbiai"],
            "report_generation": ["corppowerbiai"],
            "alert_trigger": ["corppowerbiai"],
            "analysis_complete": ["corppowerbiai"]
        }

    async def trigger_workflow(
        self,
        workflow_name: str,
        payload: Dict[str, Any],
        wait_for_response: bool = True,
        timeout: int = 30
    ) -> Dict[str, Any]:
        """
        Trigger a Logic App workflow

        Args:
            workflow_name: Name of the Logic App workflow
            payload: Payload to send to the workflow
            wait_for_response: Whether to wait for workflow response
            timeout: Timeout in seconds

        Returns:
            Workflow execution result
        """
        workflow_id = f"workflow-{datetime.now().strftime('%Y%m%d%H%M%S')}"

        # Store workflow information
        self.workflows[workflow_id] = {
            "id": workflow_id,
            "name": workflow_name,
            "status": WorkflowStatus.PENDING.value,
            "created_at": datetime.now().isoformat(),
            "payload": payload
        }

        # Prepare the Logic App request
        logic_app_request = {
            "workflow_id": workflow_id,
            "workflow_name": workflow_name,
            "trigger_type": "manual",
            "payload": payload,
            "callback_url": f"{settings.APP_BASE_URL}/api/v1/webhook/callback",
            "timestamp": datetime.now().isoformat()
        }

        # Build the full Logic App URL
        if workflow_name == "corppowerbiai":
            url = f"{self.logic_app_url}/triggers/manual/paths/invoke"
            # Add SAS token if configured
            if self.logic_app_key:
                url += f"?api-version=2016-10-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig={self.logic_app_key}"
        else:
            url = f"{self.logic_app_url}/workflows/{workflow_name}/triggers/manual/paths/invoke"

        headers = {
            "Content-Type": "application/json"
        }

        try:
            self.workflows[workflow_id]["status"] = WorkflowStatus.RUNNING.value

            async with self.session.post(url, json=logic_app_request, headers=headers, timeout=timeout) as resp:
                response_data = await resp.json() if resp.content_type == "application/json" else {"status": resp.status}

                if resp.status in [200, 202]:
                    self.workflows[workflow_id]["status"] = WorkflowStatus.COMPLETED.value
                    self.workflows[workflow_id]["response"] = response_data

                    logger.info(f"Workflow triggered successfully: {workflow_id}")

                    if wait_for_response:
                        # Wait for callback if workflow is async
                        if resp.status == 202:
                            return await self._wait_for_callback(workflow_id, timeout)
                        else:
                            return {
                                "workflow_id": workflow_id,
                                "status": "completed",
                                "response": response_data
                            }
                    else:
                        return {
                            "workflow_id": workflow_id,
                            "status": "accepted",
                            "message": "Workflow triggered, not waiting for response"
                        }
                else:
                    self.workflows[workflow_id]["status"] = WorkflowStatus.FAILED.value
                    logger.error(f"Failed to trigger workflow: {resp.status}")

                    return {
                        "workflow_id": workflow_id,
                        "status": "failed",
                        "error": f"HTTP {resp.status}",
                        "details": response_data
                    }

        except asyncio.TimeoutError:
            self.workflows[workflow_id]["status"] = WorkflowStatus.FAILED.value
            logger.error(f"Workflow trigger timeout: {workflow_id}")

            return {
                "workflow_id": workflow_id,
                "status": "timeout",
                "error": "Request timeout"
            }

        except Exception as e:
            self.workflows[workflow_id]["status"] = WorkflowStatus.FAILED.value
            logger.error(f"Error triggering workflow: {e}")

            return {
                "workflow_id": workflow_id,
                "status": "error",
                "error": str(e)
            }

    async def _wait_for_callback(self, workflow_id: str, timeout: int) -> Dict[str, Any]:
        """Wait for workflow callback"""
        start_time = datetime.now()

        while (datetime.now() - start_time).seconds < timeout:
            if workflow_id in self.workflows:
                workflow = self.workflows[workflow_id]
                if "callback_response" in workflow:
                    return {
                        "workflow_id": workflow_id,
                        "status": "completed",
                        "response": workflow["callback_response"]
                    }

            await asyncio.sleep(1)

        return {
            "workflow_id": workflow_id,
            "status": "timeout",
            "message": "No callback received within timeout"
        }

    async def handle_webhook(
        self,
        webhook_type: str,
        payload: Dict[str, Any],
        headers: Dict[str, str]
    ) -> Dict[str, Any]:
        """
        Handle incoming webhook from Logic Apps

        Args:
            webhook_type: Type of webhook
            payload: Webhook payload
            headers: Request headers

        Returns:
            Webhook response
        """
        # Validate webhook signature if configured
        if self.logic_app_key and not await self._validate_webhook_signature(payload, headers):
            logger.warning("Invalid webhook signature")
            return {
                "status": "error",
                "message": "Invalid signature"
            }

        webhook_id = f"webhook-{datetime.now().strftime('%Y%m%d%H%M%S')}"

        logger.info(f"Processing webhook: {webhook_type} - {webhook_id}")

        # Process based on webhook type
        if webhook_type == "callback":
            # Handle workflow callback
            workflow_id = payload.get("workflow_id")
            if workflow_id and workflow_id in self.workflows:
                self.workflows[workflow_id]["callback_response"] = payload.get("response")
                self.workflows[workflow_id]["callback_received_at"] = datetime.now().isoformat()

                return {
                    "status": "success",
                    "message": "Callback processed",
                    "workflow_id": workflow_id
                }

        elif webhook_type == "agent_trigger":
            # Handle agent trigger request
            return await self._handle_agent_trigger(payload)

        elif webhook_type == "data_update":
            # Handle data update notification
            return await self._handle_data_update(payload)

        else:
            # Generic webhook handling
            logger.info(f"Generic webhook received: {webhook_type}")

            # Notify subscribed services
            if webhook_type in self.webhook_subscriptions:
                for subscriber in self.webhook_subscriptions[webhook_type]:
                    logger.info(f"Notifying subscriber: {subscriber}")

            return {
                "status": "success",
                "message": "Webhook processed",
                "webhook_id": webhook_id
            }

    async def _validate_webhook_signature(
        self,
        payload: Dict[str, Any],
        headers: Dict[str, str]
    ) -> bool:
        """Validate webhook signature"""
        if "x-logic-apps-signature" not in headers:
            return True  # No signature to validate

        expected_signature = headers.get("x-logic-apps-signature")
        payload_bytes = json.dumps(payload, separators=(",", ":")).encode()

        # Calculate HMAC signature
        signature = hmac.new(
            self.logic_app_key.encode(),
            payload_bytes,
            hashlib.sha256
        ).hexdigest()

        return hmac.compare_digest(signature, expected_signature)

    async def _handle_agent_trigger(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Handle agent trigger request from Logic Apps"""
        agent_action = payload.get("action")
        agent_data = payload.get("data", {})

        logger.info(f"Agent trigger received: {agent_action}")

        # Process agent action
        response_data = {
            "action": agent_action,
            "status": "processed",
            "timestamp": datetime.now().isoformat()
        }

        if agent_action == "analyze":
            response_data["analysis"] = {
                "summary": "Data analysis completed",
                "insights": ["Insight 1", "Insight 2"],
                "recommendations": ["Action 1", "Action 2"]
            }
        elif agent_action == "generate_report":
            response_data["report"] = {
                "id": f"report-{datetime.now().strftime('%Y%m%d%H%M%S')}",
                "status": "generated",
                "url": f"/reports/{agent_data.get('report_type', 'general')}"
            }

        return response_data

    async def _handle_data_update(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Handle data update notification from Logic Apps"""
        dataset_id = payload.get("dataset_id")
        update_type = payload.get("update_type")

        logger.info(f"Data update received: {dataset_id} - {update_type}")

        return {
            "status": "acknowledged",
            "dataset_id": dataset_id,
            "update_type": update_type,
            "timestamp": datetime.now().isoformat()
        }

    async def get_workflow_status(self, workflow_id: str) -> Dict[str, Any]:
        """Get workflow execution status"""
        if workflow_id not in self.workflows:
            return {
                "status": "not_found",
                "message": f"Workflow {workflow_id} not found"
            }

        workflow = self.workflows[workflow_id]
        return {
            "workflow_id": workflow_id,
            "status": workflow["status"],
            "created_at": workflow["created_at"],
            "response": workflow.get("response"),
            "callback_received": workflow.get("callback_received_at") is not None
        }

    async def list_workflows(
        self,
        status_filter: Optional[str] = None,
        limit: int = 10
    ) -> List[Dict[str, Any]]:
        """List workflow executions"""
        workflows_list = []

        for workflow_id, workflow in self.workflows.items():
            if status_filter and workflow["status"] != status_filter:
                continue

            workflows_list.append({
                "workflow_id": workflow_id,
                "name": workflow["name"],
                "status": workflow["status"],
                "created_at": workflow["created_at"]
            })

        # Sort by creation time (newest first)
        workflows_list.sort(key=lambda x: x["created_at"], reverse=True)

        return workflows_list[:limit]

    async def cancel_workflow(self, workflow_id: str) -> Dict[str, Any]:
        """Cancel a running workflow"""
        if workflow_id not in self.workflows:
            return {
                "status": "error",
                "message": f"Workflow {workflow_id} not found"
            }

        workflow = self.workflows[workflow_id]

        if workflow["status"] != WorkflowStatus.RUNNING.value:
            return {
                "status": "error",
                "message": f"Workflow is not running (status: {workflow['status']})"
            }

        workflow["status"] = WorkflowStatus.CANCELLED.value
        workflow["cancelled_at"] = datetime.now().isoformat()

        logger.info(f"Workflow cancelled: {workflow_id}")

        return {
            "status": "success",
            "message": "Workflow cancelled",
            "workflow_id": workflow_id
        }

    def register_webhook_subscription(self, webhook_type: str, subscriber: str):
        """Register a webhook subscription"""
        if webhook_type not in self.webhook_subscriptions:
            self.webhook_subscriptions[webhook_type] = []

        if subscriber not in self.webhook_subscriptions[webhook_type]:
            self.webhook_subscriptions[webhook_type].append(subscriber)
            logger.info(f"Webhook subscription registered: {webhook_type} - {subscriber}")

    async def test_connection(self) -> Dict[str, Any]:
        """Test Logic Apps connection"""
        try:
            # Send a test request to Logic Apps
            test_payload = {
                "test": True,
                "timestamp": datetime.now().isoformat()
            }

            result = await self.trigger_workflow(
                "corppowerbiai",
                test_payload,
                wait_for_response=False,
                timeout=5
            )

            return {
                "status": "connected" if result["status"] != "error" else "disconnected",
                "logic_app": "corppowerbiai",
                "region": "swedencentral",
                "test_result": result
            }

        except Exception as e:
            logger.error(f"Logic Apps connection test failed: {e}")
            return {
                "status": "error",
                "message": str(e)
            }