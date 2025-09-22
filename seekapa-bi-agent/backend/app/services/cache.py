"""
Cache Service
Redis-based caching for improved performance
"""

import json
import hashlib
from typing import Optional, Any, Dict
from datetime import datetime, timedelta
import redis
import logging
from app.config import settings

logger = logging.getLogger(__name__)


class CacheService:
    """Redis cache service for query results and responses"""

    def __init__(self):
        """Initialize Redis connection"""
        try:
            self.redis_client = redis.Redis(
                host=settings.REDIS_HOST,
                port=settings.REDIS_PORT,
                db=settings.REDIS_DB,
                decode_responses=True
            )
            # Test connection
            self.redis_client.ping()
            self.enabled = True
            logger.info("Redis cache initialized successfully")
        except Exception as e:
            logger.warning(f"Redis not available, caching disabled: {str(e)}")
            self.redis_client = None
            self.enabled = False

    def _generate_key(self, prefix: str, content: str) -> str:
        """
        Generate a cache key from content

        Args:
            prefix: Key prefix for namespacing
            content: Content to hash for key

        Returns:
            Cache key string
        """
        content_hash = hashlib.md5(content.encode()).hexdigest()
        return f"{prefix}:{content_hash}"

    async def get(self, key: str) -> Optional[Any]:
        """
        Get value from cache

        Args:
            key: Cache key

        Returns:
            Cached value or None if not found
        """
        if not self.enabled:
            return None

        try:
            value = self.redis_client.get(key)
            if value:
                return json.loads(value)
            return None
        except Exception as e:
            logger.error(f"Cache get error: {str(e)}")
            return None

    async def set(
        self,
        key: str,
        value: Any,
        ttl: int = 3600
    ) -> bool:
        """
        Set value in cache

        Args:
            key: Cache key
            value: Value to cache
            ttl: Time to live in seconds

        Returns:
            Success boolean
        """
        if not self.enabled:
            return False

        try:
            serialized = json.dumps(value, default=str)
            self.redis_client.setex(key, ttl, serialized)
            return True
        except Exception as e:
            logger.error(f"Cache set error: {str(e)}")
            return False

    async def delete(self, key: str) -> bool:
        """
        Delete value from cache

        Args:
            key: Cache key

        Returns:
            Success boolean
        """
        if not self.enabled:
            return False

        try:
            self.redis_client.delete(key)
            return True
        except Exception as e:
            logger.error(f"Cache delete error: {str(e)}")
            return False

    async def cache_query_result(
        self,
        query: str,
        result: Dict,
        ttl: int = 1800
    ) -> bool:
        """
        Cache Power BI query result

        Args:
            query: DAX query
            result: Query result
            ttl: Cache duration in seconds

        Returns:
            Success boolean
        """
        key = self._generate_key("powerbi_query", query)
        cached_result = {
            "result": result,
            "cached_at": datetime.now().isoformat(),
            "query": query
        }
        return await self.set(key, cached_result, ttl)

    async def get_cached_query(self, query: str) -> Optional[Dict]:
        """
        Get cached Power BI query result

        Args:
            query: DAX query

        Returns:
            Cached result or None
        """
        key = self._generate_key("powerbi_query", query)
        cached = await self.get(key)

        if cached:
            logger.info(f"Cache hit for query: {query[:50]}...")
            return cached

        return None

    async def cache_ai_response(
        self,
        prompt: str,
        response: str,
        model: str,
        ttl: int = 3600
    ) -> bool:
        """
        Cache AI response

        Args:
            prompt: User prompt
            response: AI response
            model: Model used
            ttl: Cache duration

        Returns:
            Success boolean
        """
        key = self._generate_key(f"ai_response_{model}", prompt)
        cached_response = {
            "prompt": prompt,
            "response": response,
            "model": model,
            "cached_at": datetime.now().isoformat()
        }
        return await self.set(key, cached_response, ttl)

    async def get_cached_ai_response(
        self,
        prompt: str,
        model: str
    ) -> Optional[str]:
        """
        Get cached AI response

        Args:
            prompt: User prompt
            model: Model name

        Returns:
            Cached response or None
        """
        key = self._generate_key(f"ai_response_{model}", prompt)
        cached = await self.get(key)

        if cached:
            logger.info(f"Cache hit for AI response ({model})")
            return cached.get("response")

        return None

    async def clear_pattern(self, pattern: str) -> int:
        """
        Clear all keys matching pattern

        Args:
            pattern: Redis pattern to match

        Returns:
            Number of keys deleted
        """
        if not self.enabled:
            return 0

        try:
            keys = self.redis_client.keys(pattern)
            if keys:
                return self.redis_client.delete(*keys)
            return 0
        except Exception as e:
            logger.error(f"Cache clear error: {str(e)}")
            return 0

    async def get_cache_stats(self) -> Dict:
        """
        Get cache statistics

        Returns:
            Cache statistics dictionary
        """
        if not self.enabled:
            return {"enabled": False, "message": "Cache disabled"}

        try:
            info = self.redis_client.info()
            return {
                "enabled": True,
                "used_memory": info.get("used_memory_human", "N/A"),
                "connected_clients": info.get("connected_clients", 0),
                "total_connections_received": info.get("total_connections_received", 0),
                "keyspace_hits": info.get("keyspace_hits", 0),
                "keyspace_misses": info.get("keyspace_misses", 0),
                "hit_rate": self._calculate_hit_rate(
                    info.get("keyspace_hits", 0),
                    info.get("keyspace_misses", 0)
                )
            }
        except Exception as e:
            logger.error(f"Cache stats error: {str(e)}")
            return {"enabled": False, "error": str(e)}

    def _calculate_hit_rate(self, hits: int, misses: int) -> float:
        """Calculate cache hit rate"""
        total = hits + misses
        if total == 0:
            return 0.0
        return round((hits / total) * 100, 2)