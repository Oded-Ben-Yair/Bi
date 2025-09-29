# Deploy to Azure with Health Checks

This command deploys the application to Azure and validates health endpoints.

## Usage
`/deploy-azure [staging|production]`

## Steps
1. Build Docker containers
2. Push to Azure Container Registry
3. Deploy to specified environment
4. Run health check validations
5. Take production screenshots
6. Notify stakeholders of deployment status