"""
Redis Cluster Service with Advanced Caching and Performance Optimization
Handles distributed caching, cache invalidation, and memory optimization
"""

import json
import logging
import time
import hashlib
import pickle
from typing import Dict, List, Any, Optional, Set, Tuple
from datetime import datetime, timedelta
import asyncio
import redis.asyncio as redis
from redis.asyncio.cluster import RedisCluster
from redis.exceptions import RedisError
from functools import wraps
import zlib

logger = logging.getLogger(__name__)


class CacheMetrics:
    """Track cache performance metrics"""

    def __init__(self):
        self.hits = 0
        self.misses = 0
        self.evictions = 0
        self.total_latency = 0
        self.operation_count = 0
        self.start_time = time.time()

    @property
    def hit_rate(self) -> float:
        """Calculate cache hit rate"""
        total = self.hits + self.misses
        return (self.hits / total * 100) if total > 0 else 0

    @property
    def avg_latency(self) -> float:
        """Calculate average operation latency"""
        return (self.total_latency / self.operation_count) if self.operation_count > 0 else 0

    def record_operation(self, latency: float, is_hit: bool):
        """Record a cache operation"""
        self.operation_count += 1
        self.total_latency += latency
        if is_hit:
            self.hits += 1
        else:
            self.misses += 1

    def get_stats(self) -> Dict:
        """Get comprehensive cache statistics"""
        uptime = time.time() - self.start_time
        return {
            "hits": self.hits,
            "misses": self.misses,
            "hit_rate": f"{self.hit_rate:.2f}%",
            "evictions": self.evictions,
            "avg_latency_ms": f"{self.avg_latency * 1000:.2f}",
            "total_operations": self.operation_count,
            "uptime_seconds": int(uptime)
        }


