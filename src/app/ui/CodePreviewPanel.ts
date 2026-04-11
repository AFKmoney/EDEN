import { Component, inject, signal } from '@angular/core';
import { CompilerService } from '../core/CompilerService';
import { MatIconModule } from '@angular/material/icon';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { AppUiService } from '../core/AppUiService';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { NgIf } from '@angular/common';

@Component({
  selector: 'eden-code-preview',
  standalone: true,
  imports: [MatIconModule, DragDropModule, NgIf],
  template: `
    <!-- Floating Window -->
    <div *ngIf="ui.isCodePreviewOpen()" class="fixed inset-0 z-50 pointer-events-none flex items-center justify-center">
      <div cdkDrag class="pointer-events-auto w-[800px] h-[600px] max-w-[90vw] max-h-[90vh] bg-[var(--color-eden-bg)] border border-[var(--color-eden-border)] rounded-2xl shadow-2xl flex flex-col overflow-hidden">

        <!-- Header -->
        <div cdkDragHandle class="flex items-center justify-between p-4 border-b border-[var(--color-eden-border)] bg-[var(--color-eden-surface)] cursor-move">
          <div class="flex items-center gap-3 text-[var(--color-eden-neon)]">
            <mat-icon class="animate-pulse">terminal</mat-icon>
            <h2 class="font-mono font-bold tracking-widest uppercase text-lg">Nexus Compiler</h2>
          </div>
          <div class="flex items-center gap-2">
            <button (click)="compileAndOpen()" class="flex items-center gap-2 px-4 py-2 bg-[var(--color-eden-neon)]/20 text-[var(--color-eden-neon)] rounded-lg hover:bg-[var(--color-eden-neon)] hover:text-white transition-colors font-mono text-sm font-bold">
              <mat-icon style="font-size: 18px; width: 18px; height: 18px;">refresh</mat-icon> RECOMPILE
            </button>
            <button (click)="ui.toggleCodePreview()" class="text-gray-400 hover:text-white transition-colors p-2">
              <mat-icon>close</mat-icon>
            </button>
          </div>
        </div>

        <!-- Tabs -->
        <div class="flex border-b border-[var(--color-eden-border)] bg-black/20">
          <button class="flex-1 py-3 text-sm font-mono font-bold transition-colors border-b-2"
                  [class.text-[var(--color-eden-neon)]]="activeTab() === 'preview'"
                  [class.text-gray-500]="activeTab() !== 'preview'"
                  [style.border-color]="activeTab() === 'preview' ? 'var(--color-eden-neon)' : 'transparent'"
                  (click)="activeTab.set('preview')">
            LIVE PREVIEW
          </button>
          <button class="flex-1 py-3 text-sm font-mono font-bold transition-colors border-b-2"
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
      </div>
    </div>
  `
})
export class CodePreviewPanel {
  private compiler = inject(CompilerService);
  private sanitizer = inject(DomSanitizer);
  public ui = inject(AppUiService);

  activeTab = signal<'code' | 'preview'>('preview');
  generatedCode = signal('');
  safePreview = signal<SafeHtml>('');

  compileAndOpen() {
    const code = this.compiler.compile();
    this.generatedCode.set(code);
    this.safePreview.set(this.sanitizer.bypassSecurityTrustHtml(code));
    if (!this.ui.isCodePreviewOpen()) {
      this.ui.toggleCodePreview();
    }
  }
}
