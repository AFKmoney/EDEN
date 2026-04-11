import { Component, inject, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { TerminalService } from '../core/TerminalService';
import { MatIconModule } from '@angular/material/icon';
import { DatePipe, NgClass, NgIf } from '@angular/common';
import { AppUiService } from '../core/AppUiService';
import { CliService } from '../core/CliService';
import { CoreEngine } from '../core/CoreEngine';
import { VfsService } from '../core/VfsService';

@Component({
  selector: 'eden-terminal',
  standalone: true,
  imports: [MatIconModule, DatePipe, NgClass, NgIf],
  template: `
    <div class="fixed bottom-0 left-0 w-full h-[300px] bg-[var(--color-eden-bg)] border-t border-[var(--color-eden-border)] font-mono text-xs flex flex-col z-40 transition-transform duration-300 shadow-[0_-10px_40px_rgba(0,0,0,0.5)]"
         [class.translate-y-full]="!ui.isTerminalOpen()">
      
      <!-- Terminal Header -->
      <div class="flex items-center justify-between px-4 py-2 bg-[var(--color-eden-surface)] border-b border-[var(--color-eden-border)] cursor-pointer" (click)="ui.toggleTerminal()">
        <div class="flex items-center gap-2 text-[var(--color-eden-neon)] font-bold">
          <mat-icon style="font-size: 16px; width: 16px; height: 16px;">terminal</mat-icon>
          <span>NEXUS_TERMINAL v3.0 // TERNARY_VM</span>
        </div>
        <div class="flex items-center gap-3">
          <button (click)="$event.stopPropagation(); terminal.clear()" class="text-gray-500 hover:text-white transition-colors flex items-center gap-1">
            <mat-icon style="font-size: 14px; width: 14px; height: 14px;">delete_sweep</mat-icon>
            <span class="text-[10px] uppercase">Clear</span>
          </button>
          <mat-icon style="font-size: 18px; width: 18px; height: 18px;" class="text-gray-400">
            {{ ui.isTerminalOpen() ? 'expand_more' : 'expand_less' }}
          </mat-icon>
        </div>
      </div>

      <!-- Terminal Output -->
      <div class="flex-1 overflow-y-auto p-3 space-y-1.5" #scrollContainer>
        @for (log of terminal.logs(); track log.timestamp) {
          <div class="flex gap-3 items-start">
            <span class="text-gray-600 shrink-0">[{{ log.timestamp | date:'HH:mm:ss.SSS' }}]</span>
            <span class="shrink-0 font-bold"
                  [ngClass]="{
                    'text-blue-400': log.level === 'INFO',
                    'text-yellow-400': log.level === 'WARN',
                    'text-red-400': log.level === 'ERROR',
                    'text-[var(--color-eden-neon)]': log.level === 'SYSTEM',
                    'text-emerald-400': log.level === 'TERNARY'
                  }">
              [{{ log.level }}]
            </span>
            <span class="text-gray-300 whitespace-pre-wrap break-words font-mono">{{ log.message }}</span>
          </div>
        }
        @if (terminal.logs().length === 0) {
          <div class="text-gray-600 italic">Waiting for system events...</div>
        }
      </div>

      <!-- Terminal Input -->
      <div class="p-2 bg-black/40 border-t border-[var(--color-eden-border)] flex items-center gap-2">
        <span class="text-[var(--color-eden-neon)] font-bold">root@eden:~#</span>
        <input 
          #cmdInput
          type="text" 
          class="flex-1 bg-transparent border-none outline-none text-white font-mono text-xs"
          placeholder="Type a command (e.g. /qwen create a node, /gemini analyze graph, clear)..."
          (keydown.enter)="executeCommand(cmdInput.value); cmdInput.value = ''"
          [disabled]="isExecuting"
        />
        <mat-icon *ngIf="isExecuting" class="text-[var(--color-eden-neon)] animate-spin" style="font-size: 14px; width: 14px; height: 14px;">autorenew</mat-icon>
      </div>
    </div>
  `
})
export class TerminalPanel implements AfterViewChecked {
  public terminal = inject(TerminalService);
  public ui = inject(AppUiService);
  private cli = inject(CliService);
  private engine = inject(CoreEngine);
  private vfs = inject(VfsService);

  @ViewChild('scrollContainer') private scrollContainer!: ElementRef;
  isExecuting = false;

  ngAfterViewChecked() {
    this.scrollToBottom();
  }

  private scrollToBottom(): void {
    try {
      this.scrollContainer.nativeElement.scrollTop = this.scrollContainer.nativeElement.scrollHeight;
    } catch(err) { }
  }

  async executeCommand(cmd: string) {
    if (!cmd || !cmd.trim()) return;
    
    const trimmed = cmd.trim();
    this.terminal.log(trimmed, 'INFO'); // Echo command

    if (trimmed === 'clear') {
      this.terminal.clear();
      return;
    }

    let engineName: 'qwen' | 'gemini' | null = null;
    let args = '';

    if (trimmed.startsWith('/qwen ') || trimmed === '/qwen') {
      engineName = 'qwen';
      args = trimmed.replace('/qwen', '').trim();
    } else if (trimmed.startsWith('/gemini ') || trimmed === '/gemini') {
      engineName = 'gemini';
      args = trimmed.replace('/gemini', '').trim();
    } else {
      this.terminal.log(`Command not found: ${trimmed}. Try /qwen <prompt> or /gemini <prompt>`, 'ERROR');
      return;
    }

    this.isExecuting = true;
    this.terminal.log(`[CLI Framework] Starting ${engineName}...`, 'SYSTEM');

    // Provide context of the current VM and Graph state
    const currentState = JSON.stringify(this.engine.genome());
    const vfsState = JSON.stringify(this.vfs.files());
    const instructions = `You are an EDEN architecture AI connected to the Terminal. 
The user is interacting with you via the CLI.
You have full access to the current EDEN Graph and Ternary VM state:
${currentState}

You also have access to the Virtual File System (VFS):
${vfsState}

If the user asks to create or modify nodes, OR create/modify files, you MUST respond ONLY with a JSON block enclosed in \`\`\`json ... \`\`\`.
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
If the user is just asking a question about the state or general dev environment, respond normally in text.
User request: `;

    const finalArgs = instructions + args;

    try {
      const res = await this.cli.execute(engineName, finalArgs);
      
      if (res.stdout) {
        this.terminal.log(res.stdout, 'INFO');
        this.tryInjectGraph(res.stdout);
      }
      if (res.stderr) {
        this.terminal.log(res.stderr, 'WARN');
      }
      if (res.error) {
        this.terminal.log(res.error, 'ERROR');
      }
    } catch (e: any) {
      this.terminal.log(e.message || 'Unknown error executing CLI', 'ERROR');
    } finally {
      this.isExecuting = false;
    }
  }

  private tryInjectGraph(out: string) {
    try {
      const jsonMatch = out.match(/```(?:json)?\n([\s\S]*?)\n```/) || out.match(/\{([\s\S]*)\}/);
      const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : out;
      
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
          }
        }
      }
    } catch (e) {
      // Not JSON or invalid JSON, ignore. It was just a text response.
    }
  }
}