class RedisClusterService:
    """High-performance Redis cluster service with advanced caching"""

    def __init__(
        self,
        nodes: Optional[List[Dict]] = None,
        standalone_url: Optional[str] = None,
        max_connections: int = 100,
        socket_timeout: float = 5.0,
        enable_compression: bool = True,
        compression_threshold: int = 1024,
        cache_ttl_default: int = 3600,
        enable_cache_warming: bool = True
    ):
        """
        Initialize Redis cluster service

        Args:
            nodes: List of cluster nodes [{"host": "localhost", "port": 6379}]
            standalone_url: URL for standalone Redis (fallback)
            max_connections: Maximum connections in pool
            socket_timeout: Socket timeout in seconds
            enable_compression: Enable data compression
            compression_threshold: Minimum size for compression (bytes)
            cache_ttl_default: Default TTL in seconds
            enable_cache_warming: Enable proactive cache warming
        """
        self.nodes = nodes or [{"host": "localhost", "port": 6379}]
        self.standalone_url = standalone_url or "redis://localhost:6379"
        self.max_connections = max_connections
        self.socket_timeout = socket_timeout
        self.enable_compression = enable_compression
        self.compression_threshold = compression_threshold
        self.cache_ttl_default = cache_ttl_default
        self.enable_cache_warming = enable_cache_warming

        self.client: Optional[redis.Redis] = None
        self.is_cluster = len(self.nodes) > 1 if nodes else False
        self.metrics = CacheMetrics()

        # Cache invalidation tracking
        self.invalidation_groups: Dict[str, Set[str]] = {}
        self.dependency_map: Dict[str, Set[str]] = {}

        # Cache warming queue
        self.warming_queue: asyncio.Queue = asyncio.Queue()
        self.warming_task: Optional[asyncio.Task] = None

    async def connect(self):
        """Establish connection to Redis cluster or standalone"""
        try:
            if self.is_cluster:
                # Connect to Redis cluster
                self.client = RedisCluster(
                    startup_nodes=[
                        redis.cluster.ClusterNode(**node) for node in self.nodes
                    ],
                    max_connections=self.max_connections,
                    socket_timeout=self.socket_timeout,
                    decode_responses=False,  # Handle bytes for compression
                    skip_full_coverage_check=True
                )
            else:
                # Connect to standalone Redis
                self.client = redis.Redis.from_url(
                    self.standalone_url,
                    max_connections=self.max_connections,
                    socket_timeout=self.socket_timeout,
                    decode_responses=False
                )

            # Test connection
            await self.client.ping()
            logger.info(f"Connected to Redis {'cluster' if self.is_cluster else 'standalone'}")

            # Start cache warming if enabled
            if self.enable_cache_warming:
                self.warming_task = asyncio.create_task(self._cache_warming_worker())

        except Exception as e:
            logger.error(f"Failed to connect to Redis: {str(e)}")
            raise

    async def disconnect(self):
        """Close Redis connection"""
        if self.warming_task:
            self.warming_task.cancel()
            try:
                await self.warming_task
            except asyncio.CancelledError:
                pass

        if self.client:
            await self.client.close()
            logger.info("Disconnected from Redis")

    def _serialize(self, data: Any) -> bytes:
        """Serialize data with optional compression"""
        serialized = pickle.dumps(data)

        if self.enable_compression and len(serialized) > self.compression_threshold:
            compressed = zlib.compress(serialized, level=6)
            # Add compression marker
            return b'COMPRESSED:' + compressed

        return serialized

    def _deserialize(self, data: bytes) -> Any:
        """Deserialize data with automatic decompression"""
        if data.startswith(b'COMPRESSED:'):
            decompressed = zlib.decompress(data[11:])
            return pickle.loads(decompressed)

        return pickle.loads(data)

    def _generate_key(self, namespace: str, key: str) -> str:
        """Generate namespaced cache key"""
        return f"{namespace}:{key}"

    async def get(
        self,
        key: str,
        namespace: str = "default"
    ) -> Optional[Any]:
        """
        Get value from cache

        Args:
            key: Cache key
            namespace: Cache namespace

        Returns:
            Cached value or None if not found
        """
        start_time = time.time()
        full_key = self._generate_key(namespace, key)

        try:
            data = await self.client.get(full_key)
            latency = time.time() - start_time

            if data:
                self.metrics.record_operation(latency, is_hit=True)
                return self._deserialize(data)

            self.metrics.record_operation(latency, is_hit=False)
            return None

        except Exception as e:
            logger.error(f"Cache get error for {full_key}: {str(e)}")
            return None

    async def set(
        self,
        key: str,
        value: Any,
        ttl: Optional[int] = None,
        namespace: str = "default",
        groups: Optional[List[str]] = None,
        dependencies: Optional[List[str]] = None
    ) -> bool:
        """
        Set value in cache with TTL and grouping

        Args:
            key: Cache key
            value: Value to cache
            ttl: Time to live in seconds
            namespace: Cache namespace
            groups: Invalidation groups
            dependencies: Keys this cache depends on

        Returns:
            Success status
        """
        start_time = time.time()
        full_key = self._generate_key(namespace, key)
        ttl = ttl or self.cache_ttl_default

        try:
            serialized = self._serialize(value)
            await self.client.setex(full_key, ttl, serialized)

            # Track invalidation groups
            if groups:
                for group in groups:
                    if group not in self.invalidation_groups:
                        self.invalidation_groups[group] = set()
                    self.invalidation_groups[group].add(full_key)

            # Track dependencies
            if dependencies:
                self.dependency_map[full_key] = set(dependencies)

            latency = time.time() - start_time
            logger.debug(f"Cache set {full_key} (TTL: {ttl}s, Size: {len(serialized)} bytes, Latency: {latency*1000:.2f}ms)")

            return True

        except Exception as e:
            logger.error(f"Cache set error for {full_key}: {str(e)}")
            return False

    async def delete(
        self,
        key: str,
        namespace: str = "default"
    ) -> bool:
        """Delete a specific cache entry"""
        full_key = self._generate_key(namespace, key)

        try:
            result = await self.client.delete(full_key)

            # Clean up tracking
            for group, keys in self.invalidation_groups.items():
                keys.discard(full_key)

            self.dependency_map.pop(full_key, None)

            return result > 0

        except Exception as e:
            logger.error(f"Cache delete error for {full_key}: {str(e)}")
            return False

    async def invalidate_group(self, group: str) -> int:
        """
        Invalidate all cache entries in a group

        Args:
            group: Group name to invalidate

        Returns:
            Number of entries invalidated
        """
        if group not in self.invalidation_groups:
            return 0

        keys_to_invalidate = self.invalidation_groups[group].copy()
        invalidated = 0

        for key in keys_to_invalidate:
            try:
                await self.client.delete(key)
                invalidated += 1

                # Invalidate dependent caches
                if key in self.dependency_map:
                    for dep_key in self.dependency_map[key]:
                        await self.client.delete(dep_key)
                        invalidated += 1

            except Exception as e:
                logger.error(f"Error invalidating {key}: {str(e)}")

        # Clean up group
        self.invalidation_groups[group].clear()
        self.metrics.evictions += invalidated

        logger.info(f"Invalidated {invalidated} cache entries in group '{group}'")
        return invalidated

    async def mget(
        self,
        keys: List[str],
        namespace: str = "default"
    ) -> Dict[str, Any]:
        """
        Get multiple values from cache

        Args:
            keys: List of cache keys
            namespace: Cache namespace

        Returns:
            Dictionary of key-value pairs
        """
        full_keys = [self._generate_key(namespace, k) for k in keys]

        try:
            values = await self.client.mget(full_keys)
            result = {}

            for key, full_key, value in zip(keys, full_keys, values):
                if value:
                    result[key] = self._deserialize(value)
                    self.metrics.hits += 1
                else:
                    self.metrics.misses += 1

            return result

        except Exception as e:
            logger.error(f"Cache mget error: {str(e)}")
            return {}

    async def mset(
        self,
        data: Dict[str, Any],
        ttl: Optional[int] = None,
        namespace: str = "default"
    ) -> bool:
        """
        Set multiple values in cache

        Args:
            data: Dictionary of key-value pairs
            ttl: Time to live in seconds
            namespace: Cache namespace

        Returns:
            Success status
        """
        ttl = ttl or self.cache_ttl_default

        try:
            pipe = self.client.pipeline()

            for key, value in data.items():
                full_key = self._generate_key(namespace, key)
                serialized = self._serialize(value)
                pipe.setex(full_key, ttl, serialized)

            await pipe.execute()
            return True

        except Exception as e:
            logger.error(f"Cache mset error: {str(e)}")
            return False

    async def warm_cache(
        self,
        key: str,
        loader_func,
        ttl: Optional[int] = None,
        namespace: str = "default"
    ):
        """
        Warm cache with data from loader function

        Args:
            key: Cache key
            loader_func: Async function to load data
            ttl: Time to live in seconds
            namespace: Cache namespace
        """
        try:
            data = await loader_func()
            await self.set(key, data, ttl=ttl, namespace=namespace)
            logger.info(f"Cache warmed for {key}")
        except Exception as e:
            logger.error(f"Cache warming failed for {key}: {str(e)}")

    async def _cache_warming_worker(self):
        """Background worker for cache warming"""
        while True:
            try:
                # Get warming task from queue
                task = await self.warming_queue.get()

                if task is None:
                    break

                key, loader_func, ttl, namespace = task
                await self.warm_cache(key, loader_func, ttl, namespace)

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in cache warming worker: {str(e)}")

    def schedule_warming(
        self,
        key: str,
        loader_func,
        ttl: Optional[int] = None,
        namespace: str = "default"
    ):
        """Schedule cache warming task"""
        if self.enable_cache_warming:
            self.warming_queue.put_nowait((key, loader_func, ttl, namespace))

    async def get_stats(self) -> Dict:
        """Get comprehensive cache statistics"""
        stats = self.metrics.get_stats()

        try:
            # Get Redis info
            info = await self.client.info()

            stats.update({
                "redis_version": info.get("redis_version", "unknown"),
                "connected_clients": info.get("connected_clients", 0),
                "used_memory_human": info.get("used_memory_human", "unknown"),
                "total_connections_received": info.get("total_connections_received", 0),
                "total_commands_processed": info.get("total_commands_processed", 0),
                "instantaneous_ops_per_sec": info.get("instantaneous_ops_per_sec", 0),
                "is_cluster": self.is_cluster
            })

        except Exception as e:
            logger.error(f"Error getting Redis stats: {str(e)}")

        return stats


