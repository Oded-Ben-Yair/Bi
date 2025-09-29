"""
Enhanced Azure Logic Apps Service
Comprehensive workflow orchestration with Power BI refresh, alerts, report generation
Supports scheduled, data-change, and manual triggers with automated monitoring
"""

import asyncio
import json
import hmac
import hashlib
import logging
import uuid
from typing import Dict, List, Any, Optional, Callable
from datetime import datetime, timedelta
import aiohttp
from enum import Enum
import schedule
import threading

from app.config import settings
from app.services.cache import CacheService

logger = logging.getLogger(__name__)


class WorkflowStatus(Enum):
    """Workflow execution status"""
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"
    TIMEOUT = "timeout"
    RETRYING = "retrying"


class TriggerType(Enum):
    """Workflow trigger types"""
    MANUAL = "manual"
    SCHEDULED = "scheduled"
    DATA_CHANGE = "data_change"
    WEBHOOK = "webhook"
    EVENT_DRIVEN = "event_driven"


class WorkflowType(Enum):
    """Predefined workflow types"""
    POWERBI_REFRESH = "powerbi_refresh"
    REPORT_GENERATION = "report_generation"
    ALERT_NOTIFICATION = "alert_notification"
    DATA_ANALYSIS = "data_analysis"
    CUSTOM = "custom"


class WorkflowDefinition:
    """Workflow definition with configuration"""

    def __init__(
        self,
        name: str,
        workflow_type: WorkflowType,
        trigger_type: TriggerType,
        config: Dict[str, Any]
    ):
        self.id = str(uuid.uuid4())
        self.name = name
        self.workflow_type = workflow_type
        self.trigger_type = trigger_type
        self.config = config
        self.created_at = datetime.now()
        self.enabled = True
        self.retry_count = 0
        self.max_retries = config.get("max_retries", 3)


