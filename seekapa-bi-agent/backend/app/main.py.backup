"""
Seekapa Copilot - Main Application
Microsoft Copilot-style Power BI Assistant for DS-Axia Dataset
"""

import os
import json
import asyncio
import uuid
from datetime import datetime
from typing import Optional, List, Dict, Any
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, Field
import logging
from loguru import logger

from app.config import settings
from app.services.azure_ai import AzureAIService
from app.services.powerbi import PowerBIService
from app.services.websocket import WebSocketManager

# Configure logging
logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

# Initialize services
azure_ai_service = AzureAIService()
powerbi_service = PowerBIService()
websocket_manager = WebSocketManager()

# Store conversations in memory (in production, use Redis or database)
conversations: Dict[str, List[Dict]] = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application lifecycle"""
    # Startup
    logger.info("Starting Seekapa Copilot...")
    await azure_ai_service.initialize()
    await powerbi_service.initialize()
    await websocket_manager.start_cleanup_task()
    logger.info("Seekapa Copilot started successfully!")

    yield

    # Shutdown
    logger.info("Shutting down Seekapa Copilot...")
    await azure_ai_service.cleanup()
    await powerbi_service.cleanup()
    await websocket_manager.stop_cleanup_task()
    logger.info("Seekapa Copilot shut down successfully!")


# Create FastAPI application
app = FastAPI(
    title="Seekapa Copilot - Axia Edition",
    description="AI-Powered BI Assistant for DS-Axia Dataset Analysis",
    version=settings.APP_VERSION,
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"]
)


# Request/Response Models
class ChatMessage(BaseModel):
    """Chat message model"""
    content: str = Field(..., description="Message content")
    context: Optional[Dict[str, Any]] = Field(None, description="Additional context")
    conversation_id: Optional[str] = Field(None, description="Conversation ID for context")
    stream: bool = Field(False, description="Whether to stream the response")


class DAXQuery(BaseModel):
    """DAX query model"""
    query: str = Field(..., description="DAX query to execute")
    format: Optional[str] = Field("json", description="Response format (json/csv)")


class NaturalLanguageQuery(BaseModel):
    """Natural language query for DAX generation"""
    question: str = Field(..., description="Natural language question about the data")
    include_explanation: bool = Field(True, description="Include explanation with the query")


class DataAnalysisRequest(BaseModel):
    """Data analysis request model"""
    data: Any = Field(..., description="Data to analyze")
    analysis_type: str = Field("general", description="Type of analysis: general, trend, anomaly, forecast")
    question: Optional[str] = Field(None, description="Specific question about the data")


# API Endpoints

@app.get("/")
async def root():
    """Root endpoint with application information"""
    return {
        "name": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "dataset": settings.POWERBI_AXIA_DATASET_NAME,
        "dataset_id": settings.POWERBI_AXIA_DATASET_ID,
        "status": "ready",
        "style": "Microsoft Copilot for Power BI",
        "endpoints": {
            "docs": "/docs",
            "health": "/health",
            "websocket": "/ws/chat",
            "api": {
                "chat": "/api/chat",
                "powerbi": "/api/powerbi/*",
                "analysis": "/api/analysis/*"
            }
        }
    }


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "services": {
            "azure_ai": "operational",
            "powerbi": "operational",
            "websocket": "operational"
        },
        "connections": websocket_manager.connection_manager.get_connection_stats()
    }


@app.post("/api/chat")
async def chat(message: ChatMessage):
    """Chat endpoint for non-WebSocket interactions"""
    try:
        # Get or create conversation
        conversation_id = message.conversation_id or str(uuid.uuid4())
        if conversation_id not in conversations:
            conversations[conversation_id] = []

        # Build messages
        messages = [{"role": "user", "content": message.content}]

        # Add conversation history
        if conversations[conversation_id]:
            for turn in conversations[conversation_id][-3:]:
                messages.insert(0, {"role": "assistant", "content": turn["assistant"]})
                messages.insert(0, {"role": "user", "content": turn["user"]})

        # Get AI response
        response = await azure_ai_service.call_gpt5(
            messages=messages,
            query=message.content,
            context=message.context,
            stream=False,
            conversation_history=conversations[conversation_id]
        )

        # Store in conversation history
        conversations[conversation_id].append({
            "user": message.content,
            "assistant": response,
            "timestamp": datetime.now().isoformat()
        })

        # Get model stats
        model_stats = azure_ai_service.model_selector.analyze_query_complexity(message.content)

        return {
            "response": response,
            "conversation_id": conversation_id,
            "model_info": {
                "complexity": model_stats[0],
                "confidence": model_stats[1]
            },
            "timestamp": datetime.now().isoformat()
        }

    except Exception as e:
        logger.error(f"Chat error: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# Power BI Endpoints

@app.get("/api/powerbi/axia/info")
async def get_axia_info():
    """Get DS-Axia dataset information"""
    try:
        dataset_details = await powerbi_service.get_axia_dataset_details()
        tables = await powerbi_service.get_axia_tables()
        refresh_history = await powerbi_service.get_refresh_history()
        reports = await powerbi_service.get_reports_using_axia()

        return {
            "dataset": settings.POWERBI_AXIA_DATASET_NAME,
            "dataset_id": settings.POWERBI_AXIA_DATASET_ID,
            "details": dataset_details,
            "tables": tables,
            "refresh_history": refresh_history,
            "reports": reports,
            "workspace_id": settings.POWERBI_WORKSPACE_ID
        }
    except Exception as e:
        logger.error(f"Error getting Axia info: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/powerbi/axia/query")
async def query_axia_data(query: DAXQuery):
    """Execute DAX query on DS-Axia dataset"""
    try:
        result = await powerbi_service.query_axia_data(query.query)

        if query.format == "csv" and result.get("success"):
            # Convert to CSV format
            import csv
            import io

            output = io.StringIO()
            if result.get("data"):
                writer = csv.DictWriter(output, fieldnames=result["columns"])
                writer.writeheader()
                writer.writerows(result["data"])

            return StreamingResponse(
                io.StringIO(output.getvalue()),
                media_type="text/csv",
                headers={"Content-Disposition": f"attachment; filename=axia_query_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"}
            )

        return result
    except Exception as e:
        logger.error(f"Query error: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/powerbi/axia/query/natural")
async def natural_language_to_dax(query: NaturalLanguageQuery):
    """Convert natural language to DAX query"""
    try:
        result = await azure_ai_service.generate_dax_query(query.question)

        # If DAX was generated, try to execute it
        if result.get("dax_query") and not result.get("error"):
            execution_result = await powerbi_service.query_axia_data(result["dax_query"])
            result["execution_result"] = execution_result

        return result
    except Exception as e:
        logger.error(f"Natural language query error: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/powerbi/axia/refresh")
async def refresh_axia_dataset():
    """Trigger a refresh of the DS-Axia dataset"""
    try:
        result = await powerbi_service.refresh_axia_dataset()
        return result
    except Exception as e:
        logger.error(f"Refresh error: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# Analysis Endpoints

@app.post("/api/analysis/analyze")
async def analyze_data(request: DataAnalysisRequest):
    """Analyze data using AI"""
    try:
        analysis = await azure_ai_service.analyze_data(
            data=request.data,
            analysis_type=request.analysis_type,
            user_question=request.question
        )

        return {
            "analysis": analysis,
            "analysis_type": request.analysis_type,
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        logger.error(f"Analysis error: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/stats/models")
async def get_model_statistics():
    """Get statistics about model usage"""
    stats = azure_ai_service.get_model_stats()
    return {
        "statistics": stats,
        "models_available": list(settings.GPT5_MODELS.keys()),
        "timestamp": datetime.now().isoformat()
    }


@app.get("/api/stats/connections")
async def get_connection_statistics():
    """Get WebSocket connection statistics"""
    return websocket_manager.connection_manager.get_connection_stats()


# WebSocket Endpoint

@app.websocket("/ws/chat")
async def websocket_chat(websocket: WebSocket):
    """WebSocket endpoint for real-time chat about Axia data"""
    client_id = None

    try:
        # Accept connection
        client_id = await websocket_manager.connection_manager.connect(websocket)

        # Create conversation history for this session
        conversation_history = []

        # Handle messages
        await websocket_manager.handle_client_message(
            websocket=websocket,
            client_id=client_id,
            ai_service=azure_ai_service,
            powerbi_service=powerbi_service,
            conversation_history=conversation_history
        )

    except WebSocketDisconnect:
        if client_id:
            websocket_manager.connection_manager.disconnect(client_id)
            logger.info(f"WebSocket client {client_id} disconnected")
    except Exception as e:
        logger.error(f"WebSocket error: {str(e)}", exc_info=True)
        if client_id:
            websocket_manager.connection_manager.disconnect(client_id)


# Error Handlers

@app.exception_handler(404)
async def not_found_handler(request, exc):
    """Handle 404 errors"""
    return JSONResponse(
        status_code=404,
        content={
            "error": "Not Found",
            "message": "The requested resource was not found",
            "path": str(request.url.path)
        }
    )


@app.exception_handler(500)
async def internal_error_handler(request, exc):
    """Handle 500 errors"""
    logger.error(f"Internal error: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal Server Error",
            "message": "An internal error occurred. Please try again later.",
            "timestamp": datetime.now().isoformat()
        }
    )


if __name__ == "__main__":
    import uvicorn

    # Run the application
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=settings.APP_PORT,
        reload=settings.DEBUG,
        log_level=settings.LOG_LEVEL.lower()
    )