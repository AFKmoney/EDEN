import { Injectable, signal } from '@angular/core';
import { AiMode } from './EdenAiPipelineService';
import { AiProvider } from '../types/provider';

export interface CliResponse {
  stdout?: string;
  stderr?: string;
  error?: string;
}

/**
 * CliService — HTTP client for the EDEN CLI backend API.
 * 
 * Communicates with the Express server's /api/cli endpoint to execute
 * AI tools across all supported providers (NVIDIA, Claude, Gemini, OpenAI,
 * DeepSeek, Groq, Mistral, OpenRouter, Local Ollama).
 */
@Injectable({ providedIn: 'root' })
export class CliService {

  public storedKeys = signal<Record<string, string>>(this.getAllStoredKeys());

  private getStoredKey(provider: string): string {
    const keys = this.storedKeys();
    return keys[provider] || '';
  }

  public setStoredKey(provider: string, key: string) {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
    try {
      const keys = JSON.parse(localStorage.getItem('eden_provider_keys') || '{}');
      if (key && key.trim()) {
        keys[provider] = key.trim();
      } else {
        delete keys[provider];
      }
      localStorage.setItem('eden_provider_keys', JSON.stringify(keys));
      this.storedKeys.set({ ...keys });
    } catch {}
  }

  public getAllStoredKeys(): Record<string, string> {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') return {};
    try {
      return JSON.parse(localStorage.getItem('eden_provider_keys') || '{}');
    } catch {
      return {};
    }
  }

  /**
   * Execute a CLI command against the server.
   */
  async execute(
    tool: AiProvider | string, 
    args: string = '', 
    mode: AiMode = 'yolo',
    model?: string,
    customApiKey?: string
  ): Promise<CliResponse> {
    try {
      const key = customApiKey || this.getStoredKey(tool);
      const response = await fetch('/api/cli', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          tool, 
          provider: tool, 
          args, 
          mode, 
          model, 
          customApiKey: key 
        }),
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
  async *executeStream(
    tool: AiProvider | string, 
    args: string = '', 
    mode: AiMode = 'yolo',
    model?: string,
    customApiKey?: string
  ): AsyncGenerator<any, void, unknown> {
    try {
      const key = customApiKey || this.getStoredKey(tool);
      const response = await fetch('/api/cli/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          tool, 
          provider: tool, 
          args, 
          mode, 
          model, 
          customApiKey: key 
        })
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

