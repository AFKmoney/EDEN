import { Component, inject, signal, effect } from '@angular/core';
import { CompilerService } from '../core/CompilerService';
import { MatIconModule } from '@angular/material/icon';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { AppUiService } from '../core/AppUiService';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { NgIf } from '@angular/common';
import { WindowResizer } from '../core/WindowResizer';

@Component({
  selector: 'eden-code-preview',
  standalone: true,
  imports: [MatIconModule, DragDropModule, NgIf],
  template: `
    <!-- Floating Window -->
    <div *ngIf="ui.isCodePreviewOpen()" class="fixed inset-0 z-50 pointer-events-none flex items-center justify-center p-2 sm:p-4">
      <div cdkDrag cdkDragBoundary="body" 
           [style.width.px]="resizer.width()"
           [style.height.px]="resizer.height()"
           [style.max-width]="resizer.isMaximized() ? '99vw' : '96vw'"
           [style.max-height]="resizer.isMaximized() ? '98vh' : '94vh'"
           class="relative pointer-events-auto bg-[var(--color-eden-bg)] border border-[var(--color-eden-border)] rounded-2xl shadow-2xl flex flex-col overflow-hidden select-text">

        <!-- Header -->
        <div cdkDragHandle class="flex items-center justify-between p-4 border-b border-[var(--color-eden-border)] bg-[var(--color-eden-surface)] cursor-move select-none shrink-0">
          <div class="flex items-center gap-3 text-[var(--color-eden-neon)]">
            <mat-icon class="animate-pulse">terminal</mat-icon>
            <h2 class="font-mono font-bold tracking-widest uppercase text-lg">Nexus Compiler</h2>
          </div>
          <div class="flex items-center gap-2">
            <button (click)="compileAndOpen()" class="flex items-center gap-2 px-4 py-2 bg-[var(--color-eden-neon)]/20 text-[var(--color-eden-neon)] rounded-lg hover:bg-[var(--color-eden-neon)] hover:text-white transition-colors font-mono text-sm font-bold cursor-pointer">
              <mat-icon style="font-size: 18px; width: 18px; height: 18px;">refresh</mat-icon> RECOMPILE
            </button>
            <!-- Maximize / Restore -->
            <button (click)="resizer.toggleMaximize()"
                    [title]="resizer.isMaximized() ? 'Restore size' : 'Maximize window'"
                    class="text-gray-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-white/10 cursor-pointer">
              <mat-icon style="font-size: 18px; width: 18px; height: 18px;">{{ resizer.isMaximized() ? 'filter_none' : 'crop_square' }}</mat-icon>
            </button>
            <button (click)="ui.toggleCodePreview()" class="text-gray-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-white/10 cursor-pointer">
              <mat-icon>close</mat-icon>
            </button>
          </div>
        </div>

        <!-- Tabs -->
        <div class="flex border-b border-[var(--color-eden-border)] bg-black/20 shrink-0">
          <button class="flex-1 py-3 text-sm font-mono font-bold transition-colors border-b-2 cursor-pointer"
                  [class.text-[var(--color-eden-neon)]]="activeTab() === 'preview'"
                  [class.text-gray-500]="activeTab() !== 'preview'"
                  [style.border-color]="activeTab() === 'preview' ? 'var(--color-eden-neon)' : 'transparent'"
                  (click)="activeTab.set('preview')">
            LIVE PREVIEW
          </button>
          <button class="flex-1 py-3 text-sm font-mono font-bold transition-colors border-b-2 cursor-pointer"
                  [class.text-[var(--color-eden-neon)]]="activeTab() === 'code'"
                  [class.text-gray-500]="activeTab() !== 'code'"
                  [style.border-color]="activeTab() === 'code' ? 'var(--color-eden-neon)' : 'transparent'"
                  (click)="activeTab.set('code')">
            SOURCE CODE
          </button>
        </div>

        <!-- Content -->
        <div class="flex-1 overflow-hidden relative bg-black">
          @if (activeTab() === 'code') {
            <textarea readonly class="w-full h-full bg-transparent text-emerald-400 font-mono text-sm p-6 outline-none resize-none whitespace-pre overflow-auto leading-relaxed">
{{ generatedCode() }}
            </textarea>
          } @else {
            <iframe [srcdoc]="safePreview()" class="w-full h-full border-none bg-white"></iframe>
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
export class CodePreviewPanel {
  private compiler = inject(CompilerService);
  private sanitizer = inject(DomSanitizer);
  public ui = inject(AppUiService);

  public resizer = new WindowResizer({
    storageKey: 'code_preview',
    defaultWidth: 840,
    defaultHeight: 620,
    minWidth: 480,
    minHeight: 360
  });

  activeTab = signal<'code' | 'preview'>('preview');
  generatedCode = signal('');
  safePreview = signal<SafeHtml>('');

  constructor() {
    effect(() => {
      if (this.ui.isCodePreviewOpen()) {
        this.compile();
      }
    });
  }

  compile() {
    const code = this.compiler.compile();
    this.generatedCode.set(code);
    this.safePreview.set(this.sanitizer.bypassSecurityTrustHtml(code));
  }

  compileAndOpen() {
    this.compile();
    if (!this.ui.isCodePreviewOpen()) {
      this.ui.toggleCodePreview();
    }
  }
}
