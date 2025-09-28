"""
Configuration Module for Seekapa Copilot
Manages all environment variables and application settings
"""

import os
from typing import Dict, Any, List, Optional
from pydantic_settings import BaseSettings
from dotenv import load_dotenv
from functools import lru_cache

# Load environment variables
load_dotenv()


class Settings(BaseSettings):
    """Application Settings"""

    # Application
    APP_NAME: str = "Seekapa Copilot"
    APP_VERSION: str = "4.0.0"
    APP_ENV: str = "development"
    APP_PORT: int = 8000
    DEBUG: bool = True

    # Azure AI Configuration
    AZURE_OPENAI_API_KEY: str = os.getenv(
        "AZURE_OPENAI_API_KEY",
        ""  # Set in .env file
    )
    AZURE_AI_SERVICES_ENDPOINT: str = os.getenv(
        "AZURE_AI_SERVICES_ENDPOINT",
        "https://brn-azai.cognitiveservices.azure.com"
    )
    AZURE_OPENAI_ENDPOINT: str = os.getenv(
        "AZURE_OPENAI_ENDPOINT",
        "https://brn-azai.openai.azure.com"
    )
    AZURE_AI_FOUNDRY_ENDPOINT: str = os.getenv(
        "AZURE_AI_FOUNDRY_ENDPOINT",
        "https://brn-azai.services.ai.azure.com/api/projects/seekapa_ai"
    )
    AZURE_TARGET_URI: str = os.getenv(
        "AZURE_TARGET_URI",
        "https://brn-azai.cognitiveservices.azure.com/openai/responses?api-version=2025-04-01-preview"
    )

    # GPT-5 Model Configuration
    GPT5_DEPLOYMENT_NAME: str = os.getenv("GPT5_DEPLOYMENT_NAME", "gpt-5")
    GPT5_MODEL_VERSION: str = os.getenv("GPT5_MODEL_VERSION", "2025-08-07")
    AZURE_API_VERSION: str = os.getenv("AZURE_API_VERSION", "2025-04-01-preview")

    # Power BI Configuration
    POWERBI_CLIENT_ID: str = os.getenv("POWERBI_CLIENT_ID", "")
    POWERBI_CLIENT_SECRET: str = os.getenv("POWERBI_CLIENT_SECRET", "")
    POWERBI_TENANT_ID: str = os.getenv("POWERBI_TENANT_ID", "318030de-752f-42b3-9848-abd6ec3809e3")
    POWERBI_WORKSPACE_ID: str = os.getenv("POWERBI_WORKSPACE_ID", "d3b47ebf-8447-462a-ac62-817e3256cec0")
    POWERBI_AXIA_DATASET_ID: str = os.getenv("POWERBI_AXIA_DATASET_ID", "2d5e711e-d013-4f81-b4df-1b76d63b0514")
    POWERBI_AXIA_DATASET_NAME: str = os.getenv("POWERBI_AXIA_DATASET_NAME", "ZZDS-Seekapa_Axia")
    POWERBI_SCOPE: str = os.getenv("POWERBI_SCOPE", "https://analysis.windows.net/powerbi/api/.default")
    POWERBI_AUTHORITY: str = f"https://login.microsoftonline.com/{POWERBI_TENANT_ID}"
    POWERBI_API_BASE: str = "https://api.powerbi.com/v1.0/myorg"

    # Redis Configuration
    REDIS_HOST: str = os.getenv("REDIS_HOST", "localhost")
    REDIS_PORT: int = int(os.getenv("REDIS_PORT", 6379))
    REDIS_DB: int = int(os.getenv("REDIS_DB", 0))
    REDIS_URL: str = f"redis://{REDIS_HOST}:{REDIS_PORT}/{REDIS_DB}"

    # CORS Configuration
    @property
    def CORS_ORIGINS(self) -> List[str]:
        origins = os.getenv("CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000")
        return [origin.strip() for origin in origins.split(",")]

    # Security
    SECRET_KEY: str = os.getenv("SECRET_KEY", "your-secret-key-here-change-in-production")
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRATION_HOURS: int = 24

    # Logging
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")
    LOG_FILE: str = os.getenv("LOG_FILE", "logs/seekapa_copilot.log")

    # WebSocket Configuration
    WS_HEARTBEAT_INTERVAL: int = 30
    WS_MAX_CONNECTIONS: int = 100
    WS_MESSAGE_QUEUE_SIZE: int = 1000

    # Azure Logic Apps Configuration
    AZURE_LOGIC_APP_URL: str = os.getenv(
        "AZURE_LOGIC_APP_URL",
        "https://prod-xx.swedencentral.logic.azure.com/workflows/corppowerbiai"
    )
    AZURE_LOGIC_APP_KEY: str = os.getenv("AZURE_LOGIC_APP_KEY", "")

    # Azure AI Foundry Configuration
    AZURE_AI_FOUNDRY_ENDPOINT: str = os.getenv(
        "AZURE_AI_FOUNDRY_ENDPOINT",
        "https://brn-azai.services.ai.azure.com"
    )
    AZURE_AI_FOUNDRY_PROJECT: str = os.getenv(
        "AZURE_AI_FOUNDRY_PROJECT",
        "seekapa-bi-agent"
    )
    AZURE_AGENT_ID: str = os.getenv(
        "AZURE_AGENT_ID",
        "seekapa-copilot-agent"
    )

    # Application Base URL (for callbacks)
    APP_BASE_URL: str = os.getenv(
        "APP_BASE_URL",
        f"http://localhost:{APP_PORT}"
    )

    # Model Selection Thresholds
    QUERY_COMPLEXITY_SIMPLE_THRESHOLD: int = 10
    QUERY_COMPLEXITY_MEDIUM_THRESHOLD: int = 20
    QUERY_COMPLEXITY_COMPLEX_THRESHOLD: int = 50

    # GPT-5 Model Configurations
    @property
    def GPT5_MODELS(self) -> Dict[str, Dict[str, Any]]:
        return {
            "gpt-5": {
                "deployment": "gpt-5",
                "endpoint": f"{self.AZURE_AI_SERVICES_ENDPOINT}/openai/deployments/gpt-5/chat/completions?api-version=2025-04-01-preview",
                "max_tokens": 4096,
                "use_case": "complex_analysis",
                "description": "Full GPT-5 for complex analytics and forecasting",
                "cost_tier": "high",
                "response_time": "2-3s"
            },
            "gpt-5-mini": {
                "deployment": "gpt-5-mini",
                "endpoint": f"{self.AZURE_AI_SERVICES_ENDPOINT}/openai/responses?api-version=2025-04-01-preview",
                "max_tokens": 2048,
                "use_case": "quick_responses",
                "description": "Optimized for quick responses and summaries",
                "cost_tier": "medium",
                "response_time": "1-2s"
            },
            "gpt-5-nano": {
                "deployment": "gpt-5-nano",
                "endpoint": f"{self.AZURE_AI_SERVICES_ENDPOINT}/openai/deployments/gpt-5-nano/chat/completions?api-version=2025-04-01-preview",
                "max_tokens": 1024,
                "use_case": "simple_queries",
                "description": "Ultra-fast for simple questions",
                "cost_tier": "low",
                "response_time": "<1s"
            },
            "gpt-5-chat": {
                "deployment": "gpt-5-chat",
                "endpoint": f"{self.AZURE_AI_SERVICES_ENDPOINT}/openai/deployments/gpt-5-chat/chat/completions?api-version=2025-04-01-preview",
                "max_tokens": 2048,
                "use_case": "conversational",
                "description": "Optimized for multi-turn conversations",
                "cost_tier": "medium",
                "response_time": "1-2s"
            }
        }

    # System Prompts
    @property
    def SYSTEM_PROMPT_TEMPLATE(self) -> str:
        return """You are Seekapa Copilot, an AI assistant specialized in analyzing the DS-Axia Power BI dataset.

Dataset Information:
- Name: {dataset_name}
- ID: {dataset_id}
- Type: Business Intelligence Dataset
- Focus: Axia business metrics and KPIs

Your capabilities:
1. Analyze Axia business metrics and performance indicators
2. Generate insights from Power BI reports and dashboards
3. Provide predictive analytics based on historical Axia data trends
4. Suggest data-driven actions and recommendations
5. Query and interpret the Axia dataset using DAX
6. Detect anomalies and highlight important patterns

Guidelines:
- Always reference Axia data specifically
- Provide accurate metrics with source references
- Use **bold** to highlight key findings
- Suggest relevant follow-up queries
- Keep responses concise and actionable
- Format numbers and percentages clearly
- Use bullet points for lists
- Include relevant time periods in analyses

Current context:
- Model: {model_name}
- Query complexity: {complexity}
- Timestamp: {timestamp}"""

    class Config:
        env_file = ".env"
        case_sensitive = True


@lru_cache()
def get_settings() -> Settings:
    """Get cached application settings"""
    return Settings()


# Export settings instance
settings = get_settings()