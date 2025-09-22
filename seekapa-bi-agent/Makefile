.PHONY: help install dev build test deploy clean

help: ## Show this help message
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-30s\033[0m %s\n", $$1, $$2}'

install: ## Install all dependencies
	cd backend && pip install -r requirements.txt
	cd frontend && npm install

dev-backend: ## Run backend in development mode
	cd backend && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

dev-frontend: ## Run frontend in development mode
	cd frontend && npm run dev

dev: ## Run both frontend and backend in development mode
	make -j 2 dev-backend dev-frontend

build: ## Build Docker images
	docker-compose build

up: ## Start all services with Docker
	docker-compose up -d

down: ## Stop all services
	docker-compose down

logs: ## Show logs
	docker-compose logs -f

test-backend: ## Run backend tests
	cd backend && pytest tests/ -v --cov=app

test-frontend: ## Run frontend tests
	cd frontend && npm test

test: ## Run all tests
	make test-backend
	make test-frontend

lint-backend: ## Lint backend code
	cd backend && flake8 app/ --max-line-length=120
	cd backend && mypy app/

lint-frontend: ## Lint frontend code
	cd frontend && npm run lint

lint: ## Lint all code
	make lint-backend
	make lint-frontend

format: ## Format code
	cd backend && black app/ tests/
	cd frontend && npx prettier --write "src/**/*.{ts,tsx,css}"

clean: ## Clean up generated files and caches
	find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
	find . -type f -name "*.pyc" -delete
	rm -rf backend/.pytest_cache
	rm -rf frontend/node_modules
	rm -rf frontend/dist
	rm -rf backend/venv

redis: ## Start Redis locally
	docker run -d -p 6379:6379 --name seekapa-redis redis:alpine

migrate: ## Run database migrations (if applicable)
	cd backend && alembic upgrade head

deploy-prod: ## Deploy to production
	docker-compose -f docker-compose.prod.yml up -d

monitor: ## Monitor application metrics
	@echo "Opening monitoring dashboard..."
	@open http://localhost:8000/api/stats/models
	@open http://localhost:8000/api/stats/connections

backup: ## Backup Redis data
	docker exec seekapa-redis redis-cli BGSAVE
	@echo "Redis backup initiated"