def cached(
    ttl: int = 3600,
    namespace: str = "default",
    key_prefix: Optional[str] = None,
    groups: Optional[List[str]] = None
):
    """
    Decorator for caching function results

    Args:
        ttl: Cache TTL in seconds
        namespace: Cache namespace
        key_prefix: Optional key prefix
        groups: Cache invalidation groups
    """
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Generate cache key from function name and arguments
            cache_key = key_prefix or func.__name__

            # Add args/kwargs to key
            if args:
                args_str = "_".join(str(a) for a in args)
                cache_key += f"_{args_str}"

            if kwargs:
                kwargs_str = "_".join(f"{k}={v}" for k, v in sorted(kwargs.items()))
                cache_key += f"_{kwargs_str}"

            # Hash long keys
            if len(cache_key) > 200:
                cache_key = hashlib.md5(cache_key.encode()).hexdigest()

            # Try to get from cache
            redis_service = getattr(wrapper, '_redis_service', None)

            if redis_service:
                cached_result = await redis_service.get(cache_key, namespace)
                if cached_result is not None:
                    return cached_result

            # Execute function
            result = await func(*args, **kwargs)

            # Store in cache
            if redis_service and result is not None:
                await redis_service.set(
                    cache_key,
                    result,
                    ttl=ttl,
                    namespace=namespace,
                    groups=groups
                )

            return result

        return wrapper

    return decorator


# Global Redis cluster instance
redis_cluster = None


async def init_redis_cluster(config: Dict = None):
    """Initialize global Redis cluster instance"""
    global redis_cluster

    if config is None:
        config = {
            "standalone_url": "redis://localhost:6379",
            "enable_compression": True,
            "cache_ttl_default": 3600,
            "enable_cache_warming": True
        }

    redis_cluster = RedisClusterService(**config)
    await redis_cluster.connect()

    # Inject into cached decorator
    cached._redis_service = redis_cluster

    return redis_cluster


async def get_redis_cluster() -> RedisClusterService:
    """Get global Redis cluster instance"""
    global redis_cluster

    if redis_cluster is None:
        await init_redis_cluster()

    return redis_cluster