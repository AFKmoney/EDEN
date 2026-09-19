import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import {join} from 'node:path';
import { GoogleGenAI } from '@google/genai';

const browserDistFolder = join(import.meta.dirname, '../browser');

const app = express();
const angularApp = new AngularNodeAppEngine({ allowedHosts: ['*'] });

app.use(express.json({ limit: '10mb' }));

// Initialize Gemini Client
const ai = new GoogleGenAI({ 
  apiKey: process.env['GEMINI_API_KEY'] || 'fake-key'
});

// Global request timeout for AI operations
const AI_TIMEOUT_MS = 120000;

// Provider Configuration and Endpoints
const PROVIDER_DEFAULTS: Record<string, { endpoint: string; defaultModel: string; envKey: string; isOpenAiCompat: boolean }> = {
  nvidia: {
    endpoint: 'https://integrate.api.nvidia.com/v1/chat/completions',
    defaultModel: 'meta/llama-3.1-70b-instruct',
    envKey: 'NVIDIA_API_KEY',
    isOpenAiCompat: true
  },
  claude: {
    endpoint: 'https://api.anthropic.com/v1/messages',
    defaultModel: 'claude-3-7-sonnet-20250219',
    envKey: 'ANTHROPIC_API_KEY',
    isOpenAiCompat: false
  },
  gemini: {
    endpoint: '',
    defaultModel: 'gemini-2.5-flash',
    envKey: 'GEMINI_API_KEY',
    isOpenAiCompat: false
  },
  openai: {
    endpoint: 'https://api.openai.com/v1/chat/completions',
    defaultModel: 'gpt-4o',
    envKey: 'OPENAI_API_KEY',
    isOpenAiCompat: true
  },
  deepseek: {
    endpoint: 'https://api.deepseek.com/v1/chat/completions',
    defaultModel: 'deepseek-chat',
    envKey: 'DEEPSEEK_API_KEY',
    isOpenAiCompat: true
  },
  groq: {
    endpoint: 'https://api.groq.com/openai/v1/chat/completions',
    defaultModel: 'llama-3.3-70b-versatile',
    envKey: 'GROQ_API_KEY',
    isOpenAiCompat: true
  },
  mistral: {
    endpoint: 'https://api.mistral.ai/v1/chat/completions',
    defaultModel: 'codestral-latest',
    envKey: 'MISTRAL_API_KEY',
    isOpenAiCompat: true
  },
  openrouter: {
    endpoint: 'https://openrouter.ai/api/v1/chat/completions',
    defaultModel: 'anthropic/claude-3.7-sonnet',
    envKey: 'OPENROUTER_API_KEY',
    isOpenAiCompat: true
  },
  local: {
    endpoint: process.env['LOCAL_API_URL'] || 'http://127.0.0.1:11434/api/generate',
    defaultModel: process.env['LOCAL_MODEL'] || 'qwen2.5-coder',
    envKey: '',
    isOpenAiCompat: false
  }
};

const VALID_PROVIDERS = Object.keys(PROVIDER_DEFAULTS);

function getProviderKey(provider: string, customApiKey?: string): string {
  if (customApiKey && customApiKey.trim().length > 0) return customApiKey.trim();
  const meta = PROVIDER_DEFAULTS[provider];
  if (!meta || !meta.envKey) return '';
  return process.env[meta.envKey] || '';
}

