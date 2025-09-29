"""
Unit tests for WebSocket Service
Tests the WebSocket connection management and real-time communication
"""

import pytest
import asyncio
import json
from unittest.mock import Mock, AsyncMock, patch, MagicMock
from datetime import datetime
from typing import Dict, List, Set

# Import the service we're testing
import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '../../../backend'))

from app.services.websocket import ConnectionManager


class MockWebSocket:
    """Mock WebSocket for testing"""

    def __init__(self):
        self.closed = False
        self.sent_messages = []
        self.receive_queue = []
        self.accept_called = False

    async def accept(self):
        self.accept_called = True

    async def send_text(self, data: str):
        if self.closed:
            raise Exception("WebSocket is closed")
        self.sent_messages.append(data)

    async def send_json(self, data: dict):
        if self.closed:
            raise Exception("WebSocket is closed")
        self.sent_messages.append(json.dumps(data))

    async def receive_text(self):
        if self.receive_queue:
            return self.receive_queue.pop(0)
        raise Exception("No messages in queue")

    async def receive_json(self):
        if self.receive_queue:
            message = self.receive_queue.pop(0)
            return json.loads(message)
        raise Exception("No messages in queue")

    async def close(self):
        self.closed = True

    def add_message(self, message: str):
        """Add message to receive queue for testing"""
        self.receive_queue.append(message)


