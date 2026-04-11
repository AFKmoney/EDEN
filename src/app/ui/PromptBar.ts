import { Component, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { CoreEngine } from '../core/CoreEngine';
import { NodeType } from '../types/node';
import { NgClass } from '@angular/common';
import { CliService } from '../core/CliService';
import { TerminalService } from '../core/TerminalService';
import { AppUiService } from '../core/AppUiService';
import { VfsService } from '../core/VfsService';

@Component({
  selector: 'eden-prompt-bar',
  standalone: true,
  imports: [MatIconModule],
  template: `
    <div class="fixed bottom-0 left-0 w-full h-32 z-50 pointer-events-none flex items-end justify-center pb-8 group">
      
      <!-- Trigger area at the very bottom with a subtle indicator -->
      <div class="absolute bottom-0 left-0 w-full h-6 pointer-events-auto flex justify-center items-end pb-1 cursor-pointer">
        <div class="w-48 h-1 rounded-full bg-white/10 group-hover:bg-transparent transition-colors duration-500 shadow-[0_0_10px_rgba(255,255,255,0.2)]"></div>
      </div>
      
      <!-- Prompt Bar Content -->
      <div class="w-full max-w-3xl px-4 pointer-events-auto transition-all duration-500 translate-y-32 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 focus-within:translate-y-0 focus-within:opacity-100">
        <div class="bg-[var(--color-eden-surface)] backdrop-blur-2xl border border-[var(--color-eden-border)] rounded-2xl p-3 shadow-[0_10px_50px_rgba(0,0,0,0.5)] flex items-center gap-4 transition-all duration-500 focus-within:border-[var(--color-eden-neon)] focus-within:shadow-[0_0_40px_var(--color-eden-neon)]">
          
          <mat-icon class="text-[var(--color-eden-neon)] animate-pulse ml-2">auto_awesome</mat-icon>
          <input 
            #intentInput
            type="text" 
            placeholder="Inject intent into EDEN (e.g. 'Create Auth Node' or '/qwen --version')..." 
            class="flex-1 bg-transparent border-none outline-none text-white placeholder-gray-500 font-mono text-sm py-2"
            (keydown.enter)="processIntent(intentInput.value); intentInput.value = ''"
          />
          <button 
            (click)="processIntent(intentInput.value); intentInput.value = ''"
            class="flex items-center justify-center w-10 h-10 rounded-full bg-[var(--color-eden-neon)]/20 text-[var(--color-eden-neon)] hover:bg-[var(--color-eden-neon)] hover:text-white transition-colors cursor-pointer border border-transparent hover:border-white/20">
            <mat-icon>send</mat-icon>
          </button>
        </div>
      </div>
    </div>
  `
})
export class PromptBar {
  public engine = inject(CoreEngine);
  private cli = inject(CliService);
  private terminal = inject(TerminalService);
  private ui = inject(AppUiService);
  private vfs = inject(VfsService);

  async processIntent(intent: string) {
    if (!intent || !intent.trim()) return;
    
    const trimmed = intent.trim();

    // Check for CLI commands
    let engineName: 'qwen' | 'gemini' | null = null;
    let args = '';

    if (trimmed.startsWith('/qwen ') || trimmed === '/qwen') {
      engineName = 'qwen';
      args = trimmed.replace('/qwen', '').trim();
    } else if (trimmed.startsWith('/gemini ') || trimmed === '/gemini') {
      engineName = 'gemini';
      args = trimmed.replace('/gemini', '').trim();
    }

    if (engineName) {
      this.ui.isTerminalOpen.set(true);
      this.terminal.log(`Executing: ${engineName} ${args}`, 'SYSTEM');

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
        if (res.stderr) this.terminal.log(res.stderr, 'WARN');
        if (res.error) this.terminal.log(res.error, 'ERROR');
      } catch (e: any) {
        this.terminal.log(e.message || 'Unknown error', 'ERROR');
      }
      return;
    }

    // Simulate Synapse AI Bridge translating intent to Graph Mutation
    const id = 'node_' + Math.random().toString(36).substr(2, 9);
    const types: NodeType[] = ['UI', 'Logic', 'Data'];
    const type = types[Math.floor(Math.random() * types.length)];
    
    // Random position on screen
    const x = Math.floor(Math.random() * (window.innerWidth - 300)) + 150;
    const y = Math.floor(Math.random() * (window.innerHeight - 300)) + 150;

    const currentNodes = Object.keys(this.engine.genome().nodes);
    const edges: Record<string, any> = {};

    // Auto-connect to the last created node so the user immediately sees the animated SVG edges
    if (currentNodes.length > 0) {
      const sourceId = currentNodes[currentNodes.length - 1];
      const edgeId = 'edge_' + sourceId + '_' + id;
      edges[edgeId] = {
        id: edgeId,
        sourceId: sourceId,
        targetId: id
      };
    }

    this.engine.mutate({
      nodes: {
        [id]: {
          id,
          type,
          position: { x, y },
          metadata: { title: intent },
          ternaryState: 'UNKNOWN' // Initialize with UNKNOWN state
        }
      },
      edges
    });
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
