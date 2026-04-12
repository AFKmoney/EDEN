import { Injectable } from '@angular/core';
import { AiMode } from './EdenAiPipelineService';

export interface CliResponse {
  stdout?: string;
  stderr?: string;
  error?: string;
}

/**
 * CliService — HTTP client for the EDEN CLI backend API.
 * 
 * Communicates with the Express server's /api/cli endpoint to execute
 * Qwen and Gemini CLI tools. Supports different execution modes
 * (eden, raw, plan, yolo) that control how the CLI is invoked.
 */
@Injectable({ providedIn: 'root' })
export class CliService {

  /**
   * Execute a CLI command against the server.
   * @param tool - Which CLI to invoke ('qwen' or 'gemini')
   * @param args - The arguments/prompt to pass
   * @param mode - Execution mode (eden, raw, plan, yolo)
   */
  async execute(tool: 'qwen' | 'gemini', args: string = '', mode: AiMode = 'yolo'): Promise<CliResponse> {
    try {
      const response = await fetch('/api/cli', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ tool, args, mode }),
      });
      
      return await response.json();
    } catch (error: any) {
      return { error: error.message || 'Failed to execute CLI command' };
    }
  }

  /**
   * Execute a CLI command and stream the response via SSE fetch reader.
   * Updates UI continuously as chunks arrive.
   */
  async *executeStream(tool: 'qwen' | 'gemini', args: string = '', mode: AiMode = 'yolo'): AsyncGenerator<any, void, unknown> {
    try {
      const response = await fetch('/api/cli/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tool, args, mode })
      });

      if (!response.body) return;

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        
        // Parse SSE chunks (data: {...}\n\n)
        let boundary = buffer.indexOf('\n\n');
        while (boundary !== -1) {
          const chunk = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary + 2);
          
          if (chunk.startsWith('data: ')) {
            try {
              const payload = JSON.parse(chunk.substring(6));
              yield payload;
            } catch (e) { }
          }
          boundary = buffer.indexOf('\n\n');
        }
      }
    } catch (e: any) {
      yield { error: e.message || 'Stream failed' };
    }
  }
}
