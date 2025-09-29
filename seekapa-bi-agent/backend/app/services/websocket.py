"""
WebSocket Manager with Performance Optimizations
Handles real-time bidirectional communication for chat functionality
Optimized for 100+ concurrent connections with <100ms latency
"""

import json
import logging
import gzip
import time
from typing import Dict, List, Set, Optional, Any
from fastapi import WebSocket, WebSocketDisconnect
import asyncio
from datetime import datetime
import uuid
from collections import defaultdict, deque
from asyncio import Queue, Task
import hashlib

logger = logging.getLogger(__name__)


class ConnectionPool:
    """Connection pool for managing WebSocket connections efficiently"""

    def __init__(self, max_connections: int = 1000):
        self.max_connections = max_connections
        self.semaphore = asyncio.Semaphore(max_connections)
        self.active_count = 0
        self.waiting_queue: deque = deque()

    async def acquire(self) -> bool:
        """Acquire a connection slot"""
        if self.active_count >= self.max_connections:
            return False
        await self.semaphore.acquire()
        self.active_count += 1
        return True

    def release(self):
        """Release a connection slot"""
        self.active_count -= 1
        self.semaphore.release()

    def get_stats(self) -> Dict:
        """Get pool statistics"""
        return {
            "active": self.active_count,
            "max": self.max_connections,
            "available": self.max_connections - self.active_count,
            "waiting": len(self.waiting_queue)
        }


class MessageBatcher:
    """Batch messages for efficient transmission"""

    def __init__(self, batch_window_ms: int = 100, max_batch_size: int = 50):
        self.batch_window_ms = batch_window_ms
        self.max_batch_size = max_batch_size
        self.batches: Dict[str, List[Dict]] = defaultdict(list)
        self.batch_tasks: Dict[str, Task] = {}
        self.batch_locks: Dict[str, asyncio.Lock] = defaultdict(asyncio.Lock)

    async def add_message(self, client_id: str, message: Dict) -> bool:
        """Add message to batch for client"""
        async with self.batch_locks[client_id]:
            self.batches[client_id].append(message)

            # Send immediately if batch is full
            if len(self.batches[client_id]) >= self.max_batch_size:
                return True

            # Schedule batch send if not already scheduled
            if client_id not in self.batch_tasks or self.batch_tasks[client_id].done():
                self.batch_tasks[client_id] = asyncio.create_task(
                    self._delayed_batch_send(client_id)
                )
            return False

    async def _delayed_batch_send(self, client_id: str):
        """Send batch after delay"""
        await asyncio.sleep(self.batch_window_ms / 1000)
        return True

    def get_batch(self, client_id: str) -> List[Dict]:
        """Get and clear batch for client"""
        batch = self.batches[client_id].copy()
        self.batches[client_id].clear()
        return batch


