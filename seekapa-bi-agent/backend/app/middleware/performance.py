"""
Performance Middleware for FastAPI
Includes compression, caching, rate limiting, and optimization
"""

import time
import gzip
import json
import hashlib
import asyncio
from typing import Callable, Optional, Dict, Any, Set
from functools import wraps
from datetime import datetime, timedelta

from fastapi import Request, Response, HTTPException
from fastapi.responses import StreamingResponse, JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import Message
import orjson
from loguru import logger

# Import Redis cluster service
from app.services.redis_cluster import get_redis_cluster, cached


class CompressionMiddleware(BaseHTTPMiddleware):
    """Middleware for response compression"""

    def __init__(self, app, compression_level: int = 6, min_size: int = 1024):
        super().__init__(app)
        self.compression_level = compression_level
        self.min_size = min_size

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        response = await call_next(request)

        # Check if client accepts gzip
        accept_encoding = request.headers.get("accept-encoding", "")
        if "gzip" not in accept_encoding.lower():
            return response

        # Check response size and compress if needed
        if hasattr(response, "body_iterator"):
            # Streaming response
            return await self._compress_streaming_response(response, request)
        elif hasattr(response, "body"):
            # Regular response
            body = response.body
            if len(body) > self.min_size:
                compressed = gzip.compress(body, compresslevel=self.compression_level)
                response.headers["content-encoding"] = "gzip"
                response.headers["vary"] = "Accept-Encoding"
                response.headers["content-length"] = str(len(compressed))
                response.body = compressed

        return response

    async def _compress_streaming_response(self, response: StreamingResponse, request: Request) -> Response:
        """Compress streaming response"""
        chunks = []
        async for chunk in response.body_iterator:
            chunks.append(chunk)

        body = b"".join(chunks)
        if len(body) > self.min_size:
            compressed = gzip.compress(body, compresslevel=self.compression_level)
            return Response(
                content=compressed,
                status_code=response.status_code,
                headers={
                    **dict(response.headers),
                    "content-encoding": "gzip",
                    "vary": "Accept-Encoding",
                    "content-length": str(len(compressed))
                },
                media_type=response.media_type
            )

        return Response(
            content=body,
            status_code=response.status_code,
            headers=dict(response.headers),
            media_type=response.media_type
        )


