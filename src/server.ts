import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import {join} from 'node:path';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

const browserDistFolder = join(import.meta.dirname, '../browser');

const app = express();
const angularApp = new AngularNodeAppEngine();

app.use(express.json());

/**
 * API Route to execute CLI tools
 */
app.post('/api/cli', async (req, res) => {
  const { tool, args } = req.body;
  
  if (!['qwen', 'gemini'].includes(tool)) {
    res.status(400).json({ error: 'Invalid tool. Only qwen and gemini are allowed.' });
    return;
  }

  try {
    let finalArgs = args || '';
    
    if (tool === 'qwen') {
      // Ensure we use non-interactive mode and set auth type
      if (!finalArgs.includes('-p') && !finalArgs.includes('--prompt') && !finalArgs.includes('--version') && !finalArgs.includes('--help')) {
        finalArgs = '--auth-type gemini -p "' + finalArgs.replace(/"/g, '\\"') + '"';
      } else if (!finalArgs.includes('--auth-type') && !finalArgs.includes('--version') && !finalArgs.includes('--help')) {
        finalArgs = '--auth-type gemini ' + finalArgs;
      }
    } else if (tool === 'gemini') {
      // Ensure we use non-interactive mode
      if (!finalArgs.includes('-p') && !finalArgs.includes('--prompt') && !finalArgs.includes('--version') && !finalArgs.includes('--help')) {
        finalArgs = '-p "' + finalArgs.replace(/"/g, '\\"') + '"';
      }
    }

    // Using npx to run the locally installed CLI tools
    const command = 'npx ' + tool + ' ' + finalArgs;
    const { stdout, stderr } = await execAsync(command);
    res.json({ stdout, stderr });
  } catch (error: any) {
    res.status(500).json({ error: error.message, stdout: error.stdout, stderr: error.stderr });
  }
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

    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

/**
 * Request handler used by the Angular CLI (for dev-server and during build) or Firebase Cloud Functions.
 */
export const reqHandler = createNodeRequestHandler(app);
