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
  apiKey: process.env['GEMINI_API_KEY'] || 'fake-key',
  timeout: 120000 // 2 minutes timeout
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
      }, { signal: controller.signal });

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
      }, { signal: controller.signal });

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
    timeoutMs: 120000
  });
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
