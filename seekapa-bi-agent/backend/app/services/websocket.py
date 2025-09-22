"""
WebSocket Manager
Handles real-time bidirectional communication for chat functionality
"""

import json
import logging
from typing import Dict, List, Set
from fastapi import WebSocket, WebSocketDisconnect
import asyncio
from datetime import datetime
import uuid

logger = logging.getLogger(__name__)


class ConnectionManager:
    """Manages WebSocket connections and message broadcasting"""

    def __init__(self):
        # Store active connections
        self.active_connections: Dict[str, WebSocket] = {}
        # Store connection metadata
        self.connection_metadata: Dict[str, Dict] = {}
        # Message queues for each connection
        self.message_queues: Dict[str, List[Dict]] = {}

    async def connect(self, websocket: WebSocket, client_id: str = None) -> str:
        """
        Accept a new WebSocket connection

        Args:
            websocket: WebSocket instance
            client_id: Optional client identifier

        Returns:
            Client ID for this connection
        """
        await websocket.accept()

        # Generate client ID if not provided
        if not client_id:
            client_id = str(uuid.uuid4())

        self.active_connections[client_id] = websocket
        self.connection_metadata[client_id] = {
            "connected_at": datetime.now().isoformat(),
            "last_activity": datetime.now().isoformat(),
            "message_count": 0
        }
        self.message_queues[client_id] = []

        logger.info(f"Client {client_id} connected. Total connections: {len(self.active_connections)}")

        # Send welcome message
        await self.send_personal_message(
            {
                "type": "connection",
                "status": "connected",
                "client_id": client_id,
                "message": "Welcome to Seekapa Copilot! I'm ready to help you analyze DS-Axia data.",
                "timestamp": datetime.now().isoformat()
            },
            client_id
        )

        return client_id

    def disconnect(self, client_id: str):
        """
        Remove a WebSocket connection

        Args:
            client_id: Client identifier to disconnect
        """
        if client_id in self.active_connections:
            del self.active_connections[client_id]
            del self.connection_metadata[client_id]
            if client_id in self.message_queues:
                del self.message_queues[client_id]

            logger.info(f"Client {client_id} disconnected. Remaining connections: {len(self.active_connections)}")

    async def send_personal_message(self, message: Dict, client_id: str):
        """
        Send a message to a specific client

        Args:
            message: Message dictionary to send
            client_id: Target client identifier
        """
        if client_id in self.active_connections:
            websocket = self.active_connections[client_id]
            try:
                await websocket.send_json(message)

                # Update metadata
                self.connection_metadata[client_id]["last_activity"] = datetime.now().isoformat()
                self.connection_metadata[client_id]["message_count"] += 1

                # Store in queue
                if client_id in self.message_queues:
                    self.message_queues[client_id].append(message)
                    # Keep only last 100 messages
                    if len(self.message_queues[client_id]) > 100:
                        self.message_queues[client_id] = self.message_queues[client_id][-100:]

            except Exception as e:
                logger.error(f"Error sending message to {client_id}: {str(e)}")
                self.disconnect(client_id)

    async def broadcast(self, message: Dict, exclude_client: str = None):
        """
        Broadcast a message to all connected clients

        Args:
            message: Message to broadcast
            exclude_client: Optional client ID to exclude from broadcast
        """
        disconnected_clients = []

        for client_id, websocket in self.active_connections.items():
            if client_id != exclude_client:
                try:
                    await websocket.send_json(message)
                except Exception as e:
                    logger.error(f"Error broadcasting to {client_id}: {str(e)}")
                    disconnected_clients.append(client_id)

        # Clean up disconnected clients
        for client_id in disconnected_clients:
            self.disconnect(client_id)

    async def send_typing_indicator(self, client_id: str, is_typing: bool = True):
        """
        Send typing indicator to client

        Args:
            client_id: Target client
            is_typing: Whether the assistant is typing
        """
        await self.send_personal_message(
            {
                "type": "typing",
                "is_typing": is_typing,
                "timestamp": datetime.now().isoformat()
            },
            client_id
        )

    async def send_error(self, client_id: str, error_message: str, error_code: str = None):
        """
        Send error message to client

        Args:
            client_id: Target client
            error_message: Error description
            error_code: Optional error code
        """
        await self.send_personal_message(
            {
                "type": "error",
                "error": error_message,
                "error_code": error_code,
                "timestamp": datetime.now().isoformat()
            },
            client_id
        )

    async def handle_heartbeat(self, client_id: str):
        """
        Handle heartbeat from client to maintain connection

        Args:
            client_id: Client sending heartbeat
        """
        if client_id in self.connection_metadata:
            self.connection_metadata[client_id]["last_activity"] = datetime.now().isoformat()

        await self.send_personal_message(
            {
                "type": "heartbeat",
                "status": "alive",
                "timestamp": datetime.now().isoformat()
            },
            client_id
        )

    def get_connection_stats(self) -> Dict:
        """
        Get statistics about current connections

        Returns:
            Connection statistics dictionary
        """
        total_messages = sum(
            metadata["message_count"]
            for metadata in self.connection_metadata.values()
        )

        return {
            "active_connections": len(self.active_connections),
            "total_messages": total_messages,
            "connections": [
                {
                    "client_id": client_id,
                    "connected_at": metadata["connected_at"],
                    "last_activity": metadata["last_activity"],
                    "message_count": metadata["message_count"]
                }
                for client_id, metadata in self.connection_metadata.items()
            ]
        }

    async def cleanup_inactive_connections(self, timeout_minutes: int = 30):
        """
        Clean up inactive connections

        Args:
            timeout_minutes: Minutes of inactivity before disconnection
        """
        current_time = datetime.now()
        disconnected = []

        for client_id, metadata in self.connection_metadata.items():
            last_activity = datetime.fromisoformat(metadata["last_activity"])
            if (current_time - last_activity).total_seconds() > timeout_minutes * 60:
                logger.info(f"Disconnecting inactive client: {client_id}")
                disconnected.append(client_id)

        for client_id in disconnected:
            await self.send_personal_message(
                {
                    "type": "disconnect",
                    "reason": "inactivity",
                    "message": "Connection closed due to inactivity"
                },
                client_id
            )
            self.disconnect(client_id)

        return len(disconnected)


