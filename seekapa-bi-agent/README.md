# 🚀 Seekapa Copilot - Microsoft Copilot-style Power BI Assistant

![Version](https://img.shields.io/badge/version-4.0.0-blue)
![Dataset](https://img.shields.io/badge/dataset-DS--Axia-green)
![License](https://img.shields.io/badge/license-MIT-purple)

An AI-powered Business Intelligence assistant designed in Microsoft Copilot style for analyzing the **DS-Axia Power BI dataset**. Built with FastAPI, React, TypeScript, and featuring intelligent GPT-5 model selection.

## 🌟 Key Features

- **Microsoft Copilot-style UI** - Beautiful, modern interface inspired by Microsoft Copilot
- **Multi-Model AI** - Intelligent routing between GPT-5 variants (nano, mini, chat, full)
- **Real-time WebSocket** - Live chat with streaming responses
- **Power BI Integration** - Direct connection to DS-Axia dataset (ID: `2d5e711e-d013-4f81-b4df-1b76d63b0514`)
- **Smart Caching** - Redis-powered response caching for optimal performance
- **DAX Query Generation** - Natural language to DAX conversion
- **Proactive Insights** - Anomaly detection and trend analysis

## 📊 Dataset Information

- **Dataset Name**: ZZDS-Seekapa_Axia
- **Dataset ID**: 2d5e711e-d013-4f81-b4df-1b76d63b0514
- **Workspace ID**: d3b47ebf-8447-462a-ac62-817e3256cec0
- **Configured By**: alexander.ma@i-sdd.com

## 🏗️ Architecture

```
seekapa-bi-agent/
├── backend/          # FastAPI backend with Azure AI integration
├── frontend/         # React + TypeScript with Tailwind CSS
├── docs/            # Documentation
├── .env             # Environment variables (DO NOT COMMIT)
├── docker-compose.yml
└── README.md
```

## 🚀 Quick Start

### Prerequisites

- Node.js 20+
- Python 3.12+
- Docker & Docker Compose
- Redis (optional for local development)

### Local Development

1. **Clone the repository**
```bash
git clone <repository-url>
cd seekapa-bi-agent
```

2. **Set up environment variables**
```bash
cp .env.example .env
# Edit .env with your credentials
```

3. **Backend Setup**
```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

4. **Frontend Setup**
```bash
cd frontend
npm install
npm run dev
```

5. **Access the application**
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API Docs: http://localhost:8000/docs

### Docker Deployment

```bash
# Build and run all services
docker-compose up --build

# Run in detached mode
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

## 🔧 Configuration

### GPT-5 Model Selection

The system automatically selects the best GPT-5 model based on query complexity:

| Model | Use Case | Max Tokens | Response Time |
|-------|----------|------------|---------------|
| gpt-5-nano | Simple queries | 1024 | <1s |
| gpt-5-mini | Quick responses | 2048 | 1-2s |
| gpt-5-chat | Conversations | 2048 | 1-2s |
| gpt-5 | Complex analysis | 4096 | 2-3s |

### Environment Variables

Key environment variables (see `.env` for full list):

```env
# Azure AI
AZURE_OPENAI_API_KEY=your_key_here
AZURE_AI_SERVICES_ENDPOINT=https://brn-azai.cognitiveservices.azure.com

# Power BI
POWERBI_CLIENT_ID=your_client_id
POWERBI_CLIENT_SECRET=your_secret
POWERBI_AXIA_DATASET_ID=2d5e711e-d013-4f81-b4df-1b76d63b0514

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
```

## 📡 API Endpoints

### Core Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Application info |
| GET | `/health` | Health check |
| POST | `/api/chat` | Chat endpoint |
| WS | `/ws/chat` | WebSocket chat |

### Power BI Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/powerbi/axia/info` | Dataset information |
| POST | `/api/powerbi/axia/query` | Execute DAX query |
| POST | `/api/powerbi/axia/query/natural` | Natural language to DAX |
| POST | `/api/powerbi/axia/refresh` | Trigger dataset refresh |

### Analysis Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/analysis/analyze` | Analyze data with AI |
| GET | `/api/stats/models` | Model usage statistics |
| GET | `/api/stats/connections` | WebSocket statistics |

## 🧪 Testing

### Backend Tests
```bash
cd backend
pytest tests/ -v --cov=app
```

### Frontend Tests
```bash
cd frontend
npm test
```

### Integration Tests
```bash
# Run with Docker
docker-compose -f docker-compose.test.yml up --abort-on-container-exit
```

## 📊 Sample Queries

Try these queries to explore DS-Axia data:

1. **Sales Trends**
   ```
   "Show me the sales trends for the last quarter in DS-Axia"
   ```

2. **Top Products**
   ```
   "What are the top performing products by revenue?"
   ```

3. **YoY Comparison**
   ```
   "Compare this year's performance with last year"
   ```

4. **Anomaly Detection**
   ```
   "Detect any anomalies in the DS-Axia dataset"
   ```

5. **Revenue Forecast**
   ```
   "Generate a revenue forecast for next quarter"
   ```

## 🔒 Security

- All credentials stored in environment variables
- OAuth 2.0 for Power BI authentication
- Token caching with automatic refresh
- CORS configured for production domains
- Rate limiting on API endpoints
- WebSocket connection limits

## 🚀 Deployment

### Azure Container Instances

```bash
# Build and push to Azure Container Registry
az acr build --registry seekapaacr --image seekapa-backend:latest ./backend
az acr build --registry seekapaacr --image seekapa-frontend:latest ./frontend

# Deploy using Azure Container Instances
az container create --resource-group AZAI_group \
  --name seekapa-copilot \
  --image seekapaacr.azurecr.io/seekapa-backend:latest \
  --ports 8000 \
  --environment-variables-file .env
```

### Kubernetes

```yaml
# Apply Kubernetes manifests
kubectl apply -f k8s/
```

## 📈 Monitoring

- **Logs**: Check `backend/logs/` directory
- **Metrics**: Available at `/api/stats/models`
- **Health**: Monitor `/health` endpoint
- **WebSocket**: Track connections at `/api/stats/connections`

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Issues**: Report bugs at [GitHub Issues](https://github.com/your-repo/issues)
- **Dataset Support**: alexander.ma@i-sdd.com
- **Workspace Owner**: bi1@zonlineltd.com

## 🙏 Acknowledgments

- Microsoft Copilot for UI inspiration
- Azure AI Services for GPT-5 models
- Power BI team for dataset access
- Open source community for amazing tools

---

**Built with ❤️ for DS-Axia data analysis**