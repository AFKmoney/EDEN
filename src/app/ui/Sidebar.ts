import { Component, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { NgClass } from '@angular/common';
import { CoreEngine } from '../core/CoreEngine';
import { CliUiService } from '../core/CliUiService';
import { AppUiService } from '../core/AppUiService';

@Component({
  selector: 'eden-sidebar',
  standalone: true,
  imports: [MatIconModule, NgClass],
  template: `
    <div class="fixed left-0 top-0 h-full w-16 hover:w-64 bg-[var(--color-eden-surface)] backdrop-blur-2xl border-r border-[var(--color-eden-border)] z-[100] transition-all duration-300 flex flex-col overflow-hidden group shadow-[0_0_50px_rgba(0,0,0,0.5)]">
      
      <!-- App Logo / Header -->
      <div class="flex items-center h-16 px-4 border-b border-[var(--color-eden-border)] shrink-0">
        <mat-icon class="text-[var(--color-eden-neon)] animate-pulse shrink-0">blur_on</mat-icon>
        <span class="ml-4 font-black tracking-widest text-[var(--color-eden-neon)] opacity-0 group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap">EDEN.OS</span>
      </div>

      <!-- Scrollable Content -->
      <div class="flex-1 overflow-y-auto overflow-x-hidden py-4 flex flex-col gap-6 custom-scrollbar">
        
        <!-- MICRO APPS SECTION -->
        <div class="flex flex-col gap-1 px-2">
          <div class="px-2 text-[10px] font-mono text-gray-500 uppercase tracking-widest mb-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap">Micro Apps</div>
          
          <!-- CLI Framework -->
          <button (click)="cliUi.toggle()"
                  class="flex items-center h-10 px-2 rounded-xl transition-all cursor-pointer border border-transparent whitespace-nowrap"
                  [ngClass]="cliUi.isOpen() ? 'bg-purple-500/20 text-purple-400 border-purple-500/50 shadow-[0_0_15px_rgba(168,85,247,0.5)]' : 'text-gray-400 hover:text-white hover:bg-white/5'">
            <mat-icon class="shrink-0">terminal</mat-icon>
            <span class="ml-4 font-mono text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity duration-300">CLI Framework</span>
          </button>

          <!-- Package Manager -->
          <button (click)="appUi.togglePackageManager()"
                  class="flex items-center h-10 px-2 rounded-xl transition-all cursor-pointer border border-transparent whitespace-nowrap"
                  [ngClass]="appUi.isPackageManagerOpen() ? 'bg-blue-500/20 text-blue-400 border-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.5)]' : 'text-gray-400 hover:text-white hover:bg-white/5'">
            <mat-icon class="shrink-0">extension</mat-icon>
            <span class="ml-4 font-mono text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity duration-300">Package Manager</span>
          </button>

          <!-- Code Preview / Compiler -->
          <button (click)="appUi.toggleCodePreview()"
                  class="flex items-center h-10 px-2 rounded-xl transition-all cursor-pointer border border-transparent whitespace-nowrap"
                  [ngClass]="appUi.isCodePreviewOpen() ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.5)]' : 'text-gray-400 hover:text-white hover:bg-white/5'">
            <mat-icon class="shrink-0">code</mat-icon>
            <span class="ml-4 font-mono text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity duration-300">Nexus Compiler</span>
          </button>

          <!-- Terminal -->
          <button (click)="appUi.toggleTerminal()"
                  class="flex items-center h-10 px-2 rounded-xl transition-all cursor-pointer border border-transparent whitespace-nowrap"
                  [ngClass]="appUi.isTerminalOpen() ? 'bg-orange-500/20 text-orange-400 border-orange-500/50 shadow-[0_0_15px_rgba(249,115,22,0.5)]' : 'text-gray-400 hover:text-white hover:bg-white/5'">
            <mat-icon class="shrink-0">dvr</mat-icon>
            <span class="ml-4 font-mono text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity duration-300">System Terminal</span>
          </button>

          <!-- File Explorer -->
          <button (click)="appUi.toggleFileExplorer()"
                  class="flex items-center h-10 px-2 rounded-xl transition-all cursor-pointer border border-transparent whitespace-nowrap"
                  [ngClass]="appUi.isFileExplorerOpen() ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50 shadow-[0_0_15px_rgba(234,179,8,0.5)]' : 'text-gray-400 hover:text-white hover:bg-white/5'">
            <mat-icon class="shrink-0">folder_special</mat-icon>
            <span class="ml-4 font-mono text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity duration-300">File Explorer</span>
          </button>

          <!-- Ternary VM -->
          <button (click)="engine.toggleVM()"
                  class="flex items-center h-10 px-2 rounded-xl transition-all cursor-pointer border border-transparent whitespace-nowrap"
                  [ngClass]="engine.isVmRunning() ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/50 shadow-[0_0_15px_rgba(6,182,212,0.5)]' : 'text-gray-400 hover:text-white hover:bg-white/5'">
            <mat-icon class="shrink-0">{{ engine.isVmRunning() ? 'stop' : 'play_arrow' }}</mat-icon>
            <span class="ml-4 font-mono text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity duration-300">Ternary VM</span>
          </button>
        </div>

        <div class="h-px bg-[var(--color-eden-border)] mx-4"></div>

        <!-- GRAPH OPERATIONS SECTION -->
        <div class="flex flex-col gap-1 px-2">
          <div class="px-2 text-[10px] font-mono text-gray-500 uppercase tracking-widest mb-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap">Graph Operations</div>
          
          <!-- Undo -->
          <button (click)="engine.undo()" [disabled]="!engine.canUndo()"
                  class="flex items-center h-10 px-2 rounded-xl transition-all cursor-pointer border border-transparent whitespace-nowrap"
                  [ngClass]="engine.canUndo() ? 'text-gray-400 hover:text-white hover:bg-white/5' : 'text-gray-700 cursor-not-allowed'">
            <mat-icon class="shrink-0">undo</mat-icon>
            <span class="ml-4 font-mono text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity duration-300">Undo Action</span>
          </button>

          <!-- Redo -->
          <button (click)="engine.redo()" [disabled]="!engine.canRedo()"
                  class="flex items-center h-10 px-2 rounded-xl transition-all cursor-pointer border border-transparent whitespace-nowrap"
                  [ngClass]="engine.canRedo() ? 'text-gray-400 hover:text-white hover:bg-white/5' : 'text-gray-700 cursor-not-allowed'">
            <mat-icon class="shrink-0">redo</mat-icon>
            <span class="ml-4 font-mono text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity duration-300">Redo Action</span>
          </button>

          <!-- Save -->
          <button (click)="engine.saveToLocalStorage()"
                  class="flex items-center h-10 px-2 rounded-xl transition-all cursor-pointer border border-transparent whitespace-nowrap text-gray-400 hover:text-blue-400 hover:bg-blue-500/10">
            <mat-icon class="shrink-0">save</mat-icon>
            <span class="ml-4 font-mono text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity duration-300">Save Genome</span>
          </button>

          <!-- Load -->
          <button (click)="engine.loadFromLocalStorage()"
                  class="flex items-center h-10 px-2 rounded-xl transition-all cursor-pointer border border-transparent whitespace-nowrap text-gray-400 hover:text-yellow-400 hover:bg-yellow-500/10">
            <mat-icon class="shrink-0">folder_open</mat-icon>
            <span class="ml-4 font-mono text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity duration-300">Load Genome</span>
          </button>

          <!-- Clear -->
          <button (click)="engine.clear()"
                  class="flex items-center h-10 px-2 rounded-xl transition-all cursor-pointer border border-transparent whitespace-nowrap text-gray-400 hover:text-red-400 hover:bg-red-500/10">
            <mat-icon class="shrink-0">delete_sweep</mat-icon>
            <span class="ml-4 font-mono text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity duration-300">Clear Canvas</span>
          </button>
        </div>

      </div>
    </div>
  `,
  styles: [`
    .custom-scrollbar::-webkit-scrollbar {
      width: 4px;
    }
    .custom-scrollbar::-webkit-scrollbar-track {
      background: transparent;
    }
    .custom-scrollbar::-webkit-scrollbar-thumb {
      background: var(--color-eden-border);
      border-radius: 4px;
    }
    .custom-scrollbar:hover::-webkit-scrollbar-thumb {
      background: #4b5563;
    }
  `]
})
export class Sidebar {
  public engine = inject(CoreEngine);
  public cliUi = inject(CliUiService);
  public appUi = inject(AppUiService);
}
