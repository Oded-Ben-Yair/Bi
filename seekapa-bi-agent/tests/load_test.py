#!/usr/bin/env python3
"""
Comprehensive Load Testing Suite for Seekapa BI Agent
Tests WebSocket, API, and overall system performance
"""

import asyncio
import time
import json
import statistics
import random
from typing import Dict, List, Any, Optional
from datetime import datetime
import websockets
import aiohttp
import psutil
import sys
from dataclasses import dataclass, asdict
from concurrent.futures import ThreadPoolExecutor
import argparse
from loguru import logger

# Configure logger
logger.add("load_test_{time}.log", rotation="100 MB")


@dataclass
class PerformanceMetrics:
    """Performance metrics data class"""
    test_name: str
    concurrent_users: int
    total_requests: int
    successful_requests: int
    failed_requests: int
    avg_latency_ms: float
    p50_latency_ms: float
    p95_latency_ms: float
    p99_latency_ms: float
    min_latency_ms: float
    max_latency_ms: float
    requests_per_second: float
    total_duration_s: float
    error_rate: float
    memory_usage_mb: float
    cpu_usage_percent: float
    timestamp: str = None

    def __post_init__(self):
        if not self.timestamp:
            self.timestamp = datetime.now().isoformat()


class WebSocketLoadTest:
    """WebSocket connection and messaging load test"""

    def __init__(self, base_url: str = "ws://localhost:8000"):
        self.base_url = base_url
        self.metrics: List[float] = []
        self.errors: List[str] = []
        self.connections: List[websockets.WebSocketClientProtocol] = []

    async def connect_client(self, client_id: int) -> Optional[websockets.WebSocketClientProtocol]:
        """Connect a single WebSocket client"""
        try:
            uri = f"{self.base_url}/ws/chat?client_id=load_test_{client_id}"
            websocket = await websockets.connect(uri)
            self.connections.append(websocket)
            logger.info(f"Client {client_id} connected")
            return websocket
        except Exception as e:
            self.errors.append(f"Connection error for client {client_id}: {str(e)}")
            logger.error(f"Failed to connect client {client_id}: {str(e)}")
            return None

    async def send_message(self, websocket: websockets.WebSocketClientProtocol, message: str) -> float:
        """Send message and measure latency"""
        start_time = time.perf_counter()

        try:
            # Send message
            await websocket.send(json.dumps({
                "type": "chat",
                "message": message,
                "timestamp": datetime.now().isoformat()
            }))

            # Wait for response
            response = await asyncio.wait_for(websocket.recv(), timeout=30.0)
            response_data = json.loads(response)

            # Calculate latency
            latency = (time.perf_counter() - start_time) * 1000
            self.metrics.append(latency)

            return latency

        except asyncio.TimeoutError:
            self.errors.append("Message timeout")
            return -1
        except Exception as e:
            self.errors.append(f"Message error: {str(e)}")
            return -1

    async def test_concurrent_connections(self, num_clients: int = 100) -> PerformanceMetrics:
        """Test concurrent WebSocket connections"""
        logger.info(f"Starting WebSocket load test with {num_clients} clients")

        start_time = time.time()
        tasks = []

        # Connect all clients
        for i in range(num_clients):
            tasks.append(self.connect_client(i))

        websockets_list = await asyncio.gather(*tasks)
        successful_connections = [ws for ws in websockets_list if ws is not None]

        logger.info(f"Connected {len(successful_connections)} out of {num_clients} clients")

        # Send messages from each client
        message_tasks = []
        test_messages = [
            "What is the total revenue for Axia?",
            "Show me the top performing products",
            "Analyze sales trends for last quarter",
            "Compare revenue across regions",
            "What are the key performance indicators?"
        ]

        for ws in successful_connections:
            if ws:
                message = random.choice(test_messages)
                message_tasks.append(self.send_message(ws, message))

        # Wait for all messages
        await asyncio.gather(*message_tasks)

        # Calculate metrics
        duration = time.time() - start_time
        successful_metrics = [m for m in self.metrics if m > 0]

        metrics = PerformanceMetrics(
            test_name="WebSocket Concurrent Connections",
            concurrent_users=num_clients,
            total_requests=len(message_tasks),
            successful_requests=len(successful_metrics),
            failed_requests=len(self.errors),
            avg_latency_ms=statistics.mean(successful_metrics) if successful_metrics else 0,
            p50_latency_ms=statistics.median(successful_metrics) if successful_metrics else 0,
            p95_latency_ms=statistics.quantiles(successful_metrics, n=20)[18] if len(successful_metrics) > 20 else max(successful_metrics, default=0),
            p99_latency_ms=statistics.quantiles(successful_metrics, n=100)[98] if len(successful_metrics) > 100 else max(successful_metrics, default=0),
            min_latency_ms=min(successful_metrics, default=0),
            max_latency_ms=max(successful_metrics, default=0),
            requests_per_second=len(successful_metrics) / duration if duration > 0 else 0,
            total_duration_s=duration,
            error_rate=len(self.errors) / len(message_tasks) * 100 if message_tasks else 0,
            memory_usage_mb=psutil.Process().memory_info().rss / 1024 / 1024,
            cpu_usage_percent=psutil.cpu_percent(interval=1)
        )

        # Close connections
        for ws in successful_connections:
            if ws:
                await ws.close()

        return metrics


