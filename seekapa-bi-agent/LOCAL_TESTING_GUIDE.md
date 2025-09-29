# 🧪 SEEKAPA BI AGENT - LOCAL TESTING GUIDE

## 🚀 Application is Now Running!

Your Seekapa BI Agent is running locally and ready for testing. Here are the access URLs and testing instructions:

## 📍 Access URLs

### Main Applications
- **🌐 Frontend (CEO Dashboard)**: http://localhost:3000
- **🔧 Backend API**: http://localhost:8000
- **📚 API Documentation**: http://localhost:8000/docs
- **📊 ReDoc API**: http://localhost:8000/redoc

### Health Check Endpoints
- **Backend Health**: http://localhost:8000/health
- **WebSocket Stats**: http://localhost:8000/api/websocket/stats
- **Cache Stats**: http://localhost:8000/api/cache/stats

## ✅ What's Currently Running

1. **Redis Cache** - Port 6379 (RUNNING ✅)
2. **Backend Server** - Port 8000 (RUNNING ✅)
   - FastAPI with all security features
   - GPT-5 integration with model router
   - WebSocket support for real-time chat
   - Azure AI Foundry integration
3. **Frontend Server** - Port 3000 (RUNNING ✅)
   - CEO Dashboard with KPIs
   - Real-time chat interface
   - Mobile-responsive design
   - PWA capabilities

## 🧪 Testing Checklist

### 1. Frontend Testing (http://localhost:3000)

#### CEO Dashboard Features
- [ ] Visit http://localhost:3000
- [ ] Check if CEO Dashboard loads with KPI cards
- [ ] Verify Revenue Growth component displays
- [ ] Check Profitability metrics
- [ ] Test Cash Flow Analysis visualization
- [ ] Verify Operational Metrics (4-category scorecard)
- [ ] Check Executive Summary loads

#### Chat Interface
- [ ] Click on chat interface
- [ ] Type a test message: "Show me sales trends for Q4"
- [ ] Verify WebSocket connection (check for real-time response)
- [ ] Test suggested prompts
- [ ] Check markdown rendering in responses

#### Mobile Responsiveness
- [ ] Open Chrome DevTools (F12)
- [ ] Toggle device toolbar (Ctrl+Shift+M)
- [ ] Test on mobile view (iPhone 14)
- [ ] Test on tablet view (iPad)
- [ ] Verify touch interactions work

### 2. Backend API Testing (http://localhost:8000/docs)

#### Health Checks
```bash
# Test backend health
curl http://localhost:8000/health

# Expected response:
{
  "status": "healthy",
  "services": {
    "azure_ai": "operational",
    "powerbi": "operational",
    "websocket": "operational"
  }
}
```

#### API Endpoints to Test
1. **Chat Endpoint**
   ```bash
   curl -X POST http://localhost:8000/api/chat \
     -H "Content-Type: application/json" \
     -d '{"message": "What is the revenue trend?", "conversation_id": "test-123"}'
   ```

2. **WebSocket Test**
   - Open http://localhost:8000/docs
   - Navigate to WebSocket section
   - Test real-time connection

3. **Model Statistics**
   ```bash
   curl http://localhost:8000/api/stats/models
   ```

### 3. Security Features Testing

#### Authentication (if enabled)
- [ ] Access protected endpoints
- [ ] Verify JWT token generation
- [ ] Test role-based access control

#### Security Headers
```bash
# Check security headers
curl -I http://localhost:8000/health
```

### 4. Performance Testing

#### Load Test
```bash
# Test concurrent connections (from project root)
cd /home/odedbe/Bi/seekapa-bi-agent
python3 tests/load_test.py --test websocket --users 10
```

#### Response Times
- [ ] Dashboard load: Should be <2 seconds
- [ ] API responses: Should be <3 seconds
- [ ] WebSocket latency: Should be <100ms

### 5. Integration Testing

#### Power BI Integration
- [ ] Test dataset connection
- [ ] Verify DAX query execution
- [ ] Check data refresh capability

#### GPT-5 Model Router
- [ ] Test simple query (should use GPT-5-nano)
- [ ] Test complex analysis (should use GPT-5-full)
- [ ] Verify cost optimization working

## 🔍 Monitoring & Logs

### View Real-time Logs

#### Backend Logs
```bash
# Backend logs are displayed in terminal where server is running
# Or check: backend/backend.log
```

#### Frontend Logs
- Open browser Developer Console (F12)
- Check Console tab for any errors

#### Redis Monitoring
```bash
redis-cli monitor
```

## 🛠️ Troubleshooting

### If Frontend Won't Load
1. Check if port 3000 is free: `lsof -i :3000`
2. Restart frontend: `cd frontend && npm run dev`
3. Clear browser cache

### If Backend API Errors
1. Check .env configuration in backend/
2. Verify Azure credentials are correct
3. Ensure Redis is running: `redis-cli ping`

### If WebSocket Won't Connect
1. Check CORS settings in backend
2. Verify frontend .env has correct WS_URL
3. Check browser console for connection errors

## 📝 Test Scenarios for CEO Features

### Scenario 1: Executive Morning Briefing
1. Open dashboard at http://localhost:3000
2. Ask: "Give me an executive summary of yesterday's performance"
3. Verify AI generates comprehensive summary

### Scenario 2: Revenue Analysis
1. Ask: "Show me revenue trends for the last quarter"
2. Check if appropriate visualizations appear
3. Verify data is from DS-Axia dataset

### Scenario 3: Predictive Analytics
1. Navigate to Predictive Forecasts component
2. Ask: "What's the revenue forecast for next month?"
3. Verify forecast visualization loads

### Scenario 4: Mobile Executive Access
1. Open on mobile device or emulator
2. Test all touch interactions
3. Verify dashboard loads in <2 seconds

## 🎯 Success Criteria

Your testing is successful when:
- ✅ All services show "healthy" status
- ✅ Chat interface responds to queries
- ✅ CEO Dashboard displays all KPIs
- ✅ Mobile view works perfectly
- ✅ Response times meet targets (<3s API, <2s mobile)
- ✅ No console errors in browser
- ✅ WebSocket maintains stable connection

## 📊 Performance Benchmarks

| Metric | Target | How to Test |
|--------|--------|-------------|
| Dashboard Load | <2s | Chrome DevTools Network tab |
| API Response | <3s | Time curl commands |
| WebSocket Latency | <100ms | Check chat response time |
| Memory Usage | <512MB | Task Manager / `htop` |
| Concurrent Users | 100+ | Run load test script |

## 🚀 Next Steps

After successful local testing:

1. **Run Full Test Suite**
   ```bash
   # From project root
   npm test
   cd backend && pytest tests/
   ```

2. **Build for Production**
   ```bash
   # Frontend build
   cd frontend && npm run build

   # Backend Docker
   cd backend && docker build -t seekapa-backend:prod .
   ```

3. **Deploy to Azure**
   ```bash
   # Use deployment script
   ./deploy-azure-production.sh
   ```

## 📞 Support

If you encounter issues:
1. Check the logs first
2. Verify all services are running
3. Ensure .env files are configured correctly
4. Review error messages in browser console

---

**Your Seekapa BI Agent is ready for testing!** 🎉

Open your browser and navigate to:
- **http://localhost:3000** - CEO Dashboard
- **http://localhost:8000/docs** - API Documentation

Happy Testing! 🚀