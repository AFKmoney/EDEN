import { Component, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { CoreEngine } from '../core/CoreEngine';
import { NodeType } from '../types/node';
import { EdenEdge } from '../types/edge';
import { AppUiService } from '../core/AppUiService';
import { CliUiService } from '../core/CliUiService';
import { EdenAiPipelineService } from '../core/EdenAiPipelineService';

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
            [disabled]="pipeline.isExecuting()"
          />
          <button 
            (click)="processIntent(intentInput.value); intentInput.value = ''"
            [disabled]="pipeline.isExecuting()"
            class="flex items-center justify-center w-10 h-10 rounded-full bg-[var(--color-eden-neon)]/20 text-[var(--color-eden-neon)] hover:bg-[var(--color-eden-neon)] hover:text-white transition-colors cursor-pointer border border-transparent hover:border-white/20 disabled:opacity-50">
            <mat-icon>{{ pipeline.isExecuting() ? 'hourglass_empty' : 'send' }}</mat-icon>
          </button>
        </div>
      </div>
    </div>
  `
})
export class PromptBar {
  public engine = inject(CoreEngine);
  public pipeline = inject(EdenAiPipelineService);
  private ui = inject(AppUiService);
  private cliUi = inject(CliUiService);

  async processIntent(intent: string) {
    if (!intent || !intent.trim()) return;
    
    const trimmed = intent.trim();

    // Check for CLI commands
    let engineName: 'qwen' | 'gemini' | null = null;
    let args = '';
    let isAgentic = false;

    if (trimmed.startsWith('/agent qwen ') || trimmed === '/agent qwen') {
      engineName = 'qwen';
      args = trimmed.replace('/agent qwen', '').trim();
      isAgentic = true;
    } else if (trimmed.startsWith('/agent gemini ') || trimmed === '/agent gemini') {
      engineName = 'gemini';
      args = trimmed.replace('/agent gemini', '').trim();
      isAgentic = true;
    } else if (trimmed.startsWith('/qwen ') || trimmed === '/qwen') {
      engineName = 'qwen';
      args = trimmed.replace('/qwen', '').trim();
    } else if (trimmed.startsWith('/gemini ') || trimmed === '/gemini') {
      engineName = 'gemini';
      args = trimmed.replace('/gemini', '').trim();
    }

    if (engineName) {
      if (isAgentic) {
        if (!args) return;
        this.cliUi.isOpen.set(true);
        this.ui.isTerminalOpen.set(true);
        await this.pipeline.executeAgenticLoop(engineName, args);
      } else {
        this.ui.isTerminalOpen.set(true);
        // Execute via the centralized pipeline
        if (args.startsWith('-')) {
          await this.pipeline.executeRaw(engineName, args);
        } else {
          await this.pipeline.execute(engineName, args);
        }
      }
      return;
    }

    // Simulate Synapse AI Bridge translating intent to Graph Mutation as fallback
    const id = 'node_' + Math.random().toString(36).substr(2, 9);
    const types: NodeType[] = ['UI', 'Logic', 'Data'];
    const type = types[Math.floor(Math.random() * types.length)];
    
    // Random position on screen
    const x = Math.floor(Math.random() * (window.innerWidth - 300)) + 150;
    const y = Math.floor(Math.random() * (window.innerHeight - 300)) + 150;

    const currentNodes = Object.keys(this.engine.genome().nodes);
    const edges: Record<string, EdenEdge> = {};

    // Auto-connect to the last created node
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
          ternaryState: 'UNKNOWN' 
        }
      },
      edges
    });
  }
}