class APILoadTest:
    """API endpoint load testing"""

    def __init__(self, base_url: str = "http://localhost:8000"):
        self.base_url = base_url
        self.session: Optional[aiohttp.ClientSession] = None
        self.metrics: List[float] = []
        self.errors: List[str] = []

    async def setup(self):
        """Setup HTTP session"""
        timeout = aiohttp.ClientTimeout(total=30)
        self.session = aiohttp.ClientSession(timeout=timeout)

    async def cleanup(self):
        """Cleanup HTTP session"""
        if self.session:
            await self.session.close()

    async def make_request(self, endpoint: str, method: str = "GET", data: Optional[Dict] = None) -> float:
        """Make HTTP request and measure latency"""
        start_time = time.perf_counter()

        try:
            url = f"{self.base_url}{endpoint}"

            if method == "GET":
                async with self.session.get(url) as response:
                    await response.text()
                    latency = (time.perf_counter() - start_time) * 1000
                    if response.status == 200:
                        self.metrics.append(latency)
                        return latency
                    else:
                        self.errors.append(f"HTTP {response.status}")
                        return -1

            elif method == "POST":
                async with self.session.post(url, json=data) as response:
                    await response.text()
                    latency = (time.perf_counter() - start_time) * 1000
                    if response.status in [200, 201]:
                        self.metrics.append(latency)
                        return latency
                    else:
                        self.errors.append(f"HTTP {response.status}")
                        return -1

        except Exception as e:
            self.errors.append(str(e))
            return -1

    async def test_api_throughput(self, requests_per_second: int = 1000, duration_seconds: int = 30) -> PerformanceMetrics:
        """Test API throughput"""
        logger.info(f"Starting API load test: {requests_per_second} req/s for {duration_seconds}s")

        await self.setup()
        start_time = time.time()
        tasks = []

        # Endpoints to test
        endpoints = [
            ("/api/health", "GET", None),
            ("/api/powerbi/axia/info", "GET", None),
            ("/api/stats/models", "GET", None),
            ("/api/chat", "POST", {"content": "Test message", "conversation_id": "test"}),
        ]

        # Calculate request interval
        interval = 1.0 / requests_per_second
        end_time = start_time + duration_seconds

        while time.time() < end_time:
            # Select random endpoint
            endpoint, method, data = random.choice(endpoints)
            tasks.append(self.make_request(endpoint, method, data))

            # Small delay to control request rate
            await asyncio.sleep(interval)

        # Wait for all requests to complete
        await asyncio.gather(*tasks)
        duration = time.time() - start_time

        # Calculate metrics
        successful_metrics = [m for m in self.metrics if m > 0]

        metrics = PerformanceMetrics(
            test_name="API Throughput Test",
            concurrent_users=1,  # Sequential requests
            total_requests=len(tasks),
            successful_requests=len(successful_metrics),
            failed_requests=len(self.errors),
            avg_latency_ms=statistics.mean(successful_metrics) if successful_metrics else 0,
            p50_latency_ms=statistics.median(successful_metrics) if successful_metrics else 0,
            p95_latency_ms=statistics.quantiles(successful_metrics, n=20)[18] if len(successful_metrics) > 20 else max(successful_metrics, default=0),
            p99_latency_ms=statistics.quantiles(successful_metrics, n=100)[98] if len(successful_metrics) > 100 else max(successful_metrics, default=0),
            min_latency_ms=min(successful_metrics, default=0),
            max_latency_ms=max(successful_metrics, default=0),
            requests_per_second=len(successful_metrics) / duration if duration > 0 else 0,
            total_duration_s=duration,
            error_rate=len(self.errors) / len(tasks) * 100 if tasks else 0,
            memory_usage_mb=psutil.Process().memory_info().rss / 1024 / 1024,
            cpu_usage_percent=psutil.cpu_percent(interval=1)
        )

        await self.cleanup()
        return metrics