class TestConnectionManager:
    """Test suite for Connection Manager"""

    @pytest.fixture
    def connection_manager(self):
        """Create Connection Manager instance for testing"""
        return ConnectionManager()

    @pytest.fixture
    def mock_websocket(self):
        """Create mock WebSocket for testing"""
        return MockWebSocket()

    @pytest.mark.asyncio
    async def test_connect_new_client(self, connection_manager, mock_websocket):
        """Test connecting a new WebSocket client"""
        # Execute test
        client_id = await connection_manager.connect(mock_websocket)

        # Assertions
        assert client_id is not None
        assert len(client_id) > 0
        assert client_id in connection_manager.active_connections
        assert connection_manager.active_connections[client_id] == mock_websocket
        assert client_id in connection_manager.connection_metadata
        assert client_id in connection_manager.message_queues

    @pytest.mark.asyncio
    async def test_connect_with_custom_client_id(self, connection_manager, mock_websocket):
        """Test connecting with a custom client ID"""
        custom_id = "custom-client-123"

        # Execute test
        client_id = await connection_manager.connect(mock_websocket, custom_id)

        # Assertions
        assert client_id == custom_id
        assert client_id in connection_manager.active_connections

    @pytest.mark.asyncio
    async def test_disconnect_existing_client(self, connection_manager, mock_websocket):
        """Test disconnecting an existing client"""
        # Setup - connect first
        client_id = await connection_manager.connect(mock_websocket)
        assert client_id in connection_manager.active_connections

        # Execute test
        connection_manager.disconnect(client_id)

        # Assertions
        assert client_id not in connection_manager.active_connections
        assert client_id not in connection_manager.connection_metadata
        assert client_id not in connection_manager.message_queues

    def test_disconnect_nonexistent_client(self, connection_manager):
        """Test disconnecting a non-existent client"""
        # This should not raise an exception
        connection_manager.disconnect("non-existent-id")

        # Should still work normally
        assert len(connection_manager.active_connections) == 0

    @pytest.mark.asyncio
    async def test_send_personal_message(self, connection_manager, mock_websocket):
        """Test sending a personal message to a specific client"""
        # Setup - connect client
        client_id = await connection_manager.connect(mock_websocket)

        # Execute test
        test_message = "Hello, client!"
        await connection_manager.send_personal_message(test_message, client_id)

        # Assertions
        assert len(mock_websocket.sent_messages) == 1
        assert mock_websocket.sent_messages[0] == test_message

    @pytest.mark.asyncio
    async def test_send_personal_message_nonexistent_client(self, connection_manager):
        """Test sending message to non-existent client"""
        # Should not raise an exception
        await connection_manager.send_personal_message("Hello", "non-existent")

    @pytest.mark.asyncio
    async def test_send_json_message(self, connection_manager, mock_websocket):
        """Test sending JSON message to client"""
        # Setup - connect client
        client_id = await connection_manager.connect(mock_websocket)

        # Execute test
        test_data = {"type": "message", "content": "Hello JSON!", "timestamp": "2024-01-01T00:00:00Z"}
        await connection_manager.send_json_message(test_data, client_id)

        # Assertions
        assert len(mock_websocket.sent_messages) == 1
        sent_data = json.loads(mock_websocket.sent_messages[0])
        assert sent_data == test_data

    @pytest.mark.asyncio
    async def test_broadcast_message(self, connection_manager):
        """Test broadcasting message to all connected clients"""
        # Setup - connect multiple clients
        ws1 = MockWebSocket()
        ws2 = MockWebSocket()
        ws3 = MockWebSocket()

        client1 = await connection_manager.connect(ws1)
        client2 = await connection_manager.connect(ws2)
        client3 = await connection_manager.connect(ws3)

        # Execute test
        broadcast_message = "Broadcast to all!"
        await connection_manager.broadcast(broadcast_message)

        # Assertions
        assert len(ws1.sent_messages) == 1
        assert len(ws2.sent_messages) == 1
        assert len(ws3.sent_messages) == 1
        assert ws1.sent_messages[0] == broadcast_message
        assert ws2.sent_messages[0] == broadcast_message
        assert ws3.sent_messages[0] == broadcast_message

    @pytest.mark.asyncio
    async def test_broadcast_json_message(self, connection_manager):
        """Test broadcasting JSON message to all connected clients"""
        # Setup - connect multiple clients
        ws1 = MockWebSocket()
        ws2 = MockWebSocket()

        client1 = await connection_manager.connect(ws1)
        client2 = await connection_manager.connect(ws2)

        # Execute test
        broadcast_data = {"type": "broadcast", "message": "Hello everyone!"}
        await connection_manager.broadcast_json(broadcast_data)

        # Assertions
        assert len(ws1.sent_messages) == 1
        assert len(ws2.sent_messages) == 1

        sent_data1 = json.loads(ws1.sent_messages[0])
        sent_data2 = json.loads(ws2.sent_messages[0])
        assert sent_data1 == broadcast_data
        assert sent_data2 == broadcast_data

    @pytest.mark.asyncio
    async def test_connection_metadata_tracking(self, connection_manager, mock_websocket):
        """Test that connection metadata is properly tracked"""
        # Execute test
        client_id = await connection_manager.connect(mock_websocket)

        # Assertions
        metadata = connection_manager.connection_metadata[client_id]
        assert "connected_at" in metadata
        assert "client_id" in metadata
        assert metadata["client_id"] == client_id

        # Test timestamp is recent
        connected_at = datetime.fromisoformat(metadata["connected_at"])
        time_diff = datetime.utcnow() - connected_at
        assert time_diff.total_seconds() < 10  # Connected within last 10 seconds

    @pytest.mark.asyncio
    async def test_message_queue_initialization(self, connection_manager, mock_websocket):
        """Test that message queues are initialized for new connections"""
        # Execute test
        client_id = await connection_manager.connect(mock_websocket)

        # Assertions
        assert client_id in connection_manager.message_queues
        assert connection_manager.message_queues[client_id] == []

    @pytest.mark.asyncio
    async def test_send_message_to_closed_websocket(self, connection_manager):
        """Test sending message to a closed WebSocket"""
        # Setup - connect and then close websocket
        mock_websocket = MockWebSocket()
        client_id = await connection_manager.connect(mock_websocket)
        mock_websocket.closed = True

        # Execute test - should not raise exception
        await connection_manager.send_personal_message("test", client_id)

        # The connection manager should handle the error gracefully

    @pytest.mark.asyncio
    async def test_multiple_connections_different_ids(self, connection_manager):
        """Test that multiple connections get different IDs"""
        # Connect multiple clients
        ws1 = MockWebSocket()
        ws2 = MockWebSocket()
        ws3 = MockWebSocket()

        client1 = await connection_manager.connect(ws1)
        client2 = await connection_manager.connect(ws2)
        client3 = await connection_manager.connect(ws3)

        # Assertions
        assert client1 != client2
        assert client2 != client3
        assert client1 != client3
        assert len(connection_manager.active_connections) == 3

    def test_get_connection_count(self, connection_manager):
        """Test getting the number of active connections"""
        # Initial count should be 0
        assert len(connection_manager.active_connections) == 0

    @pytest.mark.asyncio
    async def test_connection_resilience(self, connection_manager):
        """Test connection manager resilience to various scenarios"""
        # Connect multiple clients
        ws1 = MockWebSocket()
        ws2 = MockWebSocket()

        client1 = await connection_manager.connect(ws1)
        client2 = await connection_manager.connect(ws2)

        # Simulate one connection failing
        ws1.closed = True

        # Broadcast should still work for healthy connections
        await connection_manager.broadcast("Test message")

        # Only the healthy connection should receive the message
        assert len(ws2.sent_messages) == 1
        assert ws2.sent_messages[0] == "Test message"

    @pytest.mark.asyncio
    async def test_concurrent_connections(self, connection_manager):
        """Test handling concurrent connections"""
        # Create multiple websockets
        websockets = [MockWebSocket() for _ in range(10)]

        # Connect them concurrently
        tasks = [connection_manager.connect(ws) for ws in websockets]
        client_ids = await asyncio.gather(*tasks)

        # Assertions
        assert len(client_ids) == 10
        assert len(set(client_ids)) == 10  # All IDs should be unique
        assert len(connection_manager.active_connections) == 10

    @pytest.mark.asyncio
    async def test_message_ordering(self, connection_manager, mock_websocket):
        """Test that messages are sent in correct order"""
        # Setup
        client_id = await connection_manager.connect(mock_websocket)

        # Send multiple messages
        messages = ["Message 1", "Message 2", "Message 3"]
        for message in messages:
            await connection_manager.send_personal_message(message, client_id)

        # Assertions
        assert len(mock_websocket.sent_messages) == 3
        for i, message in enumerate(messages):
            assert mock_websocket.sent_messages[i] == message

    @pytest.mark.asyncio
    async def test_clean_disconnect(self, connection_manager, mock_websocket):
        """Test clean disconnection process"""
        # Setup
        client_id = await connection_manager.connect(mock_websocket)
        initial_connections = len(connection_manager.active_connections)

        # Verify connection is established
        assert client_id in connection_manager.active_connections

        # Clean disconnect
        connection_manager.disconnect(client_id)

        # Verify cleanup
        assert len(connection_manager.active_connections) == initial_connections - 1
        assert client_id not in connection_manager.active_connections
        assert client_id not in connection_manager.connection_metadata
        assert client_id not in connection_manager.message_queues


if __name__ == "__main__":
    pytest.main([__file__])