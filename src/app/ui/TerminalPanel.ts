import { Component, inject, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { TerminalService } from '../core/TerminalService';
import { MatIconModule } from '@angular/material/icon';
import { DatePipe, NgClass, NgIf } from '@angular/common';
import { AppUiService } from '../core/AppUiService';
import { CliUiService } from '../core/CliUiService';
import { EdenAiPipelineService } from '../core/EdenAiPipelineService';

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
            <span class="text-gray-300 whitespace-pre-wrap break-words font-mono"
                  [ngClass]="{'text-red-300 font-bold': log.message.startsWith('[AGENT]')}">
              {{ log.message }}
            </span>
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
          [disabled]="pipeline.isExecuting()"
        />
        <mat-icon *ngIf="pipeline.isExecuting()" class="text-[var(--color-eden-neon)] animate-spin" style="font-size: 14px; width: 14px; height: 14px;">autorenew</mat-icon>
      </div>
    </div>
  `
})
export class TerminalPanel implements AfterViewChecked {
  public terminal = inject(TerminalService);
  public ui = inject(AppUiService);
  public cliUi = inject(CliUiService);
  public pipeline = inject(EdenAiPipelineService);

  @ViewChild('scrollContainer') private scrollContainer!: ElementRef;

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
    } else {
      this.terminal.log(`Command not found: ${trimmed}. Try /qwen <cmd>, /gemini <cmd>, or /agent <qwen|gemini> <objective>`, 'ERROR');
      return;
    }

    if (isAgentic) {
      if (!args) {
        this.terminal.log(`Provide an objective. Usage: /agent ${engineName} <objective>`, 'ERROR');
        return;
      }
      this.cliUi.isOpen.set(true); // Open CLI Panel to show the Agentic Tracker
      await this.pipeline.executeAgenticLoop(engineName, args);
    } else {
      if (args.startsWith('-')) {
        await this.pipeline.executeRaw(engineName, args);
      } else {
        await this.pipeline.execute(engineName, args);
      }
    }
  }
}