class WebSocketManager:
    """Main WebSocket manager for the application"""

    def __init__(self):
        self.connection_manager = ConnectionManager()
        self.cleanup_task = None

    async def start_cleanup_task(self):
        """Start the periodic cleanup task"""
        async def cleanup_loop():
            while True:
                try:
                    await asyncio.sleep(300)  # Run every 5 minutes
                    disconnected = await self.connection_manager.cleanup_inactive_connections()
                    if disconnected > 0:
                        logger.info(f"Cleaned up {disconnected} inactive connections")
                except Exception as e:
                    logger.error(f"Error in cleanup task: {str(e)}")

        self.cleanup_task = asyncio.create_task(cleanup_loop())

    async def stop_cleanup_task(self):
        """Stop the cleanup task"""
        if self.cleanup_task:
            self.cleanup_task.cancel()
            try:
                await self.cleanup_task
            except asyncio.CancelledError:
                pass

    async def handle_client_message(
        self,
        websocket: WebSocket,
        client_id: str,
        ai_service,
        powerbi_service,
        conversation_history: List[Dict]
    ):
        """
        Handle incoming messages from a client

        Args:
            websocket: WebSocket connection
            client_id: Client identifier
            ai_service: Azure AI service instance
            powerbi_service: Power BI service instance
            conversation_history: Conversation history for context
        """
        try:
            while True:
                # Receive message from client
                data = await websocket.receive_json()

                # Handle different message types
                message_type = data.get("type", "chat")

                if message_type == "heartbeat":
                    await self.connection_manager.handle_heartbeat(client_id)

                elif message_type == "chat":
                    user_message = data.get("message", "")
                    context = data.get("context", {})

                    # Send typing indicator
                    await self.connection_manager.send_typing_indicator(client_id, True)

                    # Build messages for AI
                    messages = [{"role": "user", "content": user_message}]

                    # Add conversation history (last 5 turns)
                    if conversation_history:
                        for turn in conversation_history[-5:]:
                            messages.insert(0, {"role": "assistant", "content": turn.get("assistant", "")})
                            messages.insert(0, {"role": "user", "content": turn.get("user", "")})

                    # Get AI response
                    if data.get("stream", False):
                        # Stream response
                        full_response = ""
                        async for chunk in ai_service.call_gpt5(
                            messages=messages,
                            query=user_message,
                            context=context,
                            stream=True,
                            conversation_history=conversation_history
                        ):
                            full_response += chunk
                            await self.connection_manager.send_personal_message(
                                {
                                    "type": "stream",
                                    "content": chunk,
                                    "timestamp": datetime.now().isoformat()
                                },
                                client_id
                            )

                        # Send completion marker
                        await self.connection_manager.send_personal_message(
                            {
                                "type": "stream_end",
                                "full_response": full_response,
                                "timestamp": datetime.now().isoformat()
                            },
                            client_id
                        )

                        # Store in history
                        conversation_history.append({
                            "user": user_message,
                            "assistant": full_response,
                            "timestamp": datetime.now().isoformat()
                        })

                    else:
                        # Get complete response
                        ai_response = await ai_service.call_gpt5(
                            messages=messages,
                            query=user_message,
                            context=context,
                            stream=False,
                            conversation_history=conversation_history
                        )

                        # Send response
                        await self.connection_manager.send_personal_message(
                            {
                                "type": "response",
                                "message": ai_response,
                                "model_used": context.get("model", "auto-selected"),
                                "timestamp": datetime.now().isoformat()
                            },
                            client_id
                        )

                        # Store in history
                        conversation_history.append({
                            "user": user_message,
                            "assistant": ai_response,
                            "timestamp": datetime.now().isoformat()
                        })

                    # Stop typing indicator
                    await self.connection_manager.send_typing_indicator(client_id, False)

                elif message_type == "query_data":
                    # Execute DAX query
                    dax_query = data.get("query", "")
                    result = await powerbi_service.query_axia_data(dax_query)

                    await self.connection_manager.send_personal_message(
                        {
                            "type": "data_result",
                            "result": result,
                            "query": dax_query,
                            "timestamp": datetime.now().isoformat()
                        },
                        client_id
                    )

                elif message_type == "get_dataset_info":
                    # Get dataset information
                    dataset_info = await powerbi_service.get_axia_dataset_details()

                    await self.connection_manager.send_personal_message(
                        {
                            "type": "dataset_info",
                            "info": dataset_info,
                            "timestamp": datetime.now().isoformat()
                        },
                        client_id
                    )

        except WebSocketDisconnect:
            self.connection_manager.disconnect(client_id)
            logger.info(f"Client {client_id} disconnected normally")

        except Exception as e:
            logger.error(f"Error handling client {client_id}: {str(e)}", exc_info=True)
            await self.connection_manager.send_error(
                client_id,
                f"An error occurred: {str(e)}",
                "HANDLER_ERROR"
            )
            self.connection_manager.disconnect(client_id)