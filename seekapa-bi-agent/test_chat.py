#!/usr/bin/env python3
"""Test WebSocket chat functionality"""

import asyncio
import json
import websockets

async def test_chat():
    uri = "ws://localhost:8000/ws/chat"

    async with websockets.connect(uri) as websocket:
        print("✅ Connected to WebSocket")

        # Send a test message
        message = {
            "content": "What are the top 3 revenue drivers?",
            "streaming": False
        }

        await websocket.send(json.dumps(message))
        print(f"📤 Sent: {message['content']}")

        # Wait for response
        response = await websocket.recv()
        data = json.loads(response)

        print(f"📥 Response received in {data.get('timestamp', 'N/A')}")
        response_text = data.get('message', data.get('content', data.get('response', 'No content')))
        print(f"💬 Response: {response_text[:200]}...")
        print(f"✅ Chat test successful!")

if __name__ == "__main__":
    asyncio.run(test_chat())