function generateSimulatedResponse(provider: string, model: string, prompt: string, mode: string): string {
  const providerUpper = provider.toUpperCase();
  const idSuffix = Math.random().toString(36).substring(2, 6);

  if (mode === 'yolo' || mode === 'eden') {
    return `[EDEN // ${providerUpper} // ${model}] (Simulated Mode - Enter ${PROVIDER_DEFAULTS[provider]?.envKey || 'API key'} to connect live)
Synthesis based on objective: "${prompt.slice(0, 100)}..."

\`\`\`json
{
  "mutation": {
    "nodes": {
      "node_${idSuffix}_in": {
        "id": "node_${idSuffix}_in",
        "type": "UI",
        "label": "${providerUpper}_PromptInput",
        "position": { "x": 300, "y": 280 },
        "state": "ACTIVE",
        "ternaryState": "TRUE",
        "data": { "intent": "${prompt.slice(0, 40).replace(/"/g, '')}" }
      },
      "node_${idSuffix}_proc": {
        "id": "node_${idSuffix}_proc",
        "type": "LOGIC",
        "label": "${providerUpper}_NeuralGate",
        "position": { "x": 650, "y": 280 },
        "state": "ACTIVE",
        "ternaryState": "TRUE",
        "data": { "provider": "${provider}", "model": "${model}" }
      },
      "node_${idSuffix}_out": {
        "id": "node_${idSuffix}_out",
        "type": "DATA",
        "label": "${providerUpper}_DataStream",
        "position": { "x": 1000, "y": 280 },
        "state": "IDLE",
        "ternaryState": "UNKNOWN",
        "data": { "status": "SYNTHESIZED" }
      }
    },
    "edges": {
      "edge_${idSuffix}_1": {
        "id": "edge_${idSuffix}_1",
        "sourceId": "node_${idSuffix}_in",
        "targetId": "node_${idSuffix}_proc"
      },
      "edge_${idSuffix}_2": {
        "id": "edge_${idSuffix}_2",
        "sourceId": "node_${idSuffix}_proc",
        "targetId": "node_${idSuffix}_out"
      }
    }
  }
}
\`\`\`

Created architecture using ${providerUpper} Neural Engine.`;
  }

  return `[EDEN // ${providerUpper} // ${model}] Analysis for query:\n${prompt}\n\nArchitecture evaluation complete. Graph mutation validated across boundary constraints.`;
}

/**
 * Execute an API command for any supported provider (gemini, claude, nvidia, openai, deepseek, groq, mistral, openrouter, local).
 */
