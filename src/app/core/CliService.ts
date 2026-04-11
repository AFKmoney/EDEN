import { Injectable } from '@angular/core';

export interface CliResponse {
  stdout?: string;
  stderr?: string;
  error?: string;
}

@Injectable({ providedIn: 'root' })
export class CliService {
  async execute(tool: 'qwen' | 'gemini', args: string = ''): Promise<CliResponse> {
    try {
      const response = await fetch('/api/cli', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ tool, args }),
      });
      
      return await response.json();
    } catch (error: any) {
      return { error: error.message || 'Failed to execute CLI command' };
    }
  }
}