class ConnectionManager:
    """Manages WebSocket connections with performance optimizations"""

    def __init__(self):
        # Connection pool for managing max connections
        self.connection_pool = ConnectionPool(max_connections=1000)

        # Store active connections
        self.active_connections: Dict[str, WebSocket] = {}

        # Connection metadata with optimized storage
        self.connection_metadata: Dict[str, Dict] = {}

        # Message queues with size limits
        self.message_queues: Dict[str, deque] = defaultdict(lambda: deque(maxlen=100))

        # Message batching for efficient transmission
        self.message_batcher = MessageBatcher(batch_window_ms=100, max_batch_size=50)

        # Compression settings
        self.compression_enabled = True
        self.compression_level = 6  # gzip level 6 for balance

        # Heartbeat settings
        self.heartbeat_interval = 30  # seconds
        self.heartbeat_tasks: Dict[str, Task] = {}

        # Smart routing groups for preventing N-squared broadcasting
        self.connection_groups: Dict[str, Set[str]] = defaultdict(set)
        self.client_groups: Dict[str, Set[str]] = defaultdict(set)

        # Message deduplication cache (prevent duplicate messages)
        self.message_cache: Dict[str, str] = {}
        self.cache_size_limit = 1000

    async def connect(self, websocket: WebSocket, client_id: str = None, group_id: str = "default") -> Optional[str]:
        """
        Accept a new WebSocket connection with connection pooling

        Args:
            websocket: WebSocket instance
            client_id: Optional client identifier
            group_id: Group for smart message routing

        Returns:
            Client ID for this connection, or None if pool is full
        """
        # Check connection pool availability
        if not await self.connection_pool.acquire():
            logger.warning(f"Connection pool full. Rejecting new connection.")
            await websocket.close(code=1013, reason="Server capacity reached")
            return None

        try:
            await websocket.accept()

            # Generate client ID if not provided
            if not client_id:
                client_id = str(uuid.uuid4())

            # Store connection
            self.active_connections[client_id] = websocket

            # Optimized metadata storage
            self.connection_metadata[client_id] = {
                "connected_at": time.time(),
                "last_activity": time.time(),
                "message_count": 0,
                "group": group_id,
                "compression_supported": True
            }

            # Add to routing group
            self.connection_groups[group_id].add(client_id)
            self.client_groups[client_id].add(group_id)

            # Start heartbeat task
            self.heartbeat_tasks[client_id] = asyncio.create_task(
                self._heartbeat_loop(client_id)
            )

            logger.info(f"Client {client_id} connected to group {group_id}. Total: {len(self.active_connections)}")

            # Send optimized welcome message
            await self.send_personal_message(
                {
                    "type": "connection",
                    "status": "connected",
                    "client_id": client_id,
                    "group": group_id,
                    "compression": self.compression_enabled,
                    "heartbeat_interval": self.heartbeat_interval,
                    "message": "Welcome to Seekapa Copilot! Ready for high-performance analysis.",
                    "timestamp": datetime.now().isoformat(),
                    "pool_stats": self.connection_pool.get_stats()
                },
                client_id,
                bypass_batch=True
            )

            return client_id

        except Exception as e:
            logger.error(f"Error during connection: {str(e)}")
            self.connection_pool.release()
            raise

    async def _heartbeat_loop(self, client_id: str):
        """Send periodic heartbeats to maintain connection"""
        try:
            while client_id in self.active_connections:
                await asyncio.sleep(self.heartbeat_interval)
                await self.send_personal_message(
                    {
                        "type": "heartbeat",
                        "timestamp": time.time()
                    },
                    client_id,
                    bypass_batch=True
                )
        except asyncio.CancelledError:
            pass

    def disconnect(self, client_id: str):
        """
        Remove a WebSocket connection with cleanup

        Args:
            client_id: Client identifier to disconnect
        """
        if client_id in self.active_connections:
            # Cancel heartbeat task
            if client_id in self.heartbeat_tasks:
                self.heartbeat_tasks[client_id].cancel()
                del self.heartbeat_tasks[client_id]

            # Remove from groups
            for group_id in self.client_groups.get(client_id, set()):
                self.connection_groups[group_id].discard(client_id)
            self.client_groups.pop(client_id, None)

            # Clean up connection data
            del self.active_connections[client_id]
            del self.connection_metadata[client_id]
            self.message_queues.pop(client_id, None)

            # Release connection pool slot
            self.connection_pool.release()

            logger.info(f"Client {client_id} disconnected. Active: {len(self.active_connections)}")

    def _compress_message(self, message: Dict) -> bytes:
        """Compress message using gzip"""
        json_str = json.dumps(message)
        return gzip.compress(json_str.encode(), compresslevel=self.compression_level)

    def _get_message_hash(self, message: Dict) -> str:
        """Generate hash for message deduplication"""
        msg_str = json.dumps(message, sort_keys=True)
        return hashlib.md5(msg_str.encode()).hexdigest()

    async def send_personal_message(
        self,
        message: Dict,
        client_id: str,
        bypass_batch: bool = False,
        use_compression: bool = None
    ):
        """
        Send a message to a specific client with optimizations

        Args:
            message: Message dictionary to send
            client_id: Target client identifier
            bypass_batch: Skip batching for immediate send
            use_compression: Override compression setting
        """
        if client_id not in self.active_connections:
            return

        try:
            # Check for duplicate messages
            msg_hash = self._get_message_hash(message)
            if msg_hash in self.message_cache.get(client_id, set()):
                logger.debug(f"Skipping duplicate message to {client_id}")
                return

            # Add to deduplication cache
            if client_id not in self.message_cache:
                self.message_cache[client_id] = set()
            self.message_cache[client_id].add(msg_hash)

            # Limit cache size
            if len(self.message_cache[client_id]) > self.cache_size_limit:
                self.message_cache[client_id] = set(
                    list(self.message_cache[client_id])[-self.cache_size_limit:]
                )

            # Update metadata
            self.connection_metadata[client_id]["last_activity"] = time.time()
            self.connection_metadata[client_id]["message_count"] += 1

            # Store in queue
            self.message_queues[client_id].append(message)

            # Handle batching
            if not bypass_batch:
                should_send_now = await self.message_batcher.add_message(client_id, message)
                if not should_send_now:
                    return  # Message will be sent in batch

            # Get messages to send (batch or single)
            messages_to_send = (
                self.message_batcher.get_batch(client_id)
                if not bypass_batch
                else [message]
            )

            # Prepare payload
            websocket = self.active_connections[client_id]
            payload = messages_to_send[0] if len(messages_to_send) == 1 else {
                "type": "batch",
                "messages": messages_to_send
            }

            # Apply compression if enabled
            if use_compression is None:
                use_compression = (
                    self.compression_enabled and
                    self.connection_metadata[client_id].get("compression_supported", False)
                )

            if use_compression and len(json.dumps(payload)) > 1024:  # Compress only larger messages
                compressed = self._compress_message(payload)
                await websocket.send_bytes(compressed)
            else:
                await websocket.send_json(payload)

        except Exception as e:
            logger.error(f"Error sending message to {client_id}: {str(e)}")
            self.disconnect(client_id)

    async def broadcast(self, message: Dict, exclude_client: str = None, group_id: str = None):
        """
        Broadcast a message with smart routing to prevent N-squared problem

        Args:
            message: Message to broadcast
            exclude_client: Optional client ID to exclude from broadcast
            group_id: Optional group ID for targeted broadcast
        """
        disconnected_clients = []

        # Determine target clients based on group
        if group_id:
            target_clients = self.connection_groups.get(group_id, set())
        else:
            target_clients = set(self.active_connections.keys())

        # Remove excluded client
        if exclude_client:
            target_clients = target_clients - {exclude_client}

        # Use batch sending for efficiency
        send_tasks = []

        for client_id in target_clients:
            if client_id in self.active_connections:
                websocket = self.active_connections[client_id]
                # Create async task for parallel sending
                task = self._send_with_error_handling(client_id, websocket, message)
                send_tasks.append(task)

        # Execute all sends in parallel
        results = await asyncio.gather(*send_tasks, return_exceptions=True)

        # Collect disconnected clients
        for client_id, result in zip(target_clients, results):
            if isinstance(result, Exception):
                logger.error(f"Error broadcasting to {client_id}: {str(result)}")
                disconnected_clients.append(client_id)

        # Clean up disconnected clients
        for client_id in disconnected_clients:
            self.disconnect(client_id)

    async def _send_with_error_handling(self, client_id: str, websocket: WebSocket, message: Dict):
        """Helper method for sending with error handling"""
        try:
            # Apply compression for broadcast messages
            if self.compression_enabled and len(json.dumps(message)) > 1024:
                compressed = self._compress_message(message)
                await websocket.send_bytes(compressed)
            else:
                await websocket.send_json(message)
        except Exception as e:
            raise e

    async def send_typing_indicator(self, client_id: str, is_typing: bool = True):
        """
        Send typing indicator to client with bypass for low latency

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
            client_id,
            bypass_batch=True  # Bypass batching for immediate feedback
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
    """Main WebSocket manager for the application with performance monitoring"""

    def __init__(self):
        self.connection_manager = ConnectionManager()
        self.cleanup_task = None
        self.metrics_task = None
        self.performance_metrics = {
            "message_latency": deque(maxlen=1000),
            "connection_count": deque(maxlen=100),
            "message_throughput": deque(maxlen=100),
            "last_reset": time.time()
        }

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

        if self.metrics_task:
            self.metrics_task.cancel()
            try:
                await self.metrics_task
            except asyncio.CancelledError:
                pass

    async def start_metrics_task(self):
        """Start performance metrics collection"""
        async def metrics_loop():
            while True:
                try:
                    await asyncio.sleep(10)  # Collect metrics every 10 seconds
                    stats = self.connection_manager.get_connection_stats()
                    self.performance_metrics["connection_count"].append(stats["active_connections"])

                    # Calculate average latency
                    if self.performance_metrics["message_latency"]:
                        avg_latency = sum(self.performance_metrics["message_latency"]) / len(self.performance_metrics["message_latency"])
                        logger.info(f"Performance: Connections={stats['active_connections']}, Avg Latency={avg_latency:.2f}ms")
                except Exception as e:
                    logger.error(f"Error in metrics collection: {str(e)}")

        self.metrics_task = asyncio.create_task(metrics_loop())

    def record_message_latency(self, latency_ms: float):
        """Record message latency for monitoring"""
        self.performance_metrics["message_latency"].append(latency_ms)

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
                    logger.info(f"WebSocket chat message from {client_id}: {user_message[:100]}")

                    # Send typing indicator
                    await self.connection_manager.send_typing_indicator(client_id, True)
                    logger.debug(f"Sent typing indicator to {client_id}")

                    # Build messages for AI
                    messages = [{"role": "user", "content": user_message}]

                    # Add conversation history (last 5 turns)
                    if conversation_history:
                        for turn in conversation_history[-5:]:
                            messages.insert(0, {"role": "assistant", "content": turn.get("assistant", "")})
                            messages.insert(0, {"role": "user", "content": turn.get("user", "")})

                    # Get AI response
                    logger.info(f"Calling AI service for {client_id}, stream={data.get('stream', False)}")
                    if data.get("stream", False):
                        # Stream response
                        full_response = ""
                        response = await ai_service.call_gpt5(
                            messages=messages,
                            query=user_message,
                            context=context,
                            stream=True,
                            conversation_history=conversation_history
                        )

                        # Check if response is an async generator
                        if hasattr(response, '__aiter__'):
                            async for chunk in response:
                                full_response += chunk
                                await self.connection_manager.send_personal_message(
                                    {
                                        "type": "stream",
                                        "content": chunk,
                                        "timestamp": datetime.now().isoformat()
                                    },
                                    client_id
                                )
                        else:
                            # If not a generator, treat as complete response
                            full_response = response if isinstance(response, str) else str(response)
                            await self.connection_manager.send_personal_message(
                                {
                                    "type": "stream",
                                    "content": full_response,
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
                        logger.info(f"Getting non-streamed AI response for {client_id}")
                        ai_response = await ai_service.call_gpt5(
                            messages=messages,
                            query=user_message,
                            context=context,
                            stream=False,
                            conversation_history=conversation_history
                        )
                        logger.info(f"AI response received for {client_id}: {str(ai_response)[:200]}")

                        # Send response
                        response_msg = {
                            "type": "response",
                            "message": ai_response,
                            "model_used": context.get("model", "auto-selected"),
                            "timestamp": datetime.now().isoformat()
                        }
                        logger.info(f"Sending response to {client_id}: {response_msg}")
                        # CRITICAL: Bypass batching AND compression for chat responses to ensure immediate delivery
                        await self.connection_manager.send_personal_message(
                            response_msg,
                            client_id,
                            bypass_batch=True,
                            use_compression=False  # Disable compression - frontend expects JSON
                        )
                        logger.info(f"Response sent successfully to {client_id}")

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