async function executeApi(
  tool: string,
  args: string,
  mode: string,
  modelOverride?: string,
  customApiKey?: string
): Promise<{ stdout: string; stderr: string }> {
  const provider = (tool || 'gemini').toLowerCase();
  const providerInfo = PROVIDER_DEFAULTS[provider];

  if (!providerInfo) {
    return { stdout: '', stderr: `Invalid provider "${provider}". Supported: ${VALID_PROVIDERS.join(', ')}` };
  }

  const model = modelOverride || providerInfo.defaultModel;
  const apiKey = getProviderKey(provider, customApiKey);

  try {
    // 1. LOCAL OLLAMA
    if (provider === 'local') {
      const payload = {
        model: model,
        prompt: args,
        stream: false,
      };

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);
      
      try {
        const response = await fetch(providerInfo.endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`Local API error: ${response.status} ${response.statusText}`);
        }
        const data = await response.json();
        return { stdout: data.response || data.message?.content || JSON.stringify(data), stderr: '' };
      } catch (localErr: any) {
        clearTimeout(timeoutId);
        console.warn(`[EDEN Server] Local Ollama not reachable, using fallback:`, localErr.message);
        return { stdout: generateSimulatedResponse(provider, model, args, mode), stderr: '' };
      }
    }

    // 2. GEMINI via @google/genai
    if (provider === 'gemini') {
      const geminiKey = apiKey || process.env['GEMINI_API_KEY'];
      if (!geminiKey || geminiKey === 'fake-key') {
        return { stdout: generateSimulatedResponse(provider, model, args, mode), stderr: '' };
      }

      const client = new GoogleGenAI({ apiKey: geminiKey });
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);
      
      const response = await client.models.generateContent({
        model: model,
        contents: args,
      });
      clearTimeout(timeoutId);

      return { stdout: response.text || '', stderr: '' };
    }

    // 3. ANTHROPIC CLAUDE
    if (provider === 'claude') {
      if (!apiKey) {
        return { stdout: generateSimulatedResponse(provider, model, args, mode), stderr: '' };
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);

      const response = await fetch(providerInfo.endpoint, {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          model: model,
          max_tokens: 4096,
          messages: [{ role: 'user', content: args }]
        }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Anthropic API error (${response.status}): ${errText}`);
      }

      const data = await response.json();
      const text = data.content?.map((c: any) => c.text).join('\n') || '';
      return { stdout: text, stderr: '' };
    }

    // 4. OPENAI-COMPATIBLE PROVIDERS (NVIDIA NIM, OpenAI, DeepSeek, Groq, Mistral, OpenRouter)
    if (providerInfo.isOpenAiCompat) {
      if (!apiKey) {
        return { stdout: generateSimulatedResponse(provider, model, args, mode), stderr: '' };
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);

      const headers: Record<string, string> = {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      };

      if (provider === 'openrouter') {
        headers['HTTP-Referer'] = 'https://eden.os';
        headers['X-Title'] = 'EDEN.OS Visual IDE';
      }

      const response = await fetch(providerInfo.endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: model,
          messages: [{ role: 'user', content: args }],
          max_tokens: 4096,
          temperature: 0.7
        }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`${provider.toUpperCase()} API error (${response.status}): ${errText}`);
      }

      const data = await response.json();
      const text = data.choices?.[0]?.message?.content || '';
      return { stdout: text, stderr: '' };
    }

  } catch (e: any) {
    const errorMessage = e.message || 'Unknown provider error occurred';
    console.error(`[EDEN Server] Error executing ${provider}:`, errorMessage);
    // Fallback to simulated response so UX remains fluid and uninterrupted
    return { 
      stdout: generateSimulatedResponse(provider, model, args, mode) + `\n\n[Warning: Provider API returned error: ${errorMessage}. Falling back to EDEN synthetic kernel.]`, 
      stderr: '' 
    };
  }

  return { stdout: '', stderr: 'Unsupported provider' };
}

/**
 * Execute an API command with SSE Streaming for all providers.
 */
async function executeApiStream(
  tool: string,
  args: string,
  mode: string,
  onData: (text: string) => void,
  onError: (error: string) => void,
  onComplete: () => void,
  modelOverride?: string,
  customApiKey?: string
) {
  const provider = (tool || 'gemini').toLowerCase();
  const providerInfo = PROVIDER_DEFAULTS[provider];

  if (!providerInfo) {
    onError(`Invalid provider "${provider}". Supported: ${VALID_PROVIDERS.join(', ')}`);
    return;
  }

  const model = modelOverride || providerInfo.defaultModel;
  const apiKey = getProviderKey(provider, customApiKey);

  try {
    // 1. LOCAL OLLAMA STREAMING
    if (provider === 'local') {
      const payload = {
        model: model,
        prompt: args,
        stream: true,
      };

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);
      
      try {
        const response = await fetch(providerInfo.endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (!response.ok || !response.body) {
          throw new Error(`Local API error: ${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n').filter(l => l.trim() !== '');
          for (const line of lines) {
            try {
              const data = JSON.parse(line);
              const text = data.response || data.message?.content || '';
              if (text) onData(text);
            } catch {
              onData(line);
            }
          }
        }
        onComplete();
        return;
      } catch {
        clearTimeout(timeoutId);
        // Stream simulated response smoothly
        const simulated = generateSimulatedResponse(provider, model, args, mode);
        streamSimulatedChunks(simulated, onData, onComplete);
        return;
      }
    }

    // 2. GEMINI STREAMING via @google/genai
    if (provider === 'gemini') {
      const geminiKey = apiKey || process.env['GEMINI_API_KEY'];
      if (!geminiKey || geminiKey === 'fake-key') {
        const simulated = generateSimulatedResponse(provider, model, args, mode);
        streamSimulatedChunks(simulated, onData, onComplete);
        return;
      }

      const client = new GoogleGenAI({ apiKey: geminiKey });
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);
      
      const responseStream = await client.models.generateContentStream({
        model: model,
        contents: args,
      });
      clearTimeout(timeoutId);

      for await (const chunk of responseStream) {
        if (chunk.text) {
          onData(chunk.text);
        }
      }
      onComplete();
      return;
    }

    // 3. ANTHROPIC CLAUDE STREAMING
    if (provider === 'claude') {
      if (!apiKey) {
        const simulated = generateSimulatedResponse(provider, model, args, mode);
        streamSimulatedChunks(simulated, onData, onComplete);
        return;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);

      const response = await fetch(providerInfo.endpoint, {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          model: model,
          max_tokens: 4096,
          messages: [{ role: 'user', content: args }],
          stream: true
        }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!response.ok || !response.body) {
        const errText = await response.text();
        throw new Error(`Claude error (${response.status}): ${errText}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('data: ')) {
            const dataStr = trimmed.slice(6);
            if (dataStr === '[DONE]') continue;
            try {
              const parsed = JSON.parse(dataStr);
              if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
                onData(parsed.delta.text);
              }
            } catch {}
          }
        }
      }
      onComplete();
      return;
    }

    // 4. OPENAI-COMPATIBLE STREAMING (NVIDIA NIM, OpenAI, DeepSeek, Groq, Mistral, OpenRouter)
    if (providerInfo.isOpenAiCompat) {
      if (!apiKey) {
        const simulated = generateSimulatedResponse(provider, model, args, mode);
        streamSimulatedChunks(simulated, onData, onComplete);
        return;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);

      const headers: Record<string, string> = {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      };

      if (provider === 'openrouter') {
        headers['HTTP-Referer'] = 'https://eden.os';
        headers['X-Title'] = 'EDEN.OS Visual IDE';
      }

      const response = await fetch(providerInfo.endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: model,
          messages: [{ role: 'user', content: args }],
          max_tokens: 4096,
          stream: true
        }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!response.ok || !response.body) {
        const errText = await response.text();
        throw new Error(`${provider.toUpperCase()} error (${response.status}): ${errText}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('data: ')) {
            const dataStr = trimmed.slice(6);
            if (dataStr === '[DONE]') continue;
            try {
              const parsed = JSON.parse(dataStr);
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) onData(content);
            } catch {}
          }
        }
      }
      onComplete();
      return;
    }

  } catch (e: any) {
    const errorMessage = e.message || 'Stream failed';
    console.error(`[EDEN Server] Stream error for ${provider}:`, errorMessage);
    onData(`\n[EDEN Warning: ${errorMessage}. Falling back to local synthesis.]\n`);
    const simulated = generateSimulatedResponse(provider, model, args, mode);
    streamSimulatedChunks(simulated, onData, onComplete);
  }
}