class CachingMiddleware(BaseHTTPMiddleware):
    """Middleware for API response caching"""

    def __init__(
        self,
        app,
        cache_ttl: int = 300,
        cacheable_paths: Set[str] = None,
        cache_methods: Set[str] = None
    ):
        super().__init__(app)
        self.cache_ttl = cache_ttl
        self.cacheable_paths = cacheable_paths or {
            "/api/powerbi/axia/info",
            "/api/powerbi/reports",
            "/api/stats",
            "/api/health"
        }
        self.cache_methods = cache_methods or {"GET"}

    def _should_cache(self, request: Request) -> bool:
        """Check if request should be cached"""
        if request.method not in self.cache_methods:
            return False

        # Check if path matches cacheable patterns
        path = request.url.path
        return any(path.startswith(p) for p in self.cacheable_paths)

    def _generate_cache_key(self, request: Request) -> str:
        """Generate cache key from request"""
        components = [
            request.method,
            str(request.url),
            str(dict(request.headers))
        ]

        # Add query parameters
        if request.url.query:
            components.append(request.url.query)

        # Create hash
        key_str = "|".join(components)
        return f"api_cache:{hashlib.md5(key_str.encode()).hexdigest()}"

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Check if request should be cached
        if not self._should_cache(request):
            return await call_next(request)

        # Get Redis client
        try:
            redis_service = await get_redis_cluster()
            cache_key = self._generate_cache_key(request)

            # Try to get from cache
            cached_response = await redis_service.get(cache_key, namespace="api")
            if cached_response:
                logger.debug(f"Cache hit for {request.url.path}")
                return JSONResponse(
                    content=cached_response["content"],
                    status_code=cached_response["status_code"],
                    headers=cached_response.get("headers", {})
                )

            # Process request
            response = await call_next(request)

            # Cache successful responses
            if 200 <= response.status_code < 300:
                # Extract response body
                body = b""
                async for chunk in response.body_iterator:
                    body += chunk

                # Parse and cache
                try:
                    content = orjson.loads(body)
                    cache_data = {
                        "content": content,
                        "status_code": response.status_code,
                        "headers": dict(response.headers),
                        "cached_at": datetime.now().isoformat()
                    }

                    await redis_service.set(
                        cache_key,
                        cache_data,
                        ttl=self.cache_ttl,
                        namespace="api",
                        groups=["api_responses"]
                    )

                    logger.debug(f"Cached response for {request.url.path}")

                    # Return new response with body
                    return Response(
                        content=body,
                        status_code=response.status_code,
                        headers=dict(response.headers),
                        media_type=response.media_type
                    )

                except Exception as e:
                    logger.error(f"Error caching response: {str(e)}")
                    return Response(
                        content=body,
                        status_code=response.status_code,
                        headers=dict(response.headers),
                        media_type=response.media_type
                    )

            return response

        except Exception as e:
            logger.error(f"Cache middleware error: {str(e)}")
            return await call_next(request)


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Middleware for rate limiting"""

    def __init__(
        self,
        app,
        requests_per_minute: int = 60,
        burst_size: int = 10
    ):
        super().__init__(app)
        self.requests_per_minute = requests_per_minute
        self.burst_size = burst_size
        self.request_counts: Dict[str, list] = {}

    def _get_client_id(self, request: Request) -> str:
        """Get client identifier from request"""
        # Try to get from headers
        client_id = request.headers.get("x-client-id")
        if client_id:
            return client_id

        # Use IP address
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            return forwarded.split(",")[0]

        return request.client.host if request.client else "unknown"

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        client_id = self._get_client_id(request)
        now = time.time()

        # Clean old requests
        if client_id not in self.request_counts:
            self.request_counts[client_id] = []

        # Remove requests older than 1 minute
        self.request_counts[client_id] = [
            timestamp for timestamp in self.request_counts[client_id]
            if now - timestamp < 60
        ]

        # Check rate limit
        if len(self.request_counts[client_id]) >= self.requests_per_minute:
            # Check burst
            recent_requests = [
                t for t in self.request_counts[client_id]
                if now - t < 10  # Last 10 seconds
            ]

            if len(recent_requests) >= self.burst_size:
                return JSONResponse(
                    status_code=429,
                    content={
                        "error": "Rate limit exceeded",
                        "retry_after": 60 - (now - self.request_counts[client_id][0])
                    },
                    headers={
                        "X-RateLimit-Limit": str(self.requests_per_minute),
                        "X-RateLimit-Remaining": "0",
                        "X-RateLimit-Reset": str(int(now + 60))
                    }
                )

        # Add current request
        self.request_counts[client_id].append(now)

        # Add rate limit headers
        response = await call_next(request)
        response.headers["X-RateLimit-Limit"] = str(self.requests_per_minute)
        response.headers["X-RateLimit-Remaining"] = str(
            max(0, self.requests_per_minute - len(self.request_counts[client_id]))
        )
        response.headers["X-RateLimit-Reset"] = str(int(now + 60))

        return response


class PerformanceMonitoringMiddleware(BaseHTTPMiddleware):
    """Middleware for performance monitoring"""

    def __init__(self, app, slow_request_threshold: float = 3.0):
        super().__init__(app)
        self.slow_request_threshold = slow_request_threshold
        self.metrics = {
            "total_requests": 0,
            "total_time": 0,
            "slow_requests": 0,
            "errors": 0,
            "paths": {}
        }

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        start_time = time.time()
        path = request.url.path

        try:
            response = await call_next(request)
            elapsed = time.time() - start_time

            # Update metrics
            self.metrics["total_requests"] += 1
            self.metrics["total_time"] += elapsed

            if elapsed > self.slow_request_threshold:
                self.metrics["slow_requests"] += 1
                logger.warning(f"Slow request: {path} took {elapsed:.2f}s")

            # Track per-path metrics
            if path not in self.metrics["paths"]:
                self.metrics["paths"][path] = {
                    "count": 0,
                    "total_time": 0,
                    "avg_time": 0
                }

            path_metrics = self.metrics["paths"][path]
            path_metrics["count"] += 1
            path_metrics["total_time"] += elapsed
            path_metrics["avg_time"] = path_metrics["total_time"] / path_metrics["count"]

            # Add performance headers
            response.headers["X-Response-Time"] = f"{elapsed:.3f}"
            response.headers["X-Server-Time"] = str(int(time.time()))

            if response.status_code >= 500:
                self.metrics["errors"] += 1

            return response

        except Exception as e:
            elapsed = time.time() - start_time
            self.metrics["errors"] += 1
            logger.error(f"Request error: {path} - {str(e)}")
            raise

    def get_metrics(self) -> Dict:
        """Get performance metrics"""
        return {
            **self.metrics,
            "avg_response_time": (
                self.metrics["total_time"] / self.metrics["total_requests"]
                if self.metrics["total_requests"] > 0 else 0
            ),
            "slow_request_percentage": (
                self.metrics["slow_requests"] / self.metrics["total_requests"] * 100
                if self.metrics["total_requests"] > 0 else 0
            ),
            "error_rate": (
                self.metrics["errors"] / self.metrics["total_requests"] * 100
                if self.metrics["total_requests"] > 0 else 0
            )
        }


# Decorator for caching API endpoints
def cache_response(ttl: int = 300, namespace: str = "api", key_prefix: Optional[str] = None):
    """Decorator for caching API responses"""

    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Generate cache key
            cache_key = key_prefix or func.__name__

            # Add request params to key
            request = kwargs.get("request")
            if request:
                cache_key += f"_{request.url.path}_{request.url.query or ''}"

            # Hash long keys
            if len(cache_key) > 200:
                cache_key = hashlib.md5(cache_key.encode()).hexdigest()

            # Try to get from cache
            try:
                redis_service = await get_redis_cluster()
                cached = await redis_service.get(cache_key, namespace)
                if cached:
                    logger.debug(f"Cache hit for {func.__name__}")
                    return cached
            except Exception as e:
                logger.error(f"Cache error: {str(e)}")

            # Execute function
            result = await func(*args, **kwargs)

            # Cache result
            try:
                redis_service = await get_redis_cluster()
                await redis_service.set(
                    cache_key,
                    result,
                    ttl=ttl,
                    namespace=namespace
                )
            except Exception as e:
                logger.error(f"Error caching result: {str(e)}")

            return result

        return wrapper

    return decorator


# Optimized JSON encoder using orjson
class OptimizedJSONResponse(JSONResponse):
    """Optimized JSON response using orjson"""

    def render(self, content: Any) -> bytes:
        return orjson.dumps(
            content,
            option=orjson.OPT_SERIALIZE_NUMPY | orjson.OPT_SERIALIZE_UUID
        )


# CDN headers middleware
class CDNHeadersMiddleware(BaseHTTPMiddleware):
    """Add CDN-friendly headers to responses"""

    def __init__(self, app, max_age: int = 3600):
        super().__init__(app)
        self.max_age = max_age

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        response = await call_next(request)

        # Add CDN headers for static content
        if request.url.path.startswith("/static") or request.url.path.endswith((".js", ".css", ".png", ".jpg", ".svg")):
            response.headers["Cache-Control"] = f"public, max-age={self.max_age}"
            response.headers["Vary"] = "Accept-Encoding"

        # Add security headers
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"

        return response