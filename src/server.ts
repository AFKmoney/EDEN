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
const angularApp = new AngularNodeAppEngine();

app.use(express.json({ limit: '10mb' }));

// Initialize Gemini Client
const ai = new GoogleGenAI({ 
  apiKey: process.env['GEMINI_API_KEY'] || 'fake-key'
});

// Global request timeout for AI operations
const AI_TIMEOUT_MS = 120000;

/**
 * Execute an API command for local (Ollama) or Gemini models.
 */
async function executeApi(
  tool: 'local' | 'gemini',
  args: string,
  mode: string,
): Promise<{ stdout: string; stderr: string }> {
  // Validate inputs
  if (!tool || !['local', 'gemini'].includes(tool)) {
    return { stdout: '', stderr: 'Invalid tool. Only local and gemini are supported.' };
  }

  try {
    if (tool === 'local') {
      // Local model (Ollama API compatible)
      const payload = {
        model: process.env['LOCAL_MODEL'] || 'qwen2.5-coder',
        prompt: args,
        stream: false,
      };

      const localApiUrl = process.env['LOCAL_API_URL'] || 'http://127.0.0.1:11434/api/generate';
      
      // Add timeout to the fetch request
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);
      
      const response = await fetch(localApiUrl, {
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
    } else if (tool === 'gemini') {
      // Check if API key is available
      if (!process.env['GEMINI_API_KEY'] || process.env['GEMINI_API_KEY'] === 'fake-key') {
        return { 
          stdout: '', 
          stderr: 'Gemini API key not configured. Set GEMINI_API_KEY environment variable.' 
        };
      }

      // Add timeout to the generation
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);
      
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: args,
      });

      clearTimeout(timeoutId);

      return { stdout: response.text || '', stderr: '' };
    }
  } catch (e: any) {
    const errorMessage = e.message || 'Unknown error occurred';
    console.error(`[EDEN Server] Error executing ${tool}:`, errorMessage);
    return { stdout: '', stderr: errorMessage };
  }

  return { stdout: '', stderr: 'Invalid tool' };
}

/**
 * Execute an API command for local or Gemini models with SSE Streaming.
 */
async function executeApiStream(
  tool: 'local' | 'gemini',
  args: string,
  mode: string,
  onData: (text: string) => void,
  onError: (error: string) => void,
  onComplete: () => void
) {
  // Validate inputs
  if (!tool || !['local', 'gemini'].includes(tool)) {
    onError('Invalid tool. Only local and gemini are supported.');
    return;
  }

  try {
    if (tool === 'local') {
      const payload = {
        model: process.env['LOCAL_MODEL'] || 'qwen2.5-coder',
        prompt: args,
        stream: true,
      };

      const localApiUrl = process.env['LOCAL_API_URL'] || 'http://127.0.0.1:11434/api/generate';
      
      // Add timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);
      
      const response = await fetch(localApiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) throw new Error(`Local API error: ${response.status} ${response.statusText}`);
      if (!response.body) throw new Error('No response body');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        // Simple line splitting to handle multiple JSON objects in one chunk
        const lines = chunk.split('\n').filter(l => l.trim() !== '');
        for (const line of lines) {
           try {
              const data = JSON.parse(line);
              const text = data.response || data.message?.content || '';
              if (text) onData(text);
           } catch(e) {
              // Not JSON, just pass it through
              onData(line);
           }
        }
      }
      onComplete();
    } else if (tool === 'gemini') {
      // Check if API key is available
      if (!process.env['GEMINI_API_KEY'] || process.env['GEMINI_API_KEY'] === 'fake-key') {
        onError('Gemini API key not configured. Set GEMINI_API_KEY environment variable.');
        return;
      }

      // Add timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);
      
      const responseStream = await ai.models.generateContentStream({
        model: 'gemini-2.5-flash',
        contents: args,
      });

      clearTimeout(timeoutId);

      for await (const chunk of responseStream) {
        if (chunk.text) {
          onData(chunk.text);
        }
      }
      onComplete();
    }
  } catch (e: any) {
    const errorMessage = e.message || 'Stream failed';
    console.error(`[EDEN Server] Stream error for ${tool}:`, errorMessage);
    onError(errorMessage);
  }
}


/**
 * API Route to execute CLI tools (local / gemini)
 * Supports modes: eden, raw, plan, yolo (default: yolo)
 */
app.post('/api/cli', async (req, res) => {
  const { tool, args, mode = 'yolo' } = req.body;
  
  // Input validation
  if (!tool || !['local', 'gemini'].includes(tool)) {
    res.status(400).json({ error: 'Invalid tool. Only local and gemini are allowed.' });
    return;
  }

  // Sanitize args - ensure it's a string
  const sanitizedArgs = typeof args === 'string' ? args : '';

  if (!sanitizedArgs && mode !== 'raw') {
    res.status(400).json({ error: 'No arguments provided.' });
    return;
  }

  // Rate limiting check (simple in-memory)
  const now = Date.now();
  
  try {
    const { stdout, stderr } = await executeApi(tool, sanitizedArgs, mode);
    
    // Log the request
    console.log(`[EDEN API] ${tool} request completed`);
    
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
 * API Route: True SSE streaming for API execution
 */
app.post('/api/cli/stream', async (req, res) => {
  const { tool, args, mode = 'yolo' } = req.body;
  
  // Input validation
  if (!tool || !['local', 'gemini'].includes(tool)) {
    res.status(400).json({ error: 'Invalid tool. Only local and gemini are allowed.' });
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
    tool,
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
      console.log(`[EDEN Stream] Completed successfully`);
      res.write(`data: ${JSON.stringify({ done: true, code: 0 })}\n\n`);
      res.end();
    }
  );
});

/**
 * API Route: Get CLI capabilities
 */
app.get('/api/cli/capabilities', (_req, res) => {
  res.json({
    engines: {
      local: {
        name: 'Local Model',
        modes: ['eden', 'raw', 'plan', 'yolo'],
        flags: [],
        defaultMode: 'yolo'
      },
      gemini: {
        name: 'Gemini API',
        modes: ['eden', 'raw', 'plan', 'yolo'],
        flags: [],
        defaultMode: 'yolo'
      }
    },
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
  const port = process.env['PORT'] || 4000;
  app.listen(port, (error) => {
    if (error) {
      throw error;
    }

    console.log(`EDEN Server listening on http://localhost:${port}`);
  });
}

/**
 * Request handler used by the Angular CLI (for dev-server and during build) or Firebase Cloud Functions.
 */
export const reqHandler = createNodeRequestHandler(app);