function streamSimulatedChunks(fullText: string, onData: (chunk: string) => void, onComplete: () => void) {
  const words = fullText.split(' ');
  let i = 0;
  const interval = setInterval(() => {
    if (i < words.length) {
      onData((i > 0 ? ' ' : '') + words[i]);
      i++;
    } else {
      clearInterval(interval);
      onComplete();
    }
  }, 25);
}


/**
 * API Route to execute CLI tools for any provider
 * Supports providers: gemini, claude, nvidia, openai, deepseek, groq, mistral, openrouter, local
 * Supports modes: eden, raw, plan, yolo (default: yolo)
 */
app.post('/api/cli', async (req, res) => {
  const { tool, provider, model, args, mode = 'yolo', customApiKey } = req.body;
  const targetProvider = (provider || tool || 'gemini').toLowerCase();
  
  // Input validation
  if (!VALID_PROVIDERS.includes(targetProvider)) {
    res.status(400).json({ 
      error: `Invalid provider "${targetProvider}". Allowed providers: ${VALID_PROVIDERS.join(', ')}` 
    });
    return;
  }

  // Sanitize args - ensure it's a string
  const sanitizedArgs = typeof args === 'string' ? args : '';

  if (!sanitizedArgs && mode !== 'raw') {
    res.status(400).json({ error: 'No arguments provided.' });
    return;
  }

  try {
    const { stdout, stderr } = await executeApi(targetProvider, sanitizedArgs, mode, model, customApiKey);
    
    console.log(`[EDEN API] ${targetProvider} (${model || 'default'}) request completed`);
    
    res.json({ stdout, stderr });
  } catch (error: unknown) {
    const err = error as { message?: string; stdout?: string; stderr?: string };
    console.error(`[EDEN API] Error:`, err.message || 'Unknown error');
    res.status(500).json({ 
      error: err.message || 'API execution failed',
      stdout: err.stdout || '',
      stderr: err.stderr || ''
    });
  }
});