class MemoryLeakTest:
    """Test for memory leaks during sustained load"""

    def __init__(self, base_url: str = "http://localhost:8000"):
        self.base_url = base_url
        self.memory_samples: List[float] = []

    async def monitor_memory(self, duration_seconds: int = 300, sample_interval: int = 5):
        """Monitor memory usage over time"""
        logger.info(f"Starting memory leak test for {duration_seconds} seconds")

        start_time = time.time()
        ws_test = WebSocketLoadTest(self.base_url.replace("http", "ws"))
        api_test = APILoadTest(self.base_url)

        await api_test.setup()

        while time.time() - start_time < duration_seconds:
            # Record memory
            memory_mb = psutil.Process().memory_info().rss / 1024 / 1024
            self.memory_samples.append(memory_mb)

            # Generate some load
            tasks = []

            # WebSocket operations
            for _ in range(5):
                client_id = random.randint(1000, 9999)
                ws = await ws_test.connect_client(client_id)
                if ws:
                    tasks.append(ws_test.send_message(ws, "Test message"))

            # API operations
            for _ in range(10):
                tasks.append(api_test.make_request("/api/health"))

            await asyncio.gather(*tasks)

            # Sleep before next iteration
            await asyncio.sleep(sample_interval)

        await api_test.cleanup()

        # Analyze memory trend
        if len(self.memory_samples) > 10:
            first_10_avg = statistics.mean(self.memory_samples[:10])
            last_10_avg = statistics.mean(self.memory_samples[-10:])
            memory_growth = ((last_10_avg - first_10_avg) / first_10_avg) * 100

            logger.info(f"Memory growth: {memory_growth:.2f}%")

            if memory_growth > 20:
                logger.warning("Potential memory leak detected!")
                return False
            else:
                logger.info("No significant memory leak detected")
                return True

        return True