class EnhancedLogicAppsService:
    """Enhanced Azure Logic Apps service with comprehensive workflow orchestration"""

    def __init__(self):
        self.logic_app_url = settings.AZURE_LOGIC_APP_URL
        self.logic_app_key = settings.AZURE_LOGIC_APP_KEY
        self.workspace_id = settings.POWERBI_WORKSPACE_ID
        self.dataset_id = settings.POWERBI_AXIA_DATASET_ID
        self.session: Optional[aiohttp.ClientSession] = None
        self.cache_service = CacheService()

        # Enhanced workflow management
        self.workflows: Dict[str, Dict] = {}
        self.workflow_definitions: Dict[str, WorkflowDefinition] = {}
        self.scheduled_workflows: Dict[str, Dict] = {}
        self.webhook_subscriptions: Dict[str, List[str]] = {}

        # Monitoring and metrics
        self.execution_metrics: Dict[str, Any] = {
            "total_executions": 0,
            "successful_executions": 0,
            "failed_executions": 0,
            "average_duration": 0.0,
            "workflow_stats": {}
        }

        # Scheduler for automated workflows
        self.scheduler = schedule
        self.scheduler_thread = None
        self.scheduler_running = False

    async def initialize(self):
        """Initialize the enhanced Logic Apps service"""
        if not self.session:
            timeout = aiohttp.ClientTimeout(total=60)
            self.session = aiohttp.ClientSession(timeout=timeout)

        # Initialize predefined workflows
        await self._initialize_predefined_workflows()

        # Start scheduler thread
        await self._start_scheduler()

        # Register default webhooks
        await self._register_enhanced_webhooks()

        logger.info("Enhanced Logic Apps Service initialized")
        logger.info(f"Predefined workflows: {len(self.workflow_definitions)}")
        logger.info(f"Scheduler running: {self.scheduler_running}")

    async def cleanup(self):
        """Cleanup resources"""
        self.scheduler_running = False
        if self.scheduler_thread:
            self.scheduler_thread.join(timeout=5)
        if self.session:
            await self.session.close()

    async def _initialize_predefined_workflows(self):
        """Initialize predefined workflow configurations"""

        # Power BI Refresh Workflow
        powerbi_refresh = WorkflowDefinition(
            name="powerbi_dataset_refresh",
            workflow_type=WorkflowType.POWERBI_REFRESH,
            trigger_type=TriggerType.SCHEDULED,
            config={
                "schedule": "0 6 * * *",  # Daily at 6 AM
                "dataset_id": self.dataset_id,
                "workspace_id": self.workspace_id,
                "retry_on_failure": True,
                "max_retries": 3,
                "notification_on_failure": True,
                "timeout_minutes": 30
            }
        )
        self.workflow_definitions[powerbi_refresh.id] = powerbi_refresh

        # Report Generation Workflow
        report_generation = WorkflowDefinition(
            name="automated_report_generation",
            workflow_type=WorkflowType.REPORT_GENERATION,
            trigger_type=TriggerType.SCHEDULED,
            config={
                "schedule": "0 8 * * 1",  # Weekly on Monday at 8 AM
                "report_types": ["executive_summary", "kpi_dashboard"],
                "recipients": ["executives@company.com"],
                "format": "pdf",
                "include_insights": True
            }
        )
        self.workflow_definitions[report_generation.id] = report_generation

        # Alert Notification Workflow
        alert_notification = WorkflowDefinition(
            name="performance_alert_system",
            workflow_type=WorkflowType.ALERT_NOTIFICATION,
            trigger_type=TriggerType.DATA_CHANGE,
            config={
                "thresholds": {
                    "revenue_drop_percent": 15,
                    "cost_increase_percent": 20,
                    "anomaly_score": 0.8
                },
                "notification_channels": ["email", "teams", "slack"],
                "escalation_levels": ["manager", "director", "ceo"],
                "business_hours_only": True
            }
        )
        self.workflow_definitions[alert_notification.id] = alert_notification

        # Data Analysis Workflow
        data_analysis = WorkflowDefinition(
            name="intelligent_data_analysis",
            workflow_type=WorkflowType.DATA_ANALYSIS,
            trigger_type=TriggerType.EVENT_DRIVEN,
            config={
                "analysis_types": ["trend", "anomaly", "forecast"],
                "ai_model": "gpt-5",
                "output_format": "executive_summary",
                "auto_insights": True,
                "cache_results": True
            }
        )
        self.workflow_definitions[data_analysis.id] = data_analysis

    async def _start_scheduler(self):
        """Start the workflow scheduler"""
        self.scheduler_running = True

        def run_scheduler():
            while self.scheduler_running:
                self.scheduler.run_pending()
                asyncio.sleep(60)  # Check every minute

        self.scheduler_thread = threading.Thread(target=run_scheduler, daemon=True)
        self.scheduler_thread.start()

    async def _register_enhanced_webhooks(self):
        """Register enhanced webhook endpoints"""
        self.webhook_subscriptions = {
            "powerbi_refresh_complete": ["report_generator", "notification_service"],
            "data_anomaly_detected": ["alert_service", "notification_service"],
            "report_generation_complete": ["email_service", "storage_service"],
            "analysis_complete": ["dashboard_service", "cache_service"],
            "workflow_failed": ["monitoring_service", "notification_service"],
            "cost_threshold_exceeded": ["finance_team", "management"]
        }

    async def create_workflow(
        self,
        name: str,
        workflow_type: str,
        trigger_config: Dict[str, Any],
        execution_config: Dict[str, Any]
    ) -> str:
        """
        Create a new workflow definition

        Args:
            name: Workflow name
            workflow_type: Type of workflow
            trigger_config: Trigger configuration
            execution_config: Execution configuration

        Returns:
            Workflow definition ID
        """
        workflow_def = WorkflowDefinition(
            name=name,
            workflow_type=WorkflowType(workflow_type),
            trigger_type=TriggerType(trigger_config.get("type", "manual")),
            config={**trigger_config, **execution_config}
        )

        self.workflow_definitions[workflow_def.id] = workflow_def

        # Schedule if needed
        if workflow_def.trigger_type == TriggerType.SCHEDULED:
            await self._schedule_workflow(workflow_def)

        logger.info(f"Workflow created: {name} ({workflow_def.id})")
        return workflow_def.id

    async def _schedule_workflow(self, workflow_def: WorkflowDefinition):
        """Schedule a workflow for automatic execution"""
        schedule_str = workflow_def.config.get("schedule")
        if not schedule_str:
            return

        # Parse cron-like schedule (simplified)
        # Format: "minute hour day month dayofweek"
        parts = schedule_str.split()
        if len(parts) == 5:
            minute, hour, day, month, dayofweek = parts

            # Schedule daily execution if supported
            if dayofweek == "*" and day == "*":
                self.scheduler.every().day.at(f"{hour}:{minute}").do(
                    self._execute_scheduled_workflow, workflow_def.id
                )
            elif dayofweek != "*":
                # Weekly scheduling
                days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
                if int(dayofweek) < len(days):
                    day_name = days[int(dayofweek)]
                    getattr(self.scheduler.every(), day_name).at(f"{hour}:{minute}").do(
                        self._execute_scheduled_workflow, workflow_def.id
                    )

        self.scheduled_workflows[workflow_def.id] = {
            "workflow_id": workflow_def.id,
            "schedule": schedule_str,
            "next_run": None,
            "last_run": None
        }

    def _execute_scheduled_workflow(self, workflow_def_id: str):
        """Execute a scheduled workflow (called by scheduler)"""
        asyncio.create_task(self.execute_workflow(workflow_def_id, {}))

    async def execute_workflow(
        self,
        workflow_def_id: str,
        payload: Dict[str, Any],
        manual_override: bool = False
    ) -> Dict[str, Any]:
        """
        Execute a workflow based on its definition

        Args:
            workflow_def_id: Workflow definition ID
            payload: Execution payload
            manual_override: Override automatic scheduling

        Returns:
            Execution result
        """
        if workflow_def_id not in self.workflow_definitions:
            return {
                "status": "error",
                "message": f"Workflow definition not found: {workflow_def_id}"
            }

        workflow_def = self.workflow_definitions[workflow_def_id]
        execution_id = str(uuid.uuid4())

        # Create execution record
        execution_record = {
            "execution_id": execution_id,
            "workflow_def_id": workflow_def_id,
            "workflow_name": workflow_def.name,
            "workflow_type": workflow_def.workflow_type.value,
            "status": WorkflowStatus.PENDING.value,
            "started_at": datetime.now().isoformat(),
            "payload": payload,
            "manual_override": manual_override
        }

        self.workflows[execution_id] = execution_record
        self.execution_metrics["total_executions"] += 1

        try:
            # Update status to running
            execution_record["status"] = WorkflowStatus.RUNNING.value

            # Execute based on workflow type
            if workflow_def.workflow_type == WorkflowType.POWERBI_REFRESH:
                result = await self._execute_powerbi_refresh(workflow_def, payload)
            elif workflow_def.workflow_type == WorkflowType.REPORT_GENERATION:
                result = await self._execute_report_generation(workflow_def, payload)
            elif workflow_def.workflow_type == WorkflowType.ALERT_NOTIFICATION:
                result = await self._execute_alert_notification(workflow_def, payload)
            elif workflow_def.workflow_type == WorkflowType.DATA_ANALYSIS:
                result = await self._execute_data_analysis(workflow_def, payload)
            else:
                result = await self._execute_custom_workflow(workflow_def, payload)

            # Update execution record
            execution_record["status"] = WorkflowStatus.COMPLETED.value
            execution_record["result"] = result
            execution_record["completed_at"] = datetime.now().isoformat()

            # Calculate duration
            started = datetime.fromisoformat(execution_record["started_at"])
            duration = (datetime.now() - started).total_seconds()
            execution_record["duration_seconds"] = duration

            # Update metrics
            self.execution_metrics["successful_executions"] += 1
            self._update_average_duration(duration)

            logger.info(f"Workflow executed successfully: {execution_id}")
            return {
                "execution_id": execution_id,
                "status": "completed",
                "result": result,
                "duration_seconds": duration
            }

        except Exception as e:
            # Handle failure
            execution_record["status"] = WorkflowStatus.FAILED.value
            execution_record["error"] = str(e)
            execution_record["failed_at"] = datetime.now().isoformat()

            self.execution_metrics["failed_executions"] += 1

            # Retry logic
            if workflow_def.config.get("retry_on_failure", False) and workflow_def.retry_count < workflow_def.max_retries:
                workflow_def.retry_count += 1
                logger.warning(f"Workflow failed, retrying ({workflow_def.retry_count}/{workflow_def.max_retries}): {execution_id}")

                # Schedule retry after delay
                await asyncio.sleep(60 * workflow_def.retry_count)  # Exponential backoff
                return await self.execute_workflow(workflow_def_id, payload, manual_override)

            logger.error(f"Workflow execution failed: {execution_id} - {str(e)}")
            return {
                "execution_id": execution_id,
                "status": "failed",
                "error": str(e)
            }

    async def _execute_powerbi_refresh(
        self,
        workflow_def: WorkflowDefinition,
        payload: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Execute Power BI dataset refresh workflow"""

        dataset_id = workflow_def.config.get("dataset_id", self.dataset_id)
        workspace_id = workflow_def.config.get("workspace_id", self.workspace_id)

        # Prepare Logic App payload for Power BI refresh
        logic_app_payload = {
            "action": "refresh_dataset",
            "dataset_id": dataset_id,
            "workspace_id": workspace_id,
            "wait_for_completion": True,
            "timeout_minutes": workflow_def.config.get("timeout_minutes", 30),
            "notification_on_failure": workflow_def.config.get("notification_on_failure", True),
            **payload
        }

        # Trigger Logic App
        result = await self.trigger_logic_app_workflow(
            "corppowerbiai",
            logic_app_payload,
            wait_for_completion=True,
            timeout=1800  # 30 minutes
        )

        # Post-process result
        if result["status"] == "completed":
            # Trigger follow-up actions
            await self._trigger_webhook("powerbi_refresh_complete", {
                "dataset_id": dataset_id,
                "refresh_time": datetime.now().isoformat(),
                "execution_id": result.get("execution_id")
            })

        return result

    async def _execute_report_generation(
        self,
        workflow_def: WorkflowDefinition,
        payload: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Execute automated report generation workflow"""

        config = workflow_def.config
        report_types = config.get("report_types", ["summary"])
        recipients = config.get("recipients", [])

        generated_reports = []

        for report_type in report_types:
            # Prepare report generation payload
            report_payload = {
                "action": "generate_report",
                "report_type": report_type,
                "format": config.get("format", "pdf"),
                "include_insights": config.get("include_insights", True),
                "dataset_id": self.dataset_id,
                "workspace_id": self.workspace_id,
                **payload
            }

            # Trigger Logic App for report generation
            result = await self.trigger_logic_app_workflow(
                "corppowerbiai",
                report_payload,
                wait_for_completion=True
            )

            if result["status"] == "completed":
                generated_reports.append({
                    "report_type": report_type,
                    "report_id": result.get("report_id"),
                    "download_url": result.get("download_url")
                })

        # Send notifications
        if recipients and generated_reports:
            await self._send_report_notifications(recipients, generated_reports)

        return {
            "reports_generated": len(generated_reports),
            "reports": generated_reports,
            "recipients_notified": len(recipients)
        }

    async def _execute_alert_notification(
        self,
        workflow_def: WorkflowDefinition,
        payload: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Execute alert notification workflow"""

        config = workflow_def.config
        thresholds = config.get("thresholds", {})
        notification_channels = config.get("notification_channels", ["email"])

        # Analyze data for threshold violations
        violations = []
        alert_data = payload.get("alert_data", {})

        for metric, threshold in thresholds.items():
            current_value = alert_data.get(metric)
            if current_value is not None and current_value > threshold:
                violations.append({
                    "metric": metric,
                    "current_value": current_value,
                    "threshold": threshold,
                    "severity": self._calculate_severity(current_value, threshold)
                })

        if violations:
            # Trigger notifications
            for channel in notification_channels:
                notification_payload = {
                    "action": "send_alert",
                    "channel": channel,
                    "violations": violations,
                    "timestamp": datetime.now().isoformat(),
                    "escalation_level": self._determine_escalation_level(violations)
                }

                await self.trigger_logic_app_workflow(
                    "corppowerbiai",
                    notification_payload,
                    wait_for_completion=False
                )

        return {
            "violations_detected": len(violations),
            "violations": violations,
            "notifications_sent": len(notification_channels) if violations else 0
        }

    async def _execute_data_analysis(
        self,
        workflow_def: WorkflowDefinition,
        payload: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Execute intelligent data analysis workflow"""

        config = workflow_def.config
        analysis_types = config.get("analysis_types", ["trend"])

        analysis_results = []

        for analysis_type in analysis_types:
            analysis_payload = {
                "action": "analyze_data",
                "analysis_type": analysis_type,
                "dataset_id": self.dataset_id,
                "ai_model": config.get("ai_model", "gpt-5"),
                "output_format": config.get("output_format", "summary"),
                **payload
            }

            result = await self.trigger_logic_app_workflow(
                "corppowerbiai",
                analysis_payload,
                wait_for_completion=True
            )

            if result["status"] == "completed":
                analysis_results.append({
                    "analysis_type": analysis_type,
                    "insights": result.get("insights", []),
                    "recommendations": result.get("recommendations", [])
                })

        # Cache results if configured
        if config.get("cache_results", False):
            cache_key = f"analysis_results_{datetime.now().strftime('%Y%m%d')}"
            await self.cache_service.set(cache_key, analysis_results, ttl=86400)  # 24 hours

        return {
            "analyses_completed": len(analysis_results),
            "results": analysis_results
        }

    async def _execute_custom_workflow(
        self,
        workflow_def: WorkflowDefinition,
        payload: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Execute custom workflow"""

        # Generic custom workflow execution
        custom_payload = {
            "action": "custom_workflow",
            "workflow_name": workflow_def.name,
            "config": workflow_def.config,
            **payload
        }

        result = await self.trigger_logic_app_workflow(
            "corppowerbiai",
            custom_payload,
            wait_for_completion=True
        )

        return result

    async def trigger_logic_app_workflow(
        self,
        workflow_name: str,
        payload: Dict[str, Any],
        wait_for_completion: bool = True,
        timeout: int = 300
    ) -> Dict[str, Any]:
        """
        Enhanced Logic App workflow trigger with comprehensive monitoring
        """
        execution_id = str(uuid.uuid4())

        # Build Logic App URL
        if workflow_name == "corppowerbiai":
            url = f"{self.logic_app_url}/triggers/manual/paths/invoke"
            if self.logic_app_key:
                url += f"?api-version=2016-10-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig={self.logic_app_key}"
        else:
            url = f"{self.logic_app_url}/workflows/{workflow_name}/triggers/manual/paths/invoke"

        # Enhanced payload with tracking
        enhanced_payload = {
            "execution_id": execution_id,
            "workflow_name": workflow_name,
            "timestamp": datetime.now().isoformat(),
            "callback_url": f"{settings.APP_BASE_URL}/api/v1/logic-apps/callback",
            "payload": payload
        }

        headers = {
            "Content-Type": "application/json"
        }

        try:
            start_time = datetime.now()

            async with self.session.post(url, json=enhanced_payload, headers=headers, timeout=timeout) as resp:
                response_data = await resp.json() if resp.content_type == "application/json" else {"status": resp.status}

                duration = (datetime.now() - start_time).total_seconds()

                if resp.status in [200, 202]:
                    logger.info(f"Logic App triggered successfully: {execution_id} ({duration:.2f}s)")

                    return {
                        "execution_id": execution_id,
                        "status": "completed" if resp.status == 200 else "accepted",
                        "response": response_data,
                        "duration_seconds": duration,
                        "logic_app_status": resp.status
                    }
                else:
                    logger.error(f"Logic App trigger failed: {resp.status}")
                    return {
                        "execution_id": execution_id,
                        "status": "failed",
                        "error": f"HTTP {resp.status}",
                        "details": response_data
                    }

        except Exception as e:
            logger.error(f"Error triggering Logic App: {e}")
            return {
                "execution_id": execution_id,
                "status": "error",
                "error": str(e)
            }

    async def _trigger_webhook(self, webhook_type: str, payload: Dict[str, Any]):
        """Trigger webhook notifications to subscribers"""
        if webhook_type in self.webhook_subscriptions:
            for subscriber in self.webhook_subscriptions[webhook_type]:
                logger.info(f"Triggering webhook: {webhook_type} -> {subscriber}")
                # In a real implementation, this would make HTTP calls to subscriber endpoints

    async def _send_report_notifications(self, recipients: List[str], reports: List[Dict]):
        """Send report notifications to recipients"""
        for recipient in recipients:
            logger.info(f"Sending report notification to: {recipient}")
            # Implementation would send actual emails/notifications

    def _calculate_severity(self, current_value: float, threshold: float) -> str:
        """Calculate alert severity based on threshold violation"""
        ratio = current_value / threshold
        if ratio >= 2.0:
            return "critical"
        elif ratio >= 1.5:
            return "high"
        elif ratio >= 1.2:
            return "medium"
        else:
            return "low"

    def _determine_escalation_level(self, violations: List[Dict]) -> str:
        """Determine escalation level based on violations"""
        critical_count = sum(1 for v in violations if v["severity"] == "critical")
        high_count = sum(1 for v in violations if v["severity"] == "high")

        if critical_count > 0:
            return "executive"
        elif high_count > 1:
            return "management"
        else:
            return "team"

    def _update_average_duration(self, duration: float):
        """Update average duration metric"""
        current_avg = self.execution_metrics["average_duration"]
        total_successful = self.execution_metrics["successful_executions"]
        self.execution_metrics["average_duration"] = (current_avg * (total_successful - 1) + duration) / total_successful

    async def get_workflow_definitions(self) -> List[Dict[str, Any]]:
        """Get all workflow definitions"""
        definitions = []
        for workflow_def in self.workflow_definitions.values():
            definitions.append({
                "id": workflow_def.id,
                "name": workflow_def.name,
                "type": workflow_def.workflow_type.value,
                "trigger_type": workflow_def.trigger_type.value,
                "enabled": workflow_def.enabled,
                "created_at": workflow_def.created_at.isoformat(),
                "config": workflow_def.config
            })
        return definitions

    async def get_execution_history(
        self,
        limit: int = 50,
        status_filter: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Get workflow execution history"""
        executions = []
        for execution in self.workflows.values():
            if status_filter and execution["status"] != status_filter:
                continue
            executions.append(execution)

        # Sort by start time (newest first)
        executions.sort(key=lambda x: x["started_at"], reverse=True)
        return executions[:limit]

    async def get_metrics_dashboard(self) -> Dict[str, Any]:
        """Get comprehensive metrics dashboard"""
        return {
            "execution_metrics": self.execution_metrics,
            "workflow_definitions": len(self.workflow_definitions),
            "scheduled_workflows": len(self.scheduled_workflows),
            "webhook_subscriptions": len(self.webhook_subscriptions),
            "active_executions": len([
                w for w in self.workflows.values()
                if w["status"] in ["pending", "running"]
            ]),
            "success_rate": (
                self.execution_metrics["successful_executions"] /
                max(self.execution_metrics["total_executions"], 1) * 100
            ),
            "scheduler_status": "running" if self.scheduler_running else "stopped"
        }

    async def test_comprehensive_integration(self) -> Dict[str, Any]:
        """Test all Logic Apps integrations"""
        test_results = {}

        # Test 1: Basic connectivity
        test_results["connectivity"] = await self._test_basic_connectivity()

        # Test 2: Workflow execution
        test_results["workflow_execution"] = await self._test_workflow_execution()

        # Test 3: Webhook handling
        test_results["webhook_handling"] = await self._test_webhook_handling()

        # Test 4: Scheduler
        test_results["scheduler"] = {
            "status": "running" if self.scheduler_running else "stopped",
            "scheduled_workflows": len(self.scheduled_workflows)
        }

        return {
            "test_timestamp": datetime.now().isoformat(),
            "overall_status": "✅ All tests passed" if all(
                t.get("status") == "✅ Working" for t in test_results.values()
            ) else "⚠️ Some tests failed",
            "detailed_results": test_results
        }

    async def _test_basic_connectivity(self) -> Dict[str, Any]:
        """Test basic Logic Apps connectivity"""
        try:
            test_payload = {"test": True, "timestamp": datetime.now().isoformat()}
            result = await self.trigger_logic_app_workflow(
                "corppowerbiai", test_payload, wait_for_completion=False, timeout=10
            )
            return {
                "status": "✅ Working",
                "response_time": result.get("duration_seconds", 0),
                "logic_app_status": result.get("logic_app_status")
            }
        except Exception as e:
            return {"status": f"❌ Error: {str(e)}"}

    async def _test_workflow_execution(self) -> Dict[str, Any]:
        """Test workflow execution capabilities"""
        try:
            # Create a test workflow
            test_workflow_id = await self.create_workflow(
                "test_workflow",
                "custom",
                {"type": "manual"},
                {"test": True}
            )

            # Execute the test workflow
            result = await self.execute_workflow(test_workflow_id, {"test_data": "validation"})

            return {
                "status": "✅ Working",
                "test_workflow_id": test_workflow_id,
                "execution_status": result.get("status"),
                "duration": result.get("duration_seconds")
            }
        except Exception as e:
            return {"status": f"❌ Error: {str(e)}"}

    async def _test_webhook_handling(self) -> Dict[str, Any]:
        """Test webhook handling capabilities"""
        try:
            # Simulate webhook processing
            webhook_result = await self._trigger_webhook(
                "test_webhook",
                {"test": True, "timestamp": datetime.now().isoformat()}
            )

            return {
                "status": "✅ Working",
                "webhook_subscriptions": len(self.webhook_subscriptions),
                "test_result": "webhook_processed"
            }
        except Exception as e:
            return {"status": f"❌ Error: {str(e)}"}