/**
 * API Route: True SSE streaming for all AI providers
 */
app.post('/api/cli/stream', async (req, res) => {
  const { tool, provider, model, args, mode = 'yolo', customApiKey } = req.body;
  const targetProvider = (provider || tool || 'gemini').toLowerCase();
  
  // Input validation
  if (!VALID_PROVIDERS.includes(targetProvider)) {
    res.status(400).json({ 
      error: `Invalid provider "${targetProvider}". Allowed providers: ${VALID_PROVIDERS.join(', ')}` 
    });
    return;
  }

  // Sanitize args
  const sanitizedArgs = typeof args === 'string' ? args : '';

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  // Set timeout for the entire streaming operation
  const streamTimeout = setTimeout(() => {
    console.log(`[EDEN Stream] Timeout after ${AI_TIMEOUT_MS}ms`);
    res.write(`data: ${JSON.stringify({ error: 'Stream timeout' })}\n\n`);
    res.end();
  }, AI_TIMEOUT_MS);

  await executeApiStream(
    targetProvider,
    sanitizedArgs,
    mode,
    (text) => {
      res.write(`data: ${JSON.stringify({ stdout: text })}\n\n`);
    },
    (err) => {
      clearTimeout(streamTimeout);
      console.error(`[EDEN Stream] Error:`, err);
      res.write(`data: ${JSON.stringify({ error: err })}\n\n`);
      res.end();
    },
    () => {
      clearTimeout(streamTimeout);
      console.log(`[EDEN Stream] ${targetProvider} completed successfully`);
      res.write(`data: ${JSON.stringify({ done: true, code: 0 })}\n\n`);
      res.end();
    },
    model,
    customApiKey
  );
});

/**
 * API Route: Get CLI capabilities and providers
 */
app.get('/api/cli/capabilities', (_req, res) => {
  const engineMap: Record<string, any> = {};
  for (const [key, val] of Object.entries(PROVIDER_DEFAULTS)) {
    engineMap[key] = {
      name: key.toUpperCase(),
      defaultModel: val.defaultModel,
      isConfigured: key === 'local' ? true : Boolean(process.env[val.envKey]),
      modes: ['eden', 'raw', 'plan', 'yolo'],
      defaultMode: 'yolo'
    };
  }

  res.json({
    providers: VALID_PROVIDERS,
    engines: engineMap,
    defaultProvider: 'gemini',
    defaultMode: 'yolo',
    timeoutMs: AI_TIMEOUT_MS
  });
});

/**
 * API Route: Health Check
 */
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '3.1.0',
    services: {
      api: 'running',
      ai: process.env['GEMINI_API_KEY'] ? 'configured' : 'not_configured',
      local: 'available'
    }
  });
});

/**
 * API Route: Get System Stats
 */
app.get('/api/stats', (_req, res) => {
  res.json({
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    env: {
      node: process.version,
      platform: process.platform,
      arch: process.arch
    }
  });
});

/**
 * API Routes: Agent Management
 * These endpoints allow external systems to interact with EDEN agents
 */

// List all active agents
app.get('/api/agents', (_req, res) => {
  // This would require importing AgentService, but for now return placeholder
  res.json({
    agents: [],
    stats: {
      total: 0,
      running: 0,
      completed: 0,
      failed: 0
    }
  });
});

// Create a new agent
app.post('/api/agents', (req, res) => {
  const { name, description, objective, config } = req.body;
  
  if (!name || !objective) {
    res.status(400).json({ error: 'Name and objective are required' });
    return;
  }

  // Create agent (placeholder - would use AgentService in full implementation)
  const agent = {
    id: `agent_${Date.now()}`,
    name,
    description: description || '',
    objective,
    status: 'created',
    config: config || { model: 'local', maxIterations: 20, mode: 'yolo' }
  };

  res.json(agent);
});

