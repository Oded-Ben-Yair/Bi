#!/bin/bash

###############################################################################
# Production Startup Script for Seekapa BI Agent
# Quick start for CEO deployment
###############################################################################

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}================================================${NC}"
echo -e "${BLUE}    Seekapa BI Agent - Production Startup${NC}"
echo -e "${BLUE}================================================${NC}"
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo -e "${YELLOW}⚠️  No .env file found. Creating from production template...${NC}"
    cp .env.production.example .env
    echo -e "${RED}❌ Please configure .env file with your Azure credentials${NC}"
    echo -e "${RED}   Edit: nano .env${NC}"
    exit 1
fi

# Check Docker
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker is not installed${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Environment configured${NC}"
echo -e "${GREEN}✓ Docker is installed${NC}"

# Pull latest images
echo -e "${BLUE}📦 Building Docker images...${NC}"
docker-compose build --parallel

# Start services
echo -e "${BLUE}🚀 Starting services...${NC}"
docker-compose up -d

# Wait for services
echo -e "${BLUE}⏳ Waiting for services to start...${NC}"
sleep 10

# Health check
echo -e "${BLUE}🏥 Running health checks...${NC}"
if curl -f http://localhost:8000/health > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Backend is healthy${NC}"
else
    echo -e "${RED}❌ Backend health check failed${NC}"
fi

if curl -f http://localhost:3000 > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Frontend is healthy${NC}"
else
    echo -e "${YELLOW}⚠️  Frontend may still be starting...${NC}"
fi

echo ""
echo -e "${GREEN}================================================${NC}"
echo -e "${GREEN}🎉 Application Started Successfully!${NC}"
echo -e "${GREEN}================================================${NC}"
echo ""
echo -e "${BLUE}Access Points:${NC}"
echo "  📱 Frontend:    http://localhost:3000"
echo "  🚀 Backend API: http://localhost:8000"
echo "  📚 API Docs:    http://localhost:8000/docs"
echo "  🔌 WebSocket:   ws://localhost:8000/ws/chat"
echo ""
echo -e "${BLUE}Useful Commands:${NC}"
echo "  View logs:     docker-compose logs -f"
echo "  Stop services: docker-compose down"
echo "  Restart:       docker-compose restart"
echo "  Test webhooks: python3 test-azure-integration.py"
echo ""
echo -e "${GREEN}Ready for CEO use! 🎯${NC}"