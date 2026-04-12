import { Component, inject, signal } from '@angular/core';
import { NgClass, NgIf } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { CliUiService } from '../core/CliUiService';
import { EdenAiPipelineService, AiMode } from '../core/EdenAiPipelineService';

@Component({
  selector: 'eden-cli-panel',
  standalone: true,
  imports: [NgClass, NgIf, MatIconModule, DragDropModule],
  template: `
    <div *ngIf="ui.isOpen()" class="fixed inset-0 z-50 pointer-events-none flex items-center justify-center">
      <div cdkDrag class="pointer-events-auto w-[420px] bg-[var(--color-eden-surface)] backdrop-blur-3xl border border-[var(--color-eden-border)] rounded-2xl shadow-2xl flex flex-col overflow-hidden"
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

          <!-- Mode Selector -->
          <div class="flex gap-1 p-1 bg-black/40 rounded-lg border border-white/5">
            <button (click)="setMode('yolo')" 
                    [ngClass]="pipeline.mode() === 'yolo' ? 'bg-red-500/20 text-red-300 border-red-500/50' : 'text-gray-500 border-transparent hover:text-gray-300'"
                    class="flex-1 py-1 rounded-md font-mono text-[10px] font-bold border transition-all cursor-pointer">
              🔥 YOLO
            </button>
            <button (click)="setMode('eden')" 
                    [ngClass]="pipeline.mode() === 'eden' ? 'bg-purple-500/20 text-purple-300 border-purple-500/50' : 'text-gray-500 border-transparent hover:text-gray-300'"
                    class="flex-1 py-1 rounded-md font-mono text-[10px] font-bold border transition-all cursor-pointer">
              ⚡ EDEN
            </button>
            <button (click)="setMode('plan')" 
                    [ngClass]="pipeline.mode() === 'plan' ? 'bg-yellow-500/20 text-yellow-300 border-yellow-500/50' : 'text-gray-500 border-transparent hover:text-gray-300'"
                    class="flex-1 py-1 rounded-md font-mono text-[10px] font-bold border transition-all cursor-pointer">
              📋 PLAN
            </button>
            <button (click)="setMode('raw')" 
                    [ngClass]="pipeline.mode() === 'raw' ? 'bg-gray-500/20 text-gray-300 border-gray-500/50' : 'text-gray-500 border-transparent hover:text-gray-300'"
                    class="flex-1 py-1 rounded-md font-mono text-[10px] font-bold border transition-all cursor-pointer">
              ⚙️ RAW
            </button>
          </div>

          <!-- Input -->
          <div class="flex flex-col gap-2">
            <span class="text-xs font-mono text-gray-400 uppercase tracking-wider">Command Arguments / Prompt</span>
            <textarea #cliInput rows="3" 
                      class="w-full bg-black/50 border border-white/10 rounded-lg p-3 text-white font-mono text-sm focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/50 transition-all resize-none"
                      placeholder="e.g. --version or 'Create a login node connected to a database'"
                      (keydown.ctrl.enter)="runCli(cliInput.value)"
            ></textarea>
          </div>

          <!-- Run Button -->
          <button *ngIf="!pipeline.isAgenticLoopActive()"
                  (click)="runCli(cliInput.value)"
                  [disabled]="pipeline.isExecuting()"
                  class="w-full py-2.5 rounded-lg font-mono text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer"
                  [ngClass]="pipeline.isExecuting() ? 'bg-gray-800 text-gray-500 cursor-not-allowed' : 'bg-purple-600 hover:bg-purple-500 text-white shadow-[0_0_15px_rgba(168,85,247,0.4)]'">
            <mat-icon *ngIf="!pipeline.isExecuting()" style="font-size: 18px; width: 18px; height: 18px;">play_arrow</mat-icon>
            <mat-icon *ngIf="pipeline.isExecuting()" class="animate-spin" style="font-size: 18px; width: 18px; height: 18px;">autorenew</mat-icon>
            {{ pipeline.isExecuting() ? 'EXECUTING...' : 'EXECUTE CLI' }}
          </button>
        </div>

        <!-- AGENTIC LOOP TRACKER -->
        <div *ngIf="pipeline.isAgenticLoopActive()" class="px-4 pb-4">
          <div class="border border-red-500/30 bg-red-950/30 rounded-lg p-3 shadow-[0_0_20px_rgba(239,68,68,0.2)] flex flex-col gap-3">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2 text-red-400 font-bold font-mono text-xs uppercase animate-pulse">
                <mat-icon style="font-size: 16px; width: 16px; height: 16px;">smart_toy</mat-icon>
                AGENTIC LOOP ACTIVE
              </div>
              <span class="text-[10px] text-red-500/80 font-mono font-bold bg-red-500/10 px-2 py-0.5 rounded-full">
                ITERATION {{ pipeline.agenticIteration() }} / {{ pipeline.maxAgenticIterations() }}
              </span>
            </div>
            
            <div class="text-[10px] font-mono text-gray-300 break-words">
              <span class="text-gray-500">OBJECTIVE:</span><br/>
              {{ pipeline.currentObjective() }}
            </div>

            <!-- Agent Reasoning (Monologue) -->
            <div *ngIf="pipeline.currentReasoning()" 
                 class="bg-blue-500/5 border border-blue-500/20 rounded p-2 flex flex-col gap-1.5 animate-in fade-in slide-in-from-top-1 duration-500">
              <div class="flex items-center gap-1.5 text-[9px] font-bold text-blue-400 uppercase tracking-tighter">
                <mat-icon style="font-size: 10px; width: 10px; height: 10px;">psychology</mat-icon>
                AI Reasoning
              </div>
              <div class="text-[10px] italic font-mono text-blue-100/80 leading-relaxed border-l-2 border-blue-500/30 pl-2">
                {{ pipeline.currentReasoning() }}
              </div>
            </div>

            <button (click)="pipeline.abortAgenticLoop()"
                    class="w-full py-2 text-[10px] font-mono font-bold text-white bg-red-600/80 hover:bg-red-500 rounded flex items-center justify-center gap-2 border border-red-500 transition-colors shadow-[0_0_10px_rgba(239,68,68,0.5)]">
              <mat-icon style="font-size: 14px; width: 14px; height: 14px;">stop_circle</mat-icon>
              ABORT AUTONOMOUS EVALUATOR
            </button>
          </div>
        </div>

        <!-- Output -->
        <div *ngIf="lastOutput() || lastError()" class="p-4 border-t border-[var(--color-eden-border)] bg-black/60 max-h-64 overflow-y-auto flex flex-col">
          <span class="text-xs font-mono text-gray-500 uppercase tracking-wider mb-2 block">Output</span>
          <pre *ngIf="lastOutput()" class="text-xs font-mono text-green-400 whitespace-pre-wrap break-words">{{ lastOutput() }}</pre>
          <pre *ngIf="lastError()" class="text-xs font-mono text-red-400 whitespace-pre-wrap break-words mt-2">{{ lastError() }}</pre>
          
          <button *ngIf="pipeline.mode() === 'raw'" (click)="injectAsNode()" class="mt-4 w-full py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs font-mono text-gray-300 flex items-center justify-center gap-2 transition-colors cursor-pointer">
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
  public pipeline = inject(EdenAiPipelineService);

  selectedEngine = signal<'qwen' | 'gemini'>('qwen');
  lastOutput = signal<string>('');
  lastError = signal<string>('');

  setMode(mode: AiMode) {
    this.pipeline.mode.set(mode);
  }

  async runCli(args: string) {
    this.lastOutput.set('');
    this.lastError.set('');
    
    const engine = this.selectedEngine();
    const mode = this.pipeline.mode();

    let result;
    if (mode === 'raw' || args.startsWith('-')) {
      result = await this.pipeline.executeRaw(engine, args);
    } else {
      result = await this.pipeline.execute(engine, args);
    }

    if (result.stdout) this.lastOutput.set(result.stdout);
    if (result.stderr || result.error) this.lastError.set(result.stderr || result.error);
  }

  injectAsNode() {
    const out = this.lastOutput() || this.lastError();
    if (out) {
      this.pipeline.createFallbackNode(this.selectedEngine(), out);
    }
  }
}