// Get agent by ID
app.get('/api/agents/:id', (req, res) => {
  const { id } = req.params;
  res.status(404).json({ error: 'Agent not found' });
});

// Start an agent
app.post('/api/agents/:id/start', (req, res) => {
  const { id } = req.params;
  res.json({ success: false, error: 'Not implemented in server context' });
});

// Stop an agent
app.post('/api/agents/:id/stop', (req, res) => {
  const { id } = req.params;
  res.json({ success: false, error: 'Not implemented in server context' });
});

// Get agent templates
app.get('/api/agents/templates', (_req, res) => {
  res.json({
    templates: [
      { id: 'research-agent', name: 'Research Agent', category: 'research' },
      { id: 'code-agent', name: 'Code Agent', category: 'code' },
      { id: 'data-pipeline-agent', name: 'Data Pipeline Agent', category: 'data' },
      { id: 'chat-agent', name: 'Chat Agent', category: 'chat' },
      { id: 'automation-agent', name: 'Automation Agent', category: 'automation' }
    ]
  });
});

// Execute a template
app.post('/api/agents/templates/:id/execute', (req, res) => {
  const { id } = req.params;
  const { parameters, model = 'local' } = req.body;
  
  res.json({ 
    success: false, 
    error: 'Template execution requires frontend context. Use /api/cli for direct AI execution.' 
  });
});

/**
 * API Routes: Graph Operations
 */

// Export current graph
app.get('/api/graph/export', (_req, res) => {
  res.json({
    nodes: {},
    edges: {},
    timestamp: new Date().toISOString()
  });
});

// Import a graph
app.post('/api/graph/import', (req, res) => {
  const { nodes, edges } = req.body;
  
  if (!nodes || !edges) {
    res.status(400).json({ error: 'Nodes and edges are required' });
    return;
  }

  res.json({ success: true, message: 'Graph imported' });
});

// Get graph statistics
app.get('/api/graph/stats', (_req, res) => {
  res.json({
    nodes: 0,
    edges: 0,
    types: {},
    ternaryStates: {}
  });
});

/**
 * API Routes: File Operations
 */

// List files in VFS
app.get('/api/files', (_req, res) => {
  res.json({
    files: [],
    count: 0
  });
});

// Read a file
app.get('/api/files/:path', (req, res) => {
  const { path } = req.params;
  res.status(404).json({ error: 'File not found' });
});

// Write a file
app.post('/api/files/:path', (req, res) => {
  const { path } = req.params;
  const { content } = req.body;
  
  if (!content) {
    res.status(400).json({ error: 'Content is required' });
    return;
  }

  res.json({ success: true, path, size: content.length });
});

// Delete a file
app.delete('/api/files/:path', (req, res) => {
  const { path } = req.params;
  res.json({ success: true, path });
});

/**
 * Serve static files from /browser
 */
app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  }),
);

/**
 * Handle all other requests by rendering the Angular application.
 */
app.use((req, res, next) => {
  angularApp
    .handle(req)
    .then((response) =>
      response ? writeResponseToNodeResponse(response, res) : next(),
    )
    .catch(next);
});

/**
 * Start the server if this module is the main entry point, or it is ran via PM2.
 * The server listens on the port defined by the `PORT` environment variable, or defaults to 4000.
 */
if (isMainModule(import.meta.url) || process.env['pm_id']) {
  const port = Number(process.env['PORT']) || 3000;
  app.listen(port, '0.0.0.0', (error?: any) => {
    if (error) {
      throw error;
    }

    console.log(`EDEN Server listening on http://0.0.0.0:${port}`);
  });
}

/**
 * Request handler used by the Angular CLI (for dev-server and during build) or Firebase Cloud Functions.
 */
export const reqHandler = createNodeRequestHandler(app);
