import { Component, inject, signal } from '@angular/core';
import { NgClass, NgIf } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { CliService } from '../core/CliService';
import { CliUiService } from '../core/CliUiService';
import { TerminalService } from '../core/TerminalService';
import { CoreEngine } from '../core/CoreEngine';
import { VfsService } from '../core/VfsService';

@Component({
  selector: 'eden-cli-panel',
  standalone: true,
  imports: [NgClass, NgIf, MatIconModule, DragDropModule],
  template: `
    <div *ngIf="ui.isOpen()" class="fixed inset-0 z-50 pointer-events-none flex items-center justify-center">
      <div cdkDrag class="pointer-events-auto w-96 bg-[var(--color-eden-surface)] backdrop-blur-3xl border border-[var(--color-eden-border)] rounded-2xl shadow-2xl flex flex-col overflow-hidden"
           style="box-shadow: 0 0 40px rgba(168, 85, 247, 0.15);">
        
        <!-- Header -->
        <div cdkDragHandle class="flex items-center justify-between p-4 border-b border-[var(--color-eden-border)] bg-gradient-to-r from-purple-500/10 to-transparent cursor-move">
          <div class="flex items-center gap-2">
            <mat-icon class="text-purple-400">terminal</mat-icon>
            <h2 class="text-white font-mono font-bold tracking-wider">EDEN CLI FRAMEWORK</h2>
          </div>
          <button (click)="ui.toggle()" class="text-gray-400 hover:text-white transition-colors cursor-pointer">
            <mat-icon>close</mat-icon>
          </button>
        </div>

        <!-- Body -->
        <div class="p-4 flex flex-col gap-4">
          <!-- Engine Selector -->
          <div class="flex gap-2 p-1 bg-black/40 rounded-lg border border-white/5">
            <button (click)="selectedEngine.set('qwen')" 
                    [ngClass]="selectedEngine() === 'qwen' ? 'bg-purple-500/20 text-purple-300 border-purple-500/50' : 'text-gray-500 border-transparent hover:text-gray-300'"
                    class="flex-1 py-1.5 rounded-md font-mono text-xs font-bold border transition-all cursor-pointer">
              QWEN
            </button>
            <button (click)="selectedEngine.set('gemini')" 
                    [ngClass]="selectedEngine() === 'gemini' ? 'bg-blue-500/20 text-blue-300 border-blue-500/50' : 'text-gray-500 border-transparent hover:text-gray-300'"
                    class="flex-1 py-1.5 rounded-md font-mono text-xs font-bold border transition-all cursor-pointer">
              GEMINI
            </button>
          </div>

          <!-- EDEN Mode Toggle -->
          <div class="flex items-center justify-between p-2 bg-black/40 rounded-lg border border-white/5">
            <div class="flex items-center gap-2">
              <mat-icon class="text-[var(--color-eden-neon)]" style="font-size: 16px; width: 16px; height: 16px;">auto_awesome</mat-icon>
              <span class="text-xs font-mono text-gray-300">EDEN Projection Mode</span>
            </div>
            <button (click)="edenMode.set(!edenMode())" 
                    class="w-10 h-5 rounded-full relative transition-colors cursor-pointer"
                    [ngClass]="edenMode() ? 'bg-[var(--color-eden-neon)]' : 'bg-gray-600'">
              <div class="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform"
                   [ngClass]="edenMode() ? 'translate-x-5' : 'translate-x-0'"></div>
            </button>
          </div>

          <!-- Input -->
          <div class="flex flex-col gap-2">
            <label class="text-xs font-mono text-gray-400 uppercase tracking-wider">Command Arguments / Prompt</label>
            <textarea #cliInput rows="3" 
                      class="w-full bg-black/50 border border-white/10 rounded-lg p-3 text-white font-mono text-sm focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/50 transition-all resize-none"
                      placeholder="e.g. --version or 'Create a login node connected to a database'"></textarea>
          </div>

          <!-- Run Button -->
          <button (click)="runCli(cliInput.value)"
                  [disabled]="isExecuting()"
                  class="w-full py-2.5 rounded-lg font-mono text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer"
                  [ngClass]="isExecuting() ? 'bg-gray-800 text-gray-500 cursor-not-allowed' : 'bg-purple-600 hover:bg-purple-500 text-white shadow-[0_0_15px_rgba(168,85,247,0.4)]'">
            <mat-icon *ngIf="!isExecuting()" style="font-size: 18px; width: 18px; height: 18px;">play_arrow</mat-icon>
            <mat-icon *ngIf="isExecuting()" class="animate-spin" style="font-size: 18px; width: 18px; height: 18px;">autorenew</mat-icon>
            {{ isExecuting() ? 'EXECUTING...' : 'EXECUTE CLI' }}
          </button>
        </div>

        <!-- Output -->
        <div *ngIf="lastOutput() || lastError()" class="p-4 border-t border-[var(--color-eden-border)] bg-black/60 max-h-64 overflow-y-auto flex flex-col">
          <label class="text-xs font-mono text-gray-500 uppercase tracking-wider mb-2 block">Output</label>
          <pre *ngIf="lastOutput()" class="text-xs font-mono text-green-400 whitespace-pre-wrap break-words">{{ lastOutput() }}</pre>
          <pre *ngIf="lastError()" class="text-xs font-mono text-red-400 whitespace-pre-wrap break-words mt-2">{{ lastError() }}</pre>
          
          <button *ngIf="!edenMode()" (click)="createNodeFromOutput()" class="mt-4 w-full py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs font-mono text-gray-300 flex items-center justify-center gap-2 transition-colors cursor-pointer">
            <mat-icon style="font-size: 14px; width: 14px; height: 14px;">account_tree</mat-icon>
            INJECT INTO GRAPH
          </button>
        </div>
      </div>
    </div>
  `
})
export class CliPanel {
  public ui = inject(CliUiService);
  private cli = inject(CliService);
  private terminal = inject(TerminalService);
  private engine = inject(CoreEngine);
  private vfs = inject(VfsService);

