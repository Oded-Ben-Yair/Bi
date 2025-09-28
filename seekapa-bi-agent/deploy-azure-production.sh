#!/bin/bash

###############################################################################
# Azure Production Deployment Script for Seekapa BI Agent
# Deploys the application with Azure Logic Apps and AI Foundry integration
###############################################################################

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Functions
log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

header() {
    echo ""
    echo "============================================"
    echo "$1"
    echo "============================================"
}

# Check prerequisites
check_prerequisites() {
    header "Checking Prerequisites"

    # Check Docker
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed"
        exit 1
    fi
    log_success "Docker is installed"

    # Check Docker Compose
    if ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose is not installed"
        exit 1
    fi
    log_success "Docker Compose is installed"

    # Check environment file
    if [ ! -f .env ]; then
        log_warning ".env file not found. Creating from template..."
        cp .env.example .env
        log_error "Please configure .env file with your Azure credentials"
        exit 1
    fi
    log_success ".env file exists"
}

# Validate Azure configuration
validate_azure_config() {
    header "Validating Azure Configuration"

    source .env

    # Check required Azure variables
    REQUIRED_VARS=(
        "AZURE_OPENAI_API_KEY"
        "AZURE_AI_SERVICES_ENDPOINT"
        "AZURE_LOGIC_APP_URL"
        "AZURE_AI_FOUNDRY_ENDPOINT"
    )

    for var in "${REQUIRED_VARS[@]}"; do
        if [ -z "${!var}" ]; then
            log_error "$var is not set in .env file"
            exit 1
        fi
        log_success "$var is configured"
    done
}

# Build Docker images
build_images() {
    header "Building Docker Images"

    log_info "Building backend image..."
    docker-compose build backend

    log_info "Building frontend image..."
    docker-compose build frontend

    log_success "Docker images built successfully"
}

# Start services
start_services() {
    header "Starting Services"

    # Stop any running services
    log_info "Stopping existing services..."
    docker-compose down

    # Start services in production mode
    log_info "Starting services in production mode..."
    docker-compose up -d

    # Wait for services to be ready
    log_info "Waiting for services to start..."
    sleep 10

    log_success "Services started successfully"
}

# Health checks
run_health_checks() {
    header "Running Health Checks"

    # Backend health check
    log_info "Checking backend health..."
    if curl -f http://localhost:8000/health > /dev/null 2>&1; then
        log_success "Backend is healthy"
    else
        log_error "Backend health check failed"
        exit 1
    fi

    # Logic Apps health check
    log_info "Checking Logic Apps connectivity..."
    if curl -f http://localhost:8000/api/v1/health/logic-app > /dev/null 2>&1; then
        log_success "Logic Apps integration is healthy"
    else
        log_warning "Logic Apps health check failed - check configuration"
    fi

    # AI Foundry health check
    log_info "Checking AI Foundry connectivity..."
    if curl -f http://localhost:8000/api/v1/health/ai-foundry > /dev/null 2>&1; then
        log_success "AI Foundry integration is healthy"
    else
        log_warning "AI Foundry health check failed - check configuration"
    fi

    # Webhook configuration check
    log_info "Checking webhook configuration..."
    if curl -f http://localhost:8000/api/v1/health/webhook > /dev/null 2>&1; then
        log_success "Webhook configuration is valid"
    else
        log_warning "Webhook configuration incomplete"
    fi
}

# Display service URLs
display_urls() {
    header "Service URLs"

    echo ""
    echo "🌐 Frontend: http://localhost:3000"
    echo "🚀 Backend API: http://localhost:8000"
    echo "📚 API Documentation: http://localhost:8000/docs"
    echo "🔌 WebSocket: ws://localhost:8000/ws/chat"
    echo ""
    echo "Webhook Endpoints:"
    echo "  - Logic App: http://localhost:8000/api/v1/webhook/logic-app"
    echo "  - Agent Trigger: http://localhost:8000/api/v1/webhook/agent-trigger"
    echo "  - Callback: http://localhost:8000/api/v1/webhook/callback"
    echo ""
    echo "Health Checks:"
    echo "  - Main: http://localhost:8000/health"
    echo "  - Logic Apps: http://localhost:8000/api/v1/health/logic-app"
    echo "  - AI Foundry: http://localhost:8000/api/v1/health/ai-foundry"
    echo "  - Webhooks: http://localhost:8000/api/v1/health/webhook"
    echo ""
}

# Run integration tests (optional)
run_tests() {
    header "Running Integration Tests (Optional)"

    read -p "Do you want to run integration tests? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        log_info "Running integration tests..."
        python3 test-azure-integration.py
    else
        log_info "Skipping integration tests"
    fi
}

# Setup permanent URL (for Azure deployment)
setup_permanent_url() {
    header "Permanent URL Configuration"

    echo ""
    echo "For production deployment with permanent URLs:"
    echo ""
    echo "1. Configure Azure Application Gateway or Front Door"
    echo "2. Set up DNS for: https://brn-azai.services.ai.azure.com"
    echo "3. Configure SSL certificates"
    echo "4. Update APP_BASE_URL in .env to your permanent URL"
    echo "5. Configure Logic App to use the permanent webhook URLs"
    echo ""
    log_info "Current configuration uses localhost for development"
}

# Main deployment flow
main() {
    clear
    echo "======================================"
    echo "Seekapa BI Agent - Azure Deployment"
    echo "======================================"
    echo ""

    check_prerequisites
    validate_azure_config
    build_images
    start_services
    run_health_checks
    display_urls
    setup_permanent_url

    header "Deployment Complete! 🎉"

    echo ""
    echo "Next steps:"
    echo "1. Test webhook endpoints using: python3 test-azure-integration.py"
    echo "2. Configure Logic App workflows in Azure Portal"
    echo "3. Test AI Foundry agent functions"
    echo "4. Monitor logs: docker-compose logs -f"
    echo ""

    # Optional: run tests
    run_tests

    log_success "Deployment completed successfully!"
}

# Handle script arguments
case "${1:-}" in
    stop)
        log_info "Stopping services..."
        docker-compose down
        log_success "Services stopped"
        ;;
    restart)
        log_info "Restarting services..."
        docker-compose restart
        log_success "Services restarted"
        ;;
    logs)
        docker-compose logs -f
        ;;
    test)
        python3 test-azure-integration.py
        ;;
    *)
        main
        ;;
esac