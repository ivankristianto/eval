# AI Provider Setup Guide

This guide explains how to configure each supported AI provider for use with the evaluation framework.

## Table of Contents

- [Cloud Providers](#cloud-providers)
  - [OpenAI](#openai)
  - [Anthropic](#anthropic)
  - [Google](#google)
  - [Open Router](#open-router)
- [Local Providers](#local-providers)
  - [LM Studio](#lm-studio)
  - [Ollama](#ollama)

---

## Cloud Providers

### OpenAI

**Models**: GPT-4, GPT-4o, o1, o3, and more

**API Key Format**: `sk-...`

**Setup**:

1. Go to [platform.openai.com](https://platform.openai.com)
2. Sign up or log in
3. Navigate to **API Keys** section
4. Create a new API key
5. Copy the key (starts with `sk-`)

**Adding to the Framework**:

1. Navigate to **Models** page
2. Click **Add Model**
3. Select **OpenAI** from provider dropdown
4. Enter model name (e.g., `gpt-4o`, `o1-preview`)
5. Paste your API key
6. Click **Test** to verify
7. Click **Add Model**

---

### Anthropic

**Models**: Claude 3 Opus, Sonnet, Haiku

**API Key Format**: `sk-ant-...`

**Setup**:

1. Go to [console.anthropic.com](https://console.anthropic.com)
2. Sign up or log in
3. Navigate to **API Keys** section
4. Create a new API key
5. Copy the key (starts with `sk-ant-`)

**Adding to the Framework**:

1. Navigate to **Models** page
2. Click **Add Model**
3. Select **Anthropic** from provider dropdown
4. Enter model name (e.g., `claude-3-opus-20240229`)
5. Paste your API key
6. Click **Test** to verify
7. Click **Add Model**

---

### Google

**Models**: Gemini 1.5 Pro, Gemini 2.0 Pro

**API Key Format**: `AIza...` (39+ characters)

**Setup**:

1. Go to [AI Studio](https://aistudio.google.com)
2. Sign up or log in
3. Navigate to **API Keys** section
4. Create a new API key
5. Copy the key

**Adding to the Framework**:

1. Navigate to **Models** page
2. Click **Add Model**
3. Select **Google** from provider dropdown
4. Enter model name (e.g., `gemini-2.0-flash-exp`)
5. Paste your API key
6. Click **Test** to verify
7. Click **Add Model**

---

### Open Router

**Models**: Access to multiple AI models through a single API

**API Key Format**: `sk-or-...`

**Setup**:

1. Go to [openrouter.ai](https://openrouter.ai)
2. Sign up or log in
3. Navigate to **API Keys** section
4. Create a new API key
5. Copy the key (starts with `sk-or-`)

**Available Models**:

Open Router provides access to models from multiple providers. Browse available models at [openrouter.ai/models](https://openrouter.ai/models).

Popular models include:

- `anthropic/claude-3-opus`
- `meta-llama/llama-3-70b`
- `mistralai/mistral-large`

**Adding to the Framework**:

1. Navigate to **Models** page
2. Click **Add Model**
3. Select **Open Router** from provider dropdown
4. Enter model name (e.g., `anthropic/claude-3-opus`)
5. Paste your API key
6. Click **Test** to verify
7. Click **Add Model**

---

## Local Providers

Local providers run AI models directly on your machine, offering privacy and cost savings for evaluation workloads.

### LM Studio

**Models**: Llama, Mistral, and other open-source models

**Auth**: None required

**Default Endpoint**: `http://localhost:1234/v1`

**Setup**:

1. Download LM Studio from [lmstudio.ai](https://lmstudio.ai)
2. Install and launch LM Studio
3. Search for and download a model (e.g., Llama 3 8B)
4. Start the server:
   - Click the **Server** icon in the left sidebar
   - Ensure the server is running on port 1234
   - Note: You can change the port if needed

**Adding to the Framework**:

1. Navigate to **Models** page
2. Click **Add Model**
3. Select **LM Studio** from provider dropdown
4. Enter model name (e.g., `llama-3-8b`)
5. Leave API key blank
6. (Optional) Enter custom Base URL if not using `http://localhost:1234/v1`
7. Click **Test** to verify
8. Click **Add Model**

**Troubleshooting**:

- Ensure LM Studio server is running before testing
- Check that the model is fully downloaded in LM Studio
- Verify the server port matches the Base URL in the framework

---

### Ollama

**Models**: Llama, Mistral, and other open-source models

**Auth**: None required

**Default Endpoint**: `http://localhost:11434`

**Setup**:

1. Download Ollama from [ollama.com](https://ollama.com)
2. Install Ollama
3. Start the Ollama server:
   ```bash
   ollama serve
   ```
4. Pull a model:
   ```bash
   ollama pull llama3
   ```

**Available Models**:

Browse available models at [ollama.com/library](https://ollama.com/library).

Popular models include:

- `llama3` - Meta Llama 3
- `mistral` - Mistral 7B
- `codellama` - Code Llama

**Adding to the Framework**:

1. Navigate to **Models** page
2. Click **Add Model**
3. Select **Ollama** from provider dropdown
4. Enter model name (e.g., `llama3`)
5. Leave API key blank
6. (Optional) Enter custom Base URL if not using `http://localhost:11434`
7. Click **Test** to verify
8. Click **Add Model**

**Troubleshooting**:

- Ensure `ollama serve` is running before testing
- Verify the model is pulled: `ollama list`
- Check Ollama is running on the default port (11434)

---

## Testing Your Setup

After adding any model, always click the **Test** button to verify:

1. **API Connectivity**: The framework can reach the provider
2. **Authentication**: Your API key is valid (for cloud providers)
3. **Model Availability**: The model name is correct and accessible

## Security Notes

- **API Keys**: Store API keys securely. The framework encrypts them using AES-256-GCM.
- **Local Providers**: Local providers (LM Studio, Ollama) don't require API keys, making them ideal for sensitive data evaluation.
- **HTTPS**: Always use HTTPS endpoints for cloud providers.

## Next Steps

Once your models are configured:

1. Create an **Evaluation** to test model responses
2. Set up **Judge Personas** for LLM-as-a-Judge workflows
3. Use **Templates** to save and reuse benchmark configurations

For more information, see the main [README](../../README.md).
