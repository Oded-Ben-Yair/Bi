"""
Azure AI Foundry Agent Service
Manages AI agents, function calling, and thread orchestration
"""

import asyncio
import json
import logging
from typing import Dict, List, Any, Optional, Callable
from datetime import datetime
import aiohttp
from enum import Enum

from app.config import settings

logger = logging.getLogger(__name__)


class FunctionCallStatus(Enum):
    """Function call execution status"""
    PENDING = "pending"
    EXECUTING = "executing"
    COMPLETED = "completed"
    FAILED = "failed"


class AIFoundryAgent:
    """Service for Azure AI Foundry Agent interactions"""

    def __init__(self):
        self.endpoint = settings.AZURE_AI_FOUNDRY_ENDPOINT
        self.project = settings.AZURE_AI_FOUNDRY_PROJECT
        self.api_key = settings.AZURE_OPENAI_API_KEY
        self.agent_id = settings.AZURE_AGENT_ID
        self.session: Optional[aiohttp.ClientSession] = None
        self.functions: Dict[str, Callable] = {}
        self.threads: Dict[str, Dict] = {}

    async def initialize(self):
        """Initialize the AI Foundry agent service"""
        if not self.session:
            timeout = aiohttp.ClientTimeout(total=60)
            self.session = aiohttp.ClientSession(timeout=timeout)

        # Register default functions
        await self._register_default_functions()

        logger.info(f"AI Foundry Agent initialized: {self.agent_id}")

    async def cleanup(self):
        """Cleanup resources"""
        if self.session:
            await self.session.close()

    async def _register_default_functions(self):
        """Register default functions for the agent"""
        self.functions = {
            "query_powerbi_data": {
                "name": "query_powerbi_data",
                "description": "Query Power BI dataset using DAX",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "query": {
                            "type": "string",
                            "description": "DAX query to execute"
                        },
                        "dataset_id": {
                            "type": "string",
                            "description": "Power BI dataset ID"
                        }
                    },
                    "required": ["query"]
                }
            },
            "generate_report": {
                "name": "generate_report",
                "description": "Generate a Power BI report based on analysis",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "report_type": {
                            "type": "string",
                            "enum": ["kpi", "trend", "forecast", "anomaly"],
                            "description": "Type of report to generate"
                        },
                        "metrics": {
                            "type": "array",
                            "items": {"type": "string"},
                            "description": "Metrics to include in the report"
                        },
                        "time_period": {
                            "type": "string",
                            "description": "Time period for the report"
                        }
                    },
                    "required": ["report_type", "metrics"]
                }
            },
            "analyze_data": {
                "name": "analyze_data",
                "description": "Perform advanced data analysis",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "analysis_type": {
                            "type": "string",
                            "enum": ["descriptive", "predictive", "prescriptive", "diagnostic"],
                            "description": "Type of analysis to perform"
                        },
                        "data": {
                            "type": "object",
                            "description": "Data to analyze"
                        },
                        "parameters": {
                            "type": "object",
                            "description": "Additional analysis parameters"
                        }
                    },
                    "required": ["analysis_type", "data"]
                }
            },
            "trigger_logic_app": {
                "name": "trigger_logic_app",
                "description": "Trigger Azure Logic App workflow",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "workflow_name": {
                            "type": "string",
                            "description": "Name of the Logic App workflow"
                        },
                        "payload": {
                            "type": "object",
                            "description": "Payload to send to the Logic App"
                        },
                        "wait_for_response": {
                            "type": "boolean",
                            "description": "Wait for Logic App response",
                            "default": True
                        }
                    },
                    "required": ["workflow_name", "payload"]
                }
            }
        }

    async def create_agent(
        self,
        name: str,
        instructions: str,
        tools: Optional[List[str]] = None,
        model: str = "gpt-5"
    ) -> Dict[str, Any]:
        """
        Create a new AI Foundry agent

        Args:
            name: Agent name
            instructions: System instructions for the agent
            tools: List of tool names to enable
            model: Model to use (default: gpt-5)

        Returns:
            Agent configuration
        """
        agent_config = {
            "id": f"{self.agent_id}-{datetime.now().strftime('%Y%m%d%H%M%S')}",
            "name": name,
            "instructions": instructions,
            "model": model,
            "tools": tools or list(self.functions.keys()),
            "created_at": datetime.now().isoformat()
        }

        # Register with AI Foundry
        url = f"{self.endpoint}/api/projects/{self.project}/agents"
        headers = {
            "api-key": self.api_key,
            "Content-Type": "application/json"
        }

        try:
            async with self.session.post(url, json=agent_config, headers=headers) as resp:
                if resp.status == 200:
                    result = await resp.json()
                    logger.info(f"Agent created: {result.get('id')}")
                    return result
                else:
                    logger.error(f"Failed to create agent: {resp.status}")
                    return agent_config
        except Exception as e:
            logger.error(f"Error creating agent: {e}")
            return agent_config

    async def create_thread(self, metadata: Optional[Dict] = None) -> str:
        """
        Create a new conversation thread

        Args:
            metadata: Optional thread metadata

        Returns:
            Thread ID
        """
        thread_id = f"thread-{datetime.now().strftime('%Y%m%d%H%M%S')}"

        self.threads[thread_id] = {
            "id": thread_id,
            "created_at": datetime.now().isoformat(),
            "messages": [],
            "metadata": metadata or {},
            "status": "active"
        }

        logger.info(f"Thread created: {thread_id}")
        return thread_id

    async def add_message(
        self,
        thread_id: str,
        role: str,
        content: str,
        metadata: Optional[Dict] = None
    ) -> Dict[str, Any]:
        """
        Add a message to a thread

        Args:
            thread_id: Thread ID
            role: Message role (user/assistant/system)
            content: Message content
            metadata: Optional message metadata

        Returns:
            Message object
        """
        if thread_id not in self.threads:
            raise ValueError(f"Thread not found: {thread_id}")

        message = {
            "id": f"msg-{datetime.now().strftime('%Y%m%d%H%M%S')}",
            "thread_id": thread_id,
            "role": role,
            "content": content,
            "created_at": datetime.now().isoformat(),
            "metadata": metadata or {}
        }

        self.threads[thread_id]["messages"].append(message)
        logger.debug(f"Message added to thread {thread_id}")

        return message

    async def run_agent(
        self,
        thread_id: str,
        agent_config: Dict[str, Any],
        stream: bool = False
    ) -> Dict[str, Any]:
        """
        Run an agent on a thread

        Args:
            thread_id: Thread ID
            agent_config: Agent configuration
            stream: Whether to stream responses

        Returns:
            Agent run result
        """
        if thread_id not in self.threads:
            raise ValueError(f"Thread not found: {thread_id}")

        thread = self.threads[thread_id]

        # Prepare the run request
        run_request = {
            "thread_id": thread_id,
            "agent": agent_config,
            "messages": thread["messages"],
            "tools": self.functions,
            "stream": stream
        }

        # Call AI Foundry to run the agent
        url = f"{self.endpoint}/api/projects/{self.project}/agents/{agent_config['id']}/runs"
        headers = {
            "api-key": self.api_key,
            "Content-Type": "application/json"
        }

        try:
            async with self.session.post(url, json=run_request, headers=headers) as resp:
                if resp.status == 200:
                    result = await resp.json()

                    # Process function calls if any
                    if "function_calls" in result:
                        result = await self._process_function_calls(result)

                    return result
                else:
                    # Fallback to local processing
                    return await self._local_agent_run(thread_id, agent_config)

        except Exception as e:
            logger.error(f"Error running agent: {e}")
            return await self._local_agent_run(thread_id, agent_config)

    async def _local_agent_run(
        self,
        thread_id: str,
        agent_config: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Local fallback for agent execution"""
        thread = self.threads[thread_id]

        # Generate response based on thread messages
        response = {
            "id": f"run-{datetime.now().strftime('%Y%m%d%H%M%S')}",
            "thread_id": thread_id,
            "agent_id": agent_config["id"],
            "status": "completed",
            "created_at": datetime.now().isoformat(),
            "messages": [
                {
                    "role": "assistant",
                    "content": "I'm ready to help you analyze the Power BI data and trigger Logic App workflows."
                }
            ],
            "function_calls": []
        }

        # Add response to thread
        await self.add_message(
            thread_id,
            "assistant",
            response["messages"][0]["content"]
        )

        return response

    async def _process_function_calls(self, result: Dict[str, Any]) -> Dict[str, Any]:
        """
        Process function calls from agent response

        Args:
            result: Agent run result with function calls

        Returns:
            Updated result with function outputs
        """
        function_outputs = []

        for call in result.get("function_calls", []):
            function_name = call.get("name")
            arguments = call.get("arguments", {})

            if function_name in self.functions:
                try:
                    # Execute the function
                    output = await self._execute_function(function_name, arguments)
                    function_outputs.append({
                        "name": function_name,
                        "output": output,
                        "status": FunctionCallStatus.COMPLETED.value
                    })
                except Exception as e:
                    logger.error(f"Function execution failed: {e}")
                    function_outputs.append({
                        "name": function_name,
                        "output": str(e),
                        "status": FunctionCallStatus.FAILED.value
                    })
            else:
                logger.warning(f"Unknown function: {function_name}")
                function_outputs.append({
                    "name": function_name,
                    "output": "Function not found",
                    "status": FunctionCallStatus.FAILED.value
                })

        result["function_outputs"] = function_outputs
        return result

    async def _execute_function(self, name: str, arguments: Dict[str, Any]) -> Any:
        """
        Execute a registered function

        Args:
            name: Function name
            arguments: Function arguments

        Returns:
            Function output
        """
        # This would be implemented with actual function execution logic
        # For now, return a mock response
        logger.info(f"Executing function: {name} with args: {arguments}")

        if name == "query_powerbi_data":
            return {
                "status": "success",
                "data": {
                    "rows": 100,
                    "columns": ["Date", "Revenue", "Profit"],
                    "sample": [
                        {"Date": "2025-09-01", "Revenue": 150000, "Profit": 45000},
                        {"Date": "2025-09-02", "Revenue": 165000, "Profit": 52000}
                    ]
                }
            }
        elif name == "trigger_logic_app":
            return {
                "status": "success",
                "workflow_run_id": f"run-{datetime.now().strftime('%Y%m%d%H%M%S')}",
                "message": "Logic App workflow triggered successfully"
            }
        else:
            return {"status": "success", "message": f"Function {name} executed"}

    async def get_thread_messages(self, thread_id: str) -> List[Dict[str, Any]]:
        """Get all messages in a thread"""
        if thread_id not in self.threads:
            raise ValueError(f"Thread not found: {thread_id}")

        return self.threads[thread_id]["messages"]

    async def delete_thread(self, thread_id: str):
        """Delete a thread"""
        if thread_id in self.threads:
            del self.threads[thread_id]
            logger.info(f"Thread deleted: {thread_id}")

    def register_function(self, name: str, definition: Dict[str, Any]):
        """Register a custom function for the agent"""
        self.functions[name] = definition
        logger.info(f"Function registered: {name}")