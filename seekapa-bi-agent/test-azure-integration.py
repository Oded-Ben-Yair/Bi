#!/usr/bin/env python3
"""
Test script for Azure Logic Apps and AI Foundry integration
Tests webhook endpoints, agent functionality, and Logic App triggers
"""

import asyncio
import aiohttp
import json
from datetime import datetime
import sys
from typing import Dict, Any


# Configuration
BASE_URL = "http://localhost:8000"
HEADERS = {"Content-Type": "application/json"}


class AzureIntegrationTester:
    """Test Azure Logic Apps and AI Foundry integration"""

    def __init__(self, base_url: str = BASE_URL):
        self.base_url = base_url
        self.session = None
        self.test_results = []

    async def __aenter__(self):
        self.session = aiohttp.ClientSession()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()

    def log(self, message: str, status: str = "INFO"):
        """Log test message"""
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        print(f"[{timestamp}] [{status}] {message}")

    async def test_health_checks(self):
        """Test all health check endpoints"""
        self.log("Testing health check endpoints...")

        endpoints = [
            "/health",
            "/api/v1/health/logic-app",
            "/api/v1/health/ai-foundry",
            "/api/v1/health/webhook"
        ]

        for endpoint in endpoints:
            try:
                async with self.session.get(f"{self.base_url}{endpoint}") as resp:
                    data = await resp.json()
                    status = "✓" if resp.status == 200 else "✗"
                    self.log(f"{status} {endpoint}: {data.get('status', 'unknown')}")
                    self.test_results.append({
                        "test": f"Health Check: {endpoint}",
                        "passed": resp.status == 200,
                        "response": data
                    })
            except Exception as e:
                self.log(f"✗ {endpoint}: {str(e)}", "ERROR")
                self.test_results.append({
                    "test": f"Health Check: {endpoint}",
                    "passed": False,
                    "error": str(e)
                })

    async def test_webhook_logic_app(self):
        """Test Logic App webhook endpoint"""
        self.log("Testing Logic App webhook...")

        payload = {
            "action": "test",
            "data": {
                "message": "Test webhook from integration test",
                "timestamp": datetime.now().isoformat()
            }
        }

        try:
            async with self.session.post(
                f"{self.base_url}/api/v1/webhook/logic-app",
                json=payload,
                headers=HEADERS
            ) as resp:
                data = await resp.json()
                status = "✓" if resp.status == 200 else "✗"
                self.log(f"{status} Logic App webhook: {data.get('status', 'unknown')}")
                self.test_results.append({
                    "test": "Logic App Webhook",
                    "passed": resp.status == 200,
                    "response": data
                })
        except Exception as e:
            self.log(f"✗ Logic App webhook: {str(e)}", "ERROR")
            self.test_results.append({
                "test": "Logic App Webhook",
                "passed": False,
                "error": str(e)
            })

    async def test_agent_trigger(self):
        """Test agent trigger webhook"""
        self.log("Testing agent trigger webhook...")

        payload = {
            "action": "analyze",
            "data": {
                "message": "Analyze sales data for Q3 2025",
                "tools": ["query_powerbi_data", "analyze_data"]
            }
        }

        try:
            async with self.session.post(
                f"{self.base_url}/api/v1/webhook/agent-trigger",
                json=payload,
                headers=HEADERS
            ) as resp:
                data = await resp.json()
                status = "✓" if resp.status == 200 else "✗"
                self.log(f"{status} Agent trigger: {data.get('status', 'unknown')}")
                self.test_results.append({
                    "test": "Agent Trigger Webhook",
                    "passed": resp.status == 200,
                    "response": data
                })
                return data.get("thread_id")
        except Exception as e:
            self.log(f"✗ Agent trigger: {str(e)}", "ERROR")
            self.test_results.append({
                "test": "Agent Trigger Webhook",
                "passed": False,
                "error": str(e)
            })
            return None

    async def test_agent_run(self):
        """Test agent run endpoint"""
        self.log("Testing agent run endpoint...")

        payload = {
            "message": "What are the top 5 revenue generating products?",
            "agent_name": "test-agent",
            "tools": ["query_powerbi_data", "generate_report"]
        }

        try:
            async with self.session.post(
                f"{self.base_url}/api/v1/agent/run",
                json=payload,
                headers=HEADERS
            ) as resp:
                data = await resp.json()
                status = "✓" if resp.status == 200 else "✗"
                self.log(f"{status} Agent run: Thread ID: {data.get('thread_id', 'N/A')}")
                self.test_results.append({
                    "test": "Agent Run",
                    "passed": resp.status == 200,
                    "response": data
                })
                return data.get("thread_id")
        except Exception as e:
            self.log(f"✗ Agent run: {str(e)}", "ERROR")
            self.test_results.append({
                "test": "Agent Run",
                "passed": False,
                "error": str(e)
            })
            return None

    async def test_logic_app_trigger(self):
        """Test Logic App trigger endpoint"""
        self.log("Testing Logic App trigger...")

        payload = {
            "test": True,
            "message": "Test trigger from integration test",
            "timestamp": datetime.now().isoformat()
        }

        try:
            async with self.session.post(
                f"{self.base_url}/api/v1/logic-app/trigger",
                params={"workflow_name": "corppowerbiai"},
                json=payload,
                headers=HEADERS
            ) as resp:
                data = await resp.json()
                status = "✓" if resp.status == 200 else "✗"
                self.log(f"{status} Logic App trigger: {data.get('status', 'unknown')}")
                self.test_results.append({
                    "test": "Logic App Trigger",
                    "passed": resp.status == 200,
                    "response": data
                })
                return data.get("workflow_id")
        except Exception as e:
            self.log(f"✗ Logic App trigger: {str(e)}", "ERROR")
            self.test_results.append({
                "test": "Logic App Trigger",
                "passed": False,
                "error": str(e)
            })
            return None

    async def test_workflow_status(self, workflow_id: str):
        """Test workflow status endpoint"""
        if not workflow_id:
            self.log("Skipping workflow status test (no workflow ID)", "WARN")
            return

        self.log(f"Testing workflow status for {workflow_id}...")

        try:
            async with self.session.get(
                f"{self.base_url}/api/v1/logic-app/status/{workflow_id}"
            ) as resp:
                data = await resp.json()
                status = "✓" if resp.status == 200 else "✗"
                self.log(f"{status} Workflow status: {data.get('status', 'unknown')}")
                self.test_results.append({
                    "test": "Workflow Status",
                    "passed": resp.status == 200,
                    "response": data
                })
        except Exception as e:
            self.log(f"✗ Workflow status: {str(e)}", "ERROR")
            self.test_results.append({
                "test": "Workflow Status",
                "passed": False,
                "error": str(e)
            })

    async def test_callback_webhook(self):
        """Test callback webhook endpoint"""
        self.log("Testing callback webhook...")

        payload = {
            "workflow_id": "test-workflow-123",
            "response": {
                "status": "completed",
                "result": "Test callback successful"
            }
        }

        try:
            async with self.session.post(
                f"{self.base_url}/api/v1/webhook/callback",
                json=payload,
                headers=HEADERS
            ) as resp:
                data = await resp.json()
                status = "✓" if resp.status == 200 else "✗"
                self.log(f"{status} Callback webhook: {data.get('status', 'unknown')}")
                self.test_results.append({
                    "test": "Callback Webhook",
                    "passed": resp.status == 200,
                    "response": data
                })
        except Exception as e:
            self.log(f"✗ Callback webhook: {str(e)}", "ERROR")
            self.test_results.append({
                "test": "Callback Webhook",
                "passed": False,
                "error": str(e)
            })

    def print_summary(self):
        """Print test summary"""
        print("\n" + "="*60)
        print("TEST SUMMARY")
        print("="*60)

        passed = sum(1 for r in self.test_results if r["passed"])
        failed = len(self.test_results) - passed

        for result in self.test_results:
            status = "✓ PASS" if result["passed"] else "✗ FAIL"
            print(f"{status}: {result['test']}")

        print("="*60)
        print(f"Total: {len(self.test_results)} tests")
        print(f"Passed: {passed}")
        print(f"Failed: {failed}")
        print(f"Success Rate: {(passed/len(self.test_results)*100):.1f}%")

        return failed == 0

    async def run_all_tests(self):
        """Run all integration tests"""
        self.log("Starting Azure Integration Tests", "START")
        print("="*60)

        # Run tests
        await self.test_health_checks()
        print("-"*40)

        await self.test_webhook_logic_app()
        print("-"*40)

        thread_id = await self.test_agent_trigger()
        print("-"*40)

        await self.test_agent_run()
        print("-"*40)

        workflow_id = await self.test_logic_app_trigger()
        print("-"*40)

        await self.test_workflow_status(workflow_id)
        print("-"*40)

        await self.test_callback_webhook()

        # Print summary
        success = self.print_summary()

        if success:
            self.log("All tests passed!", "SUCCESS")
        else:
            self.log("Some tests failed. Check the output above.", "FAIL")

        return success


async def main():
    """Main test execution"""
    async with AzureIntegrationTester() as tester:
        success = await tester.run_all_tests()
        sys.exit(0 if success else 1)


if __name__ == "__main__":
    print("Azure Logic Apps & AI Foundry Integration Test Suite")
    print("="*60)
    asyncio.run(main())