  selectedEngine = signal<'qwen' | 'gemini'>('qwen');
  isExecuting = signal(false);
  edenMode = signal(true);
  lastOutput = signal<string>('');
  lastError = signal<string>('');

  async runCli(args: string) {
    this.isExecuting.set(true);
    this.lastOutput.set('');
    this.lastError.set('');
    
    let finalArgs = args;
    if (this.edenMode() && !args.startsWith('-')) {
      const currentState = JSON.stringify(this.engine.genome());
      const vfsState = JSON.stringify(this.vfs.files());
      const instructions = `You are an EDEN architecture AI. The user wants to generate nodes in the EDEN graph or modify files. 
You have full access to the current EDEN Graph state:
${currentState}

You also have access to the Virtual File System (VFS):
${vfsState}

You MUST respond ONLY with a JSON block enclosed in \`\`\`json ... \`\`\`. Do not include any other text.
Format strictly as:
\`\`\`json
{
  "nodes": [
    { "id": "unique_string", "type": "UI" | "Logic" | "Data", "position": {"x": number, "y": number}, "metadata": {"title": "string", "content": "string"} }
  ],
  "edges": [
    { "sourceId": "id1", "targetId": "id2" }
  ],
  "files": [
    { "path": "/src/example.ts", "content": "string content here" }
  ]
}
\`\`\`
User request: `;
      finalArgs = instructions + args;
    }

    const engine = this.selectedEngine();
    this.terminal.log('[CLI Framework] Starting ' + engine + '...', 'SYSTEM');
    
    const res = await this.cli.execute(engine, finalArgs);
    
    if (res.stdout) {
      this.lastOutput.set(res.stdout);
      this.terminal.log(res.stdout, 'INFO');
      if (this.edenMode()) {
        this.createNodeFromOutput(res.stdout);
      }
    }
    if (res.stderr) {
      this.lastError.set(res.stderr);
      this.terminal.log(res.stderr, 'WARN');
    }
    if (res.error) {
      this.lastError.set(res.error);
      this.terminal.log(res.error, 'ERROR');
    }
    
    this.isExecuting.set(false);
  }

