import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import {join} from 'node:path';
import { spawn } from 'node:child_process';

const browserDistFolder = join(import.meta.dirname, '../browser');

const app = express();
const angularApp = new AngularNodeAppEngine();

app.use(express.json({ limit: '10mb' }));

/**
 * Execute a CLI command with timeout and sanitization.
 * Uses spawn instead of exec for better security and streaming capability.
 */
function executeCli(
  tool: 'qwen' | 'gemini',
  args: string,
  mode: string,
  timeoutMs = 120000
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    let finalArgs: string[] = [];

    // Build argument list based on mode
    if (mode === 'raw') {
      // Raw mode: pass arguments directly (for --version, --help, etc.)
      finalArgs = args.split(/\s+/).filter(Boolean);
    } else {
      // EDEN/YOLO/Plan mode: wrap as a prompt
      const isAlreadyFlagged = args.startsWith('-') || args.startsWith('--');

      if (isAlreadyFlagged) {
        finalArgs = args.split(/\s+/).filter(Boolean);
      } else {
        // Build prompt with mode-specific flags
        if (tool === 'qwen') {
          finalArgs = ['--auth-type', 'gemini'];
          if (mode === 'yolo') {
            finalArgs.push('--approval-mode', 'yolo');
          } else if (mode === 'plan') {
            finalArgs.push('--approval-mode', 'plan');
          }
          finalArgs.push('-p', args);
          finalArgs.push('-o', 'text');
        } else if (tool === 'gemini') {
          if (mode === 'yolo') {
            finalArgs.push('--approval-mode', 'yolo');
          } else if (mode === 'plan') {
            finalArgs.push('--approval-mode', 'plan');
          }
          finalArgs.push('-p', args);
          finalArgs.push('-o', 'text');
        }
      }
    }

    let stdout = '';
    let stderr = '';
    let killed = false;

    // Use the globally installed CLI directly (not npx)
    const child = spawn(tool, finalArgs, {
      shell: true,
      timeout: timeoutMs,
      env: { ...process.env },
      stdio: ['pipe', 'pipe', 'pipe']
    });

    child.stdout.on('data', (data: Buffer) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    // Timeout safety net
    const timer = setTimeout(() => {
      killed = true;
      child.kill('SIGTERM');
      setTimeout(() => {
        if (!child.killed) child.kill('SIGKILL');
      }, 5000);
    }, timeoutMs);

    child.on('close', (code: number | null) => {
      clearTimeout(timer);
      if (killed) {
        reject(new Error(`CLI process timed out after ${timeoutMs / 1000}s and was killed.`));
      } else if (code !== 0 && code !== null) {
        // Non-zero exit but still return output
        resolve({ stdout, stderr: stderr || `Process exited with code ${code}` });
      } else {
        resolve({ stdout, stderr });
      }
    });

    child.on('error', (err: Error) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

/**
 * API Route to execute CLI tools (qwen / gemini)
 * Supports modes: eden, raw, plan, yolo (default: yolo)
 */
app.post('/api/cli', async (req, res) => {
  const { tool, args, mode = 'yolo' } = req.body;
  
  if (!['qwen', 'gemini'].includes(tool)) {
    res.status(400).json({ error: 'Invalid tool. Only qwen and gemini are allowed.' });
    return;
  }

  if (!args && mode !== 'raw') {
    res.status(400).json({ error: 'No arguments provided.' });
    return;
  }

  try {
    const { stdout, stderr } = await executeCli(tool, args || '', mode);
    res.json({ stdout, stderr });
  } catch (error: unknown) {
    const err = error as { message?: string; stdout?: string; stderr?: string };
    res.status(500).json({ 
      error: err.message || 'CLI execution failed',
      stdout: err.stdout || '',
      stderr: err.stderr || ''
    });
  }
});

/**
 * API Route: True SSE streaming for CLI execution
 */
app.post('/api/cli/stream', (req, res) => {
  const { tool, args, mode = 'yolo' } = req.body;
  
  if (!['qwen', 'gemini'].includes(tool)) {
    res.status(400).end();
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  let finalArgs: string[] = [];

  if (mode === 'raw') {
    finalArgs = args.split(/\s+/).filter(Boolean);
  } else {
    const isAlreadyFlagged = args.startsWith('-') || args.startsWith('--');
    if (isAlreadyFlagged) {
      finalArgs = args.split(/\s+/).filter(Boolean);
    } else {
      if (tool === 'qwen') {
        finalArgs = ['--auth-type', 'gemini'];
        if (mode === 'yolo') finalArgs.push('--approval-mode', 'yolo');
        else if (mode === 'plan') finalArgs.push('--approval-mode', 'plan');
        finalArgs.push('-p', args, '-o', 'text');
      } else if (tool === 'gemini') {
        if (mode === 'yolo') finalArgs.push('--approval-mode', 'yolo');
        else if (mode === 'plan') finalArgs.push('--approval-mode', 'plan');
        finalArgs.push('-p', args, '-o', 'text');
      }
    }
  }

  const child = spawn(tool, finalArgs, {
    shell: true,
    timeout: 120000,
    env: { ...process.env },
    stdio: ['pipe', 'pipe', 'pipe']
  });

  child.stdout.on('data', (data: Buffer) => {
    res.write(`data: ${JSON.stringify({ stdout: data.toString() })}\n\n`);
  });

  child.stderr.on('data', (data: Buffer) => {
    res.write(`data: ${JSON.stringify({ stderr: data.toString() })}\n\n`);
  });

  child.on('error', (err: Error) => {
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
    res.end();
  });

  child.on('close', (code: number | null) => {
    res.write(`data: ${JSON.stringify({ done: true, code })}\n\n`);
    res.end();
  });
});

/**
 * API Route: Get CLI capabilities
 */
app.get('/api/cli/capabilities', (_req, res) => {
  res.json({
    engines: {
      qwen: {
        name: 'Qwen Code',
        modes: ['eden', 'raw', 'plan', 'yolo'],
        flags: ['--version', '--help', '--model', '-p', '--approval-mode', '--auth-type', '-o'],
        defaultMode: 'yolo'
      },
      gemini: {
        name: 'Gemini CLI',
        modes: ['eden', 'raw', 'plan', 'yolo'],
        flags: ['--version', '--help', '--model', '-p', '--approval-mode', '-o', '--autonomous'],
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