class StressTest:
    """Comprehensive stress testing"""

    def __init__(self, base_url: str = "http://localhost:8000"):
        self.base_url = base_url
        self.results: List[PerformanceMetrics] = []

    async def run_all_tests(self):
        """Run all performance tests"""
        logger.info("Starting comprehensive performance test suite")

        # Test 1: WebSocket concurrent connections
        logger.info("Test 1: WebSocket Concurrent Connections")
        ws_test = WebSocketLoadTest(self.base_url.replace("http", "ws"))

        for num_clients in [50, 100, 200]:
            logger.info(f"Testing with {num_clients} concurrent WebSocket clients")
            metrics = await ws_test.test_concurrent_connections(num_clients)
            self.results.append(metrics)
            self.print_metrics(metrics)
            await asyncio.sleep(5)  # Cool down period

        # Test 2: API throughput
        logger.info("Test 2: API Throughput")
        api_test = APILoadTest(self.base_url)

        for rps in [100, 500, 1000]:
            logger.info(f"Testing API with {rps} requests/second")
            metrics = await api_test.test_api_throughput(rps, duration_seconds=30)
            self.results.append(metrics)
            self.print_metrics(metrics)
            await asyncio.sleep(5)

        # Test 3: Memory leak detection
        logger.info("Test 3: Memory Leak Detection")
        memory_test = MemoryLeakTest(self.base_url)
        leak_free = await memory_test.monitor_memory(duration_seconds=120, sample_interval=5)

        # Generate report
        self.generate_report()

    def print_metrics(self, metrics: PerformanceMetrics):
        """Print metrics in readable format"""
        print("\n" + "="*60)
        print(f"Test: {metrics.test_name}")
        print("="*60)
        print(f"Concurrent Users: {metrics.concurrent_users}")
        print(f"Total Requests: {metrics.total_requests}")
        print(f"Successful: {metrics.successful_requests}")
        print(f"Failed: {metrics.failed_requests}")
        print(f"Error Rate: {metrics.error_rate:.2f}%")
        print(f"Requests/Second: {metrics.requests_per_second:.2f}")
        print(f"Average Latency: {metrics.avg_latency_ms:.2f}ms")
        print(f"P50 Latency: {metrics.p50_latency_ms:.2f}ms")
        print(f"P95 Latency: {metrics.p95_latency_ms:.2f}ms")
        print(f"P99 Latency: {metrics.p99_latency_ms:.2f}ms")
        print(f"Min Latency: {metrics.min_latency_ms:.2f}ms")
        print(f"Max Latency: {metrics.max_latency_ms:.2f}ms")
        print(f"Duration: {metrics.total_duration_s:.2f}s")
        print(f"Memory Usage: {metrics.memory_usage_mb:.2f}MB")
        print(f"CPU Usage: {metrics.cpu_usage_percent:.2f}%")
        print("="*60)

    def generate_report(self):
        """Generate performance report"""
        report_file = f"performance_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"

        with open(report_file, "w") as f:
            json.dump([asdict(m) for m in self.results], f, indent=2)

        logger.info(f"Performance report saved to {report_file}")

        # Check if performance targets are met
        self.validate_performance_targets()

    def validate_performance_targets(self):
        """Validate against performance targets"""
        logger.info("\nValidating Performance Targets:")

        targets_met = True

        for metrics in self.results:
            # Check P95 latency < 3 seconds
            if metrics.p95_latency_ms > 3000:
                logger.error(f"❌ P95 latency target failed: {metrics.p95_latency_ms:.2f}ms > 3000ms")
                targets_met = False
            else:
                logger.info(f"✅ P95 latency target met: {metrics.p95_latency_ms:.2f}ms < 3000ms")

            # Check P99 latency < 5 seconds
            if metrics.p99_latency_ms > 5000:
                logger.error(f"❌ P99 latency target failed: {metrics.p99_latency_ms:.2f}ms > 5000ms")
                targets_met = False
            else:
                logger.info(f"✅ P99 latency target met: {metrics.p99_latency_ms:.2f}ms < 5000ms")

            # Check error rate < 1%
            if metrics.error_rate > 1:
                logger.error(f"❌ Error rate target failed: {metrics.error_rate:.2f}% > 1%")
                targets_met = False
            else:
                logger.info(f"✅ Error rate target met: {metrics.error_rate:.2f}% < 1%")

            # Check memory usage < 512MB
            if metrics.memory_usage_mb > 512:
                logger.warning(f"⚠️  Memory usage high: {metrics.memory_usage_mb:.2f}MB > 512MB")

        if targets_met:
            logger.info("\n✅ All performance targets met!")
        else:
            logger.error("\n❌ Some performance targets were not met")

        return targets_met


async def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(description="Seekapa BI Agent Load Testing Suite")
    parser.add_argument("--url", default="http://localhost:8000", help="Base URL of the application")
    parser.add_argument("--test", choices=["all", "websocket", "api", "memory"], default="all", help="Test type to run")
    parser.add_argument("--users", type=int, default=100, help="Number of concurrent users")
    parser.add_argument("--duration", type=int, default=30, help="Test duration in seconds")

    args = parser.parse_args()

    if args.test == "all":
        stress_test = StressTest(args.url)
        await stress_test.run_all_tests()
    elif args.test == "websocket":
        ws_test = WebSocketLoadTest(args.url.replace("http", "ws"))
        metrics = await ws_test.test_concurrent_connections(args.users)
        stress_test = StressTest(args.url)
        stress_test.print_metrics(metrics)
    elif args.test == "api":
        api_test = APILoadTest(args.url)
        metrics = await api_test.test_api_throughput(1000, args.duration)
        stress_test = StressTest(args.url)
        stress_test.print_metrics(metrics)
    elif args.test == "memory":
        memory_test = MemoryLeakTest(args.url)
        leak_free = await memory_test.monitor_memory(args.duration, 5)
        if leak_free:
            logger.info("✅ No memory leaks detected")
        else:
            logger.error("❌ Potential memory leak detected")


if __name__ == "__main__":
    asyncio.run(main())