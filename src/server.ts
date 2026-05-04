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
const ai = new GoogleGenAI({ apiKey: process.env['GEMINI_API_KEY'] || 'fake-key' });

/**
 * Execute an API command for local (Ollama) or Gemini models.
 */
async function executeApi(
  tool: 'local' | 'gemini',
  args: string,
  mode: string,
): Promise<{ stdout: string; stderr: string }> {
  try {
    if (tool === 'local') {
      // Local model (Ollama API compatible)
      // Defaults to using standard format: http://127.0.0.1:11434/api/generate
      const payload = {
        model: process.env['LOCAL_MODEL'] || 'qwen2.5-coder', // defaulting to a coder model
        prompt: args,
        stream: false,
      };

      const localApiUrl = process.env['LOCAL_API_URL'] || 'http://127.0.0.1:11434/api/generate';
      const response = await fetch(localApiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Local API error: ${response.statusText}`);
      }

      const data = await response.json();
      return { stdout: data.response || data.message?.content || JSON.stringify(data), stderr: '' };
    } else if (tool === 'gemini') {
      // Gemini API
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: args,
      });

      return { stdout: response.text || '', stderr: '' };
    }
  } catch (e: any) {
    return { stdout: '', stderr: e.message || 'Unknown error occurred' };
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
  try {
    if (tool === 'local') {
      const payload = {
        model: process.env['LOCAL_MODEL'] || 'qwen2.5-coder',
        prompt: args,
        stream: true,
      };

      const localApiUrl = process.env['LOCAL_API_URL'] || 'http://127.0.0.1:11434/api/generate';
      const response = await fetch(localApiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error(`Local API error: ${response.statusText}`);
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
      const responseStream = await ai.models.generateContentStream({
        model: 'gemini-2.5-flash',
        contents: args,
      });

      for await (const chunk of responseStream) {
        if (chunk.text) {
          onData(chunk.text);
        }
      }
      onComplete();
    }
  } catch (e: any) {
    onError(e.message || 'Stream failed');
  }
}


/**
 * API Route to execute CLI tools (local / gemini)
 * Supports modes: eden, raw, plan, yolo (default: yolo)
 */
app.post('/api/cli', async (req, res) => {
  const { tool, args, mode = 'yolo' } = req.body;
  
  if (!['local', 'gemini'].includes(tool)) {
    res.status(400).json({ error: 'Invalid tool. Only local and gemini are allowed.' });
    return;
  }

  if (!args && mode !== 'raw') {
    res.status(400).json({ error: 'No arguments provided.' });
    return;
  }

  try {
    const { stdout, stderr } = await executeApi(tool, args || '', mode);
    res.json({ stdout, stderr });
  } catch (error: unknown) {
    const err = error as { message?: string; stdout?: string; stderr?: string };
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
  
  if (!['local', 'gemini'].includes(tool)) {
    res.status(400).end();
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  await executeApiStream(
    tool,
    args,
    mode,
    (text) => {
      res.write(`data: ${JSON.stringify({ stdout: text })}\n\n`);
    },
    (err) => {
      res.write(`data: ${JSON.stringify({ error: err })}\n\n`);
      res.end();
    },
    () => {
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
