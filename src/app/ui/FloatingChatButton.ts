import { Component, inject, computed, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { CliUiService } from '../core/CliUiService';
import { EdenAiPipelineService } from '../core/EdenAiPipelineService';
import { AppUiService } from '../core/AppUiService';
import { AI_PROVIDERS } from '../types/provider';

@Component({
  selector: 'eden-floating-chat-button',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  template: `
    <div id="eden-floating-chat-container"
         class="fixed right-5 z-40 transition-all duration-300 pointer-events-auto"
         [style.bottom]="appUi.isTerminalOpen() ? '312px' : '16px'">
      
      <button id="eden-dedicated-chat-icon"
              type="button"
              (click)="cliUi.toggle()"
              [title]="cliUi.isOpen() ? 'Fermer le Copilote IA (Échap)' : 'Ouvrir le Copilote IA EDEN (Ctrl+K)'"
              class="relative flex items-center gap-2.5 px-3.5 py-2 rounded-2xl border transition-all duration-300 shadow-2xl cursor-pointer select-none group"
              [ngClass]="cliUi.isOpen() 
                ? 'bg-emerald-500/20 border-emerald-500/60 text-emerald-300 shadow-[0_0_25px_rgba(16,185,129,0.35)] ring-1 ring-emerald-500/30' 
                : 'bg-[#0c0d12]/95 hover:bg-[#151822] border-white/15 hover:border-emerald-500/40 text-white shadow-[0_8px_32px_rgba(0,0,0,0.7)] hover:shadow-[0_0_20px_rgba(16,185,129,0.25)]'">
        
        <!-- Dedicated AI Avatar / Icon -->
        <div class="relative flex items-center justify-center shrink-0">
          <div class="w-8 h-8 rounded-xl flex items-center justify-center transition-transform duration-300 group-hover:scale-105"
               [style.background-color]="currentProviderConfig().accentColor"
               [style.color]="currentProviderConfig().color">
            <mat-icon style="font-size: 19px; width: 19px; height: 19px;">psychology</mat-icon>
          </div>
          
          <!-- Live execution pulse / status badge -->
          @if (pipeline.isExecuting()) {
            <span class="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-cyan-400 animate-ping"></span>
            <span class="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-cyan-400 border-2 border-black"></span>
          } @else {
            <span class="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-black"></span>
          }
        </div>

        <!-- Label & Active Provider Pill -->
        <div class="flex flex-col text-left font-mono">
          <div class="flex items-center gap-1.5 leading-none">
            <span class="text-xs font-bold tracking-wide text-zinc-100">AI Copilot</span>
            <span class="text-[9px] px-1.5 py-0.5 rounded-full border uppercase font-semibold transition-colors"
                  [style.border-color]="currentProviderConfig().color + '60'"
                  [style.color]="currentProviderConfig().color"
                  [style.background-color]="currentProviderConfig().color + '15'">
              {{ currentProviderConfig().brand }}
            </span>
          </div>
          <span class="text-[10px] text-zinc-400 group-hover:text-zinc-300 transition-colors mt-0.5">
            {{ cliUi.isOpen() ? 'Active • Click to close' : 'Chat & Synthesize' }}
          </span>
        </div>

        <!-- Shortcut key badge -->
        <div class="hidden sm:flex items-center px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-[9px] font-mono text-zinc-400 font-semibold group-hover:text-zinc-200 transition-colors">
          Ctrl K
        </div>

        <!-- Toggle indicator -->
        <div class="w-5 h-5 rounded-md flex items-center justify-center text-zinc-400 group-hover:text-white transition-colors ml-0.5">
          <mat-icon style="font-size: 16px; width: 16px; height: 16px;">
            {{ cliUi.isOpen() ? 'close' : 'chat_bubble' }}
          </mat-icon>
        </div>

      </button>
    </div>
  `
})
export class FloatingChatButton {
  public cliUi = inject(CliUiService);
  public pipeline = inject(EdenAiPipelineService);
  public appUi = inject(AppUiService);

  currentProviderConfig = computed(() => {
    return AI_PROVIDERS[this.pipeline.activeProvider()] || AI_PROVIDERS.nvidia;
  });

  @HostListener('window:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent) {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      this.cliUi.toggle();
    }
  }
}
