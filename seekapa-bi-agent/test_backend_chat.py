#!/usr/bin/env python3
"""
Backend Chat Test Script
Tests the chat functionality step by step to identify issues
"""

import asyncio
import json
import aiohttp
import websockets
from datetime import datetime

BASE_URL = "http://localhost:8000"
WS_URL = "ws://localhost:8000/ws/chat"

async def test_health():
    """Test if backend is healthy"""
    print("=" * 50)
    print("1. Testing Health Endpoint")
    print("-" * 50)

    async with aiohttp.ClientSession() as session:
        async with session.get(f"{BASE_URL}/health") as response:
            if response.status == 200:
                data = await response.json()
                print("✅ Backend is healthy")
                print(f"   Services: {data.get('services', {})}")
                return True
            else:
                print(f"❌ Backend unhealthy: {response.status}")
                return False

async def test_rest_chat():
    """Test REST API chat endpoint"""
    print("\n" + "=" * 50)
    print("2. Testing REST API Chat Endpoint")
    print("-" * 50)

    test_message = "What is the total revenue in the Axia dataset?"

    async with aiohttp.ClientSession() as session:
        # Test the /api/chat endpoint
        payload = {
            "content": test_message,
            "streaming": False
        }

        print(f"📤 Sending: {test_message}")
        start_time = datetime.now()

        try:
            async with session.post(
                f"{BASE_URL}/api/chat",
                json=payload,
                timeout=aiohttp.ClientTimeout(total=30)
            ) as response:
                end_time = datetime.now()
                duration = (end_time - start_time).total_seconds()

                if response.status == 200:
                    data = await response.json()
                    print(f"✅ Response received in {duration:.2f}s")
                    print(f"   Response: {data.get('response', 'No response')[:200]}...")
                    return True
                else:
                    error_text = await response.text()
                    print(f"❌ API Error {response.status}: {error_text}")
                    return False
        except asyncio.TimeoutError:
            print("❌ Request timed out after 30 seconds")
            return False
        except Exception as e:
            print(f"❌ Error: {str(e)}")
            return False

async def test_websocket_chat():
    """Test WebSocket chat functionality"""
    print("\n" + "=" * 50)
    print("3. Testing WebSocket Chat")
    print("-" * 50)

    try:
        async with websockets.connect(WS_URL) as websocket:
            print("✅ WebSocket connected")

            # Wait for connection message
            try:
                connection_msg = await asyncio.wait_for(websocket.recv(), timeout=5)
                data = json.loads(connection_msg)
                print(f"   Connection ID: {data.get('client_id', 'unknown')}")
            except asyncio.TimeoutError:
                print("⚠️  No connection message received")

            # Send a test message
            test_message = "Hello from WebSocket test! What are the key metrics?"
            message = {
                "type": "chat",
                "message": test_message,
                "stream": False,
                "context": {
                    "dataset": "axia",
                    "timestamp": datetime.now().isoformat()
                }
            }

            print(f"📤 Sending: {test_message}")
            await websocket.send(json.dumps(message))

            # Wait for response
            print("⏳ Waiting for response...")
            start_time = datetime.now()

            try:
                while True:
                    response = await asyncio.wait_for(websocket.recv(), timeout=15)
                    data = json.loads(response)

                    if data.get("type") == "response":
                        end_time = datetime.now()
                        duration = (end_time - start_time).total_seconds()
                        print(f"✅ Response received in {duration:.2f}s")
                        print(f"   Type: {data.get('type')}")
                        print(f"   Message: {data.get('message', 'No message')[:200]}...")
                        return True
                    elif data.get("type") == "error":
                        print(f"❌ Error response: {data.get('error')}")
                        return False
                    elif data.get("type") == "typing":
                        print("   ... AI is typing")
                    else:
                        print(f"   Received: {data.get('type', 'unknown type')}")

            except asyncio.TimeoutError:
                print("❌ No response received within 15 seconds")
                return False

    except Exception as e:
        print(f"❌ WebSocket error: {str(e)}")
        return False

async def test_azure_ai_directly():
    """Test Azure AI service directly"""
    print("\n" + "=" * 50)
    print("4. Testing Azure AI Service Directly")
    print("-" * 50)

    # Import the Azure AI service
    import sys
    sys.path.append('/home/odedbe/Bi/seekapa-bi-agent/backend')

    try:
        from app.services.azure_ai import AzureAIService
        from app.config import settings

        service = AzureAIService()
        await service.initialize()

        messages = [
            {"role": "user", "content": "What is 2+2?"}
        ]

        print("📤 Testing direct GPT-5 call...")
        start_time = datetime.now()

        response = await service.call_gpt5(
            messages=messages,
            query="What is 2+2?",
            stream=False
        )

        end_time = datetime.now()
        duration = (end_time - start_time).total_seconds()

        if response and not response.startswith("An error"):
            print(f"✅ GPT-5 responded in {duration:.2f}s")
            print(f"   Response: {response[:200]}...")
            await service.cleanup()
            return True
        else:
            print(f"❌ GPT-5 error: {response}")
            await service.cleanup()
            return False

    except Exception as e:
        print(f"❌ Failed to test Azure AI: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

async def main():
    """Run all tests sequentially"""
    print("\n🔍 SEEKAPA BI AGENT - BACKEND CHAT TESTING")
    print("=" * 50)
    print(f"Time: {datetime.now().isoformat()}")
    print("=" * 50)

    results = {
        "health": False,
        "rest_api": False,
        "websocket": False,
        "azure_ai": False
    }

    # Run tests
    results["health"] = await test_health()

    if results["health"]:
        results["rest_api"] = await test_rest_chat()
        results["websocket"] = await test_websocket_chat()
        results["azure_ai"] = await test_azure_ai_directly()

    # Summary
    print("\n" + "=" * 50)
    print("TEST SUMMARY")
    print("=" * 50)

    for test, passed in results.items():
        status = "✅ PASSED" if passed else "❌ FAILED"
        print(f"{test.ljust(15)}: {status}")

    all_passed = all(results.values())
    print("\n" + "=" * 50)
    if all_passed:
        print("🎉 ALL TESTS PASSED - Chat is working!")
    else:
        print("⚠️ SOME TESTS FAILED - Issues found")
        print("\nNext steps:")
        if not results["health"]:
            print("1. Check if backend is running: ps aux | grep uvicorn")
        if not results["rest_api"]:
            print("2. Check backend logs for API errors")
        if not results["websocket"]:
            print("3. Check WebSocket handler in backend/app/main.py")
        if not results["azure_ai"]:
            print("4. Check Azure credentials and API version in .env")
    print("=" * 50)

if __name__ == "__main__":
    asyncio.run(main())