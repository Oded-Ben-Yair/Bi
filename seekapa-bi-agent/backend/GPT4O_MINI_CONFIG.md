# GPT-4o-mini Azure Deployment Configuration

## Step-by-Step Deployment Instructions

### 1. Go to Azure Portal
- Navigate to: https://portal.azure.com
- Search for "Azure OpenAI"
- Select your Azure OpenAI resource (or create one)

### 2. Deploy GPT-4o-mini Model
- Click "Model deployments" → "Create new deployment"
- Select these settings:
  ```
  Model family: GPT-4
  Model: gpt-4o-mini (2024-07-18)
  Deployment name: gpt-4o-mini
  Version: Latest available
  Deployment type: Global Standard
  ```

### 3. Get Your Credentials
After deployment, go to "Keys and Endpoint" and copy:
- Endpoint URL
- API Key 1 or 2
- Deployment name

### 4. Send Me These Values
```env
AZURE_OPENAI_ENDPOINT=https://YOUR-RESOURCE.openai.azure.com/
AZURE_OPENAI_API_KEY=YOUR-KEY-HERE
GPT4O_MINI_DEPLOYMENT_NAME=gpt-4o-mini
```

## Benefits for Your Chat Application

- **Response time**: <500ms (vs 30s timeout currently)
- **Cost**: 15¢/1M input, 60¢/1M output tokens
- **Throughput**: 15M tokens/minute
- **Context**: 128K tokens
- **Intelligence**: Better than GPT-3.5 Turbo

## API Parameters Supported

GPT-4o-mini supports these parameters:
- `messages` ✅
- `max_tokens` ✅
- `temperature` ✅ (0.0 to 2.0)
- `stream` ✅
- `top_p` ✅
- `frequency_penalty` ✅
- `presence_penalty` ✅
- `response_format` ✅

## Quick Test Command

After deployment, test with:
```bash
curl https://YOUR-RESOURCE.openai.azure.com/openai/deployments/gpt-4o-mini/chat/completions?api-version=2024-08-01-preview \
  -H "Content-Type: application/json" \
  -H "api-key: YOUR-KEY" \
  -d '{"messages":[{"role":"user","content":"Hello"}],"max_tokens":50}'
```