  createNodeFromOutput(forceOutput?: string) {
    const out = forceOutput || this.lastOutput() || this.lastError();
    if (!out) return;
    
    if (this.edenMode()) {
      try {
        const jsonMatch = out.match(/```(?:json)?\n([\s\S]*?)\n```/) || out.match(/\{([\s\S]*)\}/);
        const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : out;
        
        // Find the first { and last } to extract JSON if it's not perfectly markdown formatted
        const startIndex = jsonStr.indexOf('{');
        const endIndex = jsonStr.lastIndexOf('}');
        
        if (startIndex !== -1 && endIndex !== -1) {
          const cleanJson = jsonStr.substring(startIndex, endIndex + 1);
          const parsed = JSON.parse(cleanJson);
          
          if (parsed) {
            let injectedNodes = 0;
            let injectedEdges = 0;
            let injectedFiles = 0;

            if (parsed.nodes && Array.isArray(parsed.nodes)) {
              const nodesToInject: Record<string, any> = {};
              const edgesToInject: Record<string, any> = {};
              
              const baseX = Math.floor(Math.random() * 300) + 100;
              const baseY = Math.floor(Math.random() * 300) + 100;

              parsed.nodes.forEach((n: any, index: number) => {
                const id = n.id || 'node_ai_' + Math.random().toString(36).substr(2, 9);
                nodesToInject[id] = {
                  id,
                  type: n.type || 'Data',
                  position: { x: baseX + (n.position?.x || index * 300), y: baseY + (n.position?.y || index * 100) },
                  metadata: n.metadata || { title: 'AI Node', content: '' },
                  ternaryState: 'UNKNOWN'
                };
                injectedNodes++;
              });

              parsed.edges?.forEach((e: any) => {
                const edgeId = 'edge_' + e.sourceId + '_' + e.targetId;
                edgesToInject[edgeId] = {
                  id: edgeId,
                  sourceId: e.sourceId,
                  targetId: e.targetId
                };
                injectedEdges++;
              });

              this.engine.mutate({ nodes: nodesToInject, edges: edgesToInject });
            }

            if (parsed.files && Array.isArray(parsed.files)) {
              parsed.files.forEach((f: any) => {
                if (f.path && f.content !== undefined) {
                  this.vfs.writeFile(f.path, f.content);
                  injectedFiles++;
                }
              });
            }

            if (injectedNodes > 0 || injectedEdges > 0 || injectedFiles > 0) {
              this.terminal.log(`[EDEN MODE] Auto-injected ${injectedNodes} nodes, ${injectedEdges} edges, and ${injectedFiles} files from AI.`, 'SYSTEM');
              return;
            }
          }
        }
      } catch (e) {
        console.warn('Could not parse CLI output as EDEN JSON', e);
        this.terminal.log('[EDEN MODE] Failed to parse AI output as JSON graph. Falling back to raw node.', 'WARN');
      }
    }

    // Fallback to raw text node
    const id = 'node_cli_' + Math.random().toString(36).substr(2, 9);
    const x = Math.floor(Math.random() * (window.innerWidth - 300)) + 150;
    const y = Math.floor(Math.random() * (window.innerHeight - 300)) + 150;
    
    this.engine.mutate({
      nodes: {
        [id]: {
          id,
          type: 'Data',
          position: { x, y },
          metadata: { 
            title: this.selectedEngine().toUpperCase() + ' Output', 
            content: out.substring(0, 500) + (out.length > 500 ? '...' : '') 
          },
          ternaryState: 'UNKNOWN'
        }
      },
      edges: {}
    });
    this.terminal.log('CLI output injected into EDEN graph as a new node.', 'SYSTEM');
  }
}
