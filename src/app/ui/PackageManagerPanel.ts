import { Component, inject, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { NgClass, NgIf } from '@angular/common';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { TerminalService } from '../core/TerminalService';
import { AppUiService } from '../core/AppUiService';
import { WindowResizer } from '../core/WindowResizer';

@Component({
  selector: 'eden-package-manager',
  standalone: true,
  imports: [MatIconModule, NgIf, DragDropModule],
  template: `
    <!-- Overlay Panel -->
    <div *ngIf="ui.isPackageManagerOpen()" class="fixed inset-0 z-[60] pointer-events-none flex items-center justify-center p-2 sm:p-4">
      
      <div cdkDrag cdkDragBoundary="body" 
           [style.width.px]="resizer.width()"
           [style.height.px]="resizer.height()"
           [style.max-width]="resizer.isMaximized() ? '99vw' : '96vw'"
           [style.max-height]="resizer.isMaximized() ? '98vh' : '94vh'"
           class="relative pointer-events-auto bg-[var(--color-eden-surface)] backdrop-blur-2xl border border-[var(--color-eden-border)] rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col select-text">
        
        <!-- Header -->
        <div cdkDragHandle class="flex items-center justify-between px-4 py-3 border-b border-[var(--color-eden-border)] bg-black/20 cursor-move select-none shrink-0">
          <div class="flex items-center gap-2 text-[var(--color-eden-neon)] font-mono text-sm font-bold">
            <mat-icon style="font-size: 18px; width: 18px; height: 18px;">extension</mat-icon>
            <span>NPM_PACKAGE_MANAGER</span>
          </div>
          <div class="flex items-center gap-1.5">
            <!-- Maximize / Restore -->
            <button (click)="resizer.toggleMaximize()"
                    [title]="resizer.isMaximized() ? 'Restore size' : 'Maximize window'"
                    class="text-gray-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/10 cursor-pointer">
              <mat-icon style="font-size: 18px; width: 18px; height: 18px;">{{ resizer.isMaximized() ? 'filter_none' : 'crop_square' }}</mat-icon>
            </button>
            <button (click)="ui.togglePackageManager()" class="text-gray-500 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/10 cursor-pointer">
              <mat-icon style="font-size: 18px; width: 18px; height: 18px;">close</mat-icon>
            </button>
          </div>
        </div>

        <!-- Content -->
        <div class="p-4 flex-1 flex flex-col gap-4 overflow-y-auto">
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
              class="px-4 py-2 bg-[var(--color-eden-neon)]/20 text-[var(--color-eden-neon)] border border-[var(--color-eden-neon)]/50 rounded-lg hover:bg-[var(--color-eden-neon)] hover:text-white transition-colors font-mono text-sm font-bold flex items-center gap-2 cursor-pointer">
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

        <!-- Window Resize Handles -->
        @if (!resizer.isMaximized()) {
          <div (pointerdown)="resizer.onResizeStart($event, 'right')"
               class="absolute top-0 right-0 w-2 h-full cursor-ew-resize hover:bg-[var(--color-eden-neon)]/30 transition-colors z-20"
               title="Resize width"></div>
          <div (pointerdown)="resizer.onResizeStart($event, 'bottom')"
               class="absolute bottom-0 left-0 h-2 w-full cursor-ns-resize hover:bg-[var(--color-eden-neon)]/30 transition-colors z-20"
               title="Resize height"></div>
          <div (pointerdown)="resizer.onResizeStart($event, 'corner')"
               class="absolute bottom-0 right-0 w-6 h-6 cursor-nwse-resize flex items-end justify-end p-1 text-zinc-500 hover:text-[var(--color-eden-neon)] select-none z-30 transition-colors"
               title="Drag to resize window">
            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M22 22H20V20H22V22ZM22 18H20V16H22V18ZM18 22H16V20H18V22ZM22 14H20V12H22V14ZM18 18H16V16H18V18ZM14 22H12V20H14V22Z"/>
            </svg>
          </div>
        }
      </div>
    </div>
  `
})
export class PackageManagerPanel {
  private terminal = inject(TerminalService);
  public ui = inject(AppUiService);
  
  public resizer = new WindowResizer({
    storageKey: 'package_manager',
    defaultWidth: 640,
    defaultHeight: 380,
    minWidth: 420,
    minHeight: 260
  });

  lastRequestedPkg = signal<string | null>(null);

  installPackage(pkgName: string) {
    const trimmed = pkgName.trim();
    if (!trimmed) return;
    
    this.lastRequestedPkg.set(trimmed);
    this.terminal.log('Package installation requested: ' + trimmed, 'SYSTEM');
    this.terminal.log('Please ask the AI Assistant to run: npm install ' + trimmed, 'INFO');
  }
}
