# Seekapa Copilot - Project Documentation

## Overview
Microsoft Copilot-style Power BI Assistant for DS-Axia Dataset with GPT-5 integration.

## Quick Start

### Prerequisites
- Python 3.11+
- Node.js 18+
- Redis (running on port 6379)

### Running Locally

1. **Start Backend:**
```bash
cd backend
source venv/bin/activate  # On Windows: venv\Scripts\activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

2. **Start Frontend:**
```bash
cd frontend
npm run dev
```

3. **Access Application:**
- Frontend: http://localhost:5173
- Backend API: http://localhost:8000
- API Documentation: http://localhost:8000/docs

## Architecture

### Backend (FastAPI)
- **Location:** `/backend`
- **Port:** 8000
- **Key Services:**
  - Azure AI Service with GPT-5 models (nano, mini, chat, full)
  - Power BI Integration for DS-Axia dataset
  - WebSocket handler for real-time chat
  - Redis caching

### Frontend (React + TypeScript)
- **Location:** `/frontend`
- **Port:** 5173 (Vite dev server)
- **Key Features:**
  - Microsoft Copilot-style UI
  - Real-time WebSocket chat
  - Markdown rendering with syntax highlighting
  - Suggested prompts for DS-Axia analysis

## Environment Configuration

Create `.env` file in `/backend` directory:
```env
# Azure OpenAI Configuration
AZURE_OPENAI_API_KEY=your_key_here
AZURE_OPENAI_ENDPOINT=https://your-endpoint.openai.azure.com/
AZURE_OPENAI_API_VERSION=2024-06-01

# Power BI Configuration
POWERBI_CLIENT_ID=your_client_id
POWERBI_CLIENT_SECRET=your_secret
POWERBI_TENANT_ID=your_tenant_id
POWERBI_USERNAME=your_username
POWERBI_PASSWORD=your_password
POWERBI_DATASET_ID=2d5e711e-d013-4f81-b4df-1b76d63b0514

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379

# App Configuration
APP_ENV=development
LOG_LEVEL=INFO
CORS_ORIGINS=http://localhost:5173,http://localhost:3000
```

## Key Commands

### Development
```bash
# Install backend dependencies
cd backend
pip install -r requirements.txt

# Install frontend dependencies
cd frontend
npm install

# Run tests
cd backend && pytest
cd frontend && npm test

# Build frontend for production
cd frontend && npm run build

# Lint and format
cd backend && black . && ruff check .
cd frontend && npm run lint
```

### Git Workflow
```bash
# Feature development
git checkout develop
git pull origin develop
git checkout -b feature/your-feature
# ... make changes ...
git add .
git commit -m "feat: description"
git push origin feature/your-feature

# Create PR to develop branch
```

## API Endpoints

### WebSocket
- `/ws/chat` - Real-time chat interface

### REST API
- `GET /health` - Health check
- `GET /api/powerbi/axia/info` - Dataset information
- `POST /api/powerbi/axia/query` - Execute DAX query
- `POST /api/chat` - Send chat message
- `GET /api/stats/models` - Model usage statistics

## Project Structure
```
seekapa-bi-agent/
├── backend/
│   ├── app/
│   │   ├── main.py          # FastAPI application
│   │   ├── config.py        # Configuration management
│   │   ├── services/
│   │   │   ├── azure_ai.py  # Azure OpenAI integration
│   │   │   ├── powerbi.py   # Power BI integration
│   │   │   └── websocket.py # WebSocket manager
│   │   └── utils/
│   │       ├── model_selector.py  # GPT-5 model selection
│   │       └── query_analyzer.py  # Query complexity analysis
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/      # React components
│   │   ├── hooks/          # Custom React hooks
│   │   ├── store/          # Zustand state management
│   │   └── types/          # TypeScript definitions
│   ├── package.json
│   └── vite.config.ts
└── docker-compose.yml
```

## Troubleshooting

### Frontend not loading
1. Check if frontend is running: `ps aux | grep vite`
2. Check for TypeScript errors: `npm run build`
3. Clear node_modules: `rm -rf node_modules && npm install`

### WebSocket connection issues
1. Check backend logs for errors
2. Verify CORS settings in backend config
3. Ensure Redis is running: `redis-cli ping`

### Power BI authentication errors
1. Verify credentials in `.env` file
2. Check token expiration
3. Ensure dataset ID is correct

## Model Selection Logic

The system automatically selects the appropriate GPT-5 model based on query complexity:

- **GPT-5-Nano**: Simple queries, quick responses
- **GPT-5-Mini**: Standard analysis, balance of speed and capability
- **GPT-5-Chat**: Complex conversational analysis
- **GPT-5-Full**: Advanced analysis requiring maximum capability

## Security Notes

- Never commit `.env` file or credentials to git
- Use environment variables for all sensitive data
- Rotate API keys regularly
- Enable HTTPS in production

## Support

For issues or questions:
- Check backend logs: `docker logs seekapa-backend`
- Check frontend console in browser DevTools
- Review this documentation
- Create GitHub issue with details

## Last Updated
December 22, 2024 - Fixed TypeScript compilation errors and WebSocket connection