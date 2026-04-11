import { Component, inject, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { NgClass, NgIf } from '@angular/common';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { TerminalService } from '../core/TerminalService';
import { AppUiService } from '../core/AppUiService';

@Component({
  selector: 'eden-package-manager',
  standalone: true,
  imports: [MatIconModule, NgIf, DragDropModule],
  template: `
    <!-- Overlay Panel -->
    <div *ngIf="ui.isPackageManagerOpen()" class="fixed inset-0 z-[60] pointer-events-none flex items-center justify-center">
      
      <div cdkDrag class="pointer-events-auto w-full max-w-2xl bg-[var(--color-eden-surface)] backdrop-blur-2xl border border-[var(--color-eden-border)] rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col">
        
        <!-- Header -->
        <div cdkDragHandle class="flex items-center justify-between px-4 py-3 border-b border-[var(--color-eden-border)] bg-black/20 cursor-move">
          <div class="flex items-center gap-2 text-[var(--color-eden-neon)] font-mono text-sm font-bold">
            <mat-icon style="font-size: 18px; width: 18px; height: 18px;">extension</mat-icon>
            <span>NPM_PACKAGE_MANAGER</span>
          </div>
          <button (click)="ui.togglePackageManager()" class="text-gray-500 hover:text-white transition-colors">
            <mat-icon style="font-size: 18px; width: 18px; height: 18px;">close</mat-icon>
          </button>
        </div>

        <!-- Content -->
        <div class="p-4 flex flex-col gap-4">
          <div class="text-xs text-gray-400 font-mono">
            Install NPM packages into the EDEN environment.
          </div>

          <div class="flex items-center gap-2">
            <div class="flex-1 bg-black/40 border border-[var(--color-eden-border)] rounded-lg px-3 py-2 flex items-center gap-2 focus-within:border-[var(--color-eden-neon)] transition-colors">
              <span class="text-gray-500 font-mono text-sm">npm install</span>
              <input 
                #pkgInput
                type="text" 
                placeholder="package-name" 
                class="flex-1 bg-transparent border-none outline-none text-white font-mono text-sm"
                (keydown.enter)="installPackage(pkgInput.value); pkgInput.value = ''"
              />
            </div>
            <button 
              (click)="installPackage(pkgInput.value); pkgInput.value = ''"
              class="px-4 py-2 bg-[var(--color-eden-neon)]/20 text-[var(--color-eden-neon)] border border-[var(--color-eden-neon)]/50 rounded-lg hover:bg-[var(--color-eden-neon)] hover:text-white transition-colors font-mono text-sm font-bold flex items-center gap-2">
              <mat-icon style="font-size: 16px; width: 16px; height: 16px;">download</mat-icon>
              INSTALL
            </button>
          </div>

          <!-- Status / Instructions -->
          @if (lastRequestedPkg()) {
            <div class="mt-2 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg flex gap-3 items-start">
              <mat-icon class="text-blue-400 shrink-0">info</mat-icon>
              <div class="text-sm text-blue-200 font-mono">
                To permanently install <span class="font-bold text-white">{{ lastRequestedPkg() }}</span>, please instruct the AI Assistant in the external chat: <br/>
                <span class="text-[var(--color-eden-neon)] mt-1 inline-block">"Install {{ lastRequestedPkg() }}"</span>
              </div>
            </div>
          }
        </div>
      </div>
    </div>
  `
})
export class PackageManagerPanel {
  private terminal = inject(TerminalService);
  public ui = inject(AppUiService);
  
  lastRequestedPkg = signal<string | null>(null);

  installPackage(pkgName: string) {
    const trimmed = pkgName.trim();
    if (!trimmed) return;
    
    this.lastRequestedPkg.set(trimmed);
    this.terminal.log('Package installation requested: ' + trimmed, 'SYSTEM');
    this.terminal.log('Please ask the AI Assistant to run: npm install ' + trimmed, 'INFO');
  }
}
