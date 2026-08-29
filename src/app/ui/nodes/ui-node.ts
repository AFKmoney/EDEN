import { Component, input, inject, signal, OnInit } from '@angular/core';
import { EdenNode } from '../../types/node';
import { CoreEngine } from '../../core/CoreEngine';
import { NgClass } from '@angular/common';

@Component({
  selector: 'eden-ui-node',
  standalone: true,
  imports: [NgClass],
  template: `
    <div class="bg-[var(--color-eden-surface)] border border-[var(--color-eden-border)] rounded-xl p-4 backdrop-blur-xl min-w-[220px] shadow-lg transition-all hover:border-emerald-500 hover:shadow-[0_0_20px_rgba(16,185,129,0.3)] flex flex-col gap-2">
      
      <!-- Header with type indicator -->
      <div class="flex items-center justify-between">
        <div class="text-[10px] font-mono text-emerald-400 tracking-widest uppercase opacity-80">UI_Cell</div>
        <div class="flex gap-1">
          @if (hasContent()) {
            <span class="text-[8px] bg-emerald-500/20 text-emerald-400 px-1 rounded">html</span>
          }
        </div>
      </div>
      
      <!-- Editable Title -->
      <input 
        [value]="node().metadata.title || node().id"
        (mousedown)="$event.stopPropagation()"
        (change)="updateTitle($event)"
        class="bg-transparent border-none outline-none text-white font-semibold tracking-tight w-full placeholder-gray-500"
        placeholder="Untitled UI Node"
      />
      
      <!-- Content Area -->
      <textarea
        [value]="node().metadata.content || ''"
        (mousedown)="$event.stopPropagation()"
        (change)="updateContent($event)"
        placeholder="Enter HTML, UI component, or visual element..."
        class="bg-black/30 border border-white/10 rounded-md p-2 text-xs font-mono text-gray-300 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 resize-y min-h-[60px] w-full mt-2 transition-colors"
        [ngClass]="{
          'border-emerald-500/30': hasContent(),
          'border-dashed': !hasContent()
        }"
      ></textarea>
      
      <!-- Preview Toggle -->
      @if (hasContent()) {
        <button (click)="togglePreview()"
                class="text-[10px] font-mono text-emerald-400 hover:text-emerald-300 transition-colors flex items-center gap-1 mt-1">
          <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
          Preview
        </button>
      }
      
      <!-- Footer with stats -->
      @if (contentLength() > 0) {
        <div class="text-[8px] font-mono text-gray-500 text-right">
          {{ contentLength() }} chars
        </div>
      }
    </div>
  `
})
export class UiNode implements OnInit {
  node = input.required<EdenNode>();
  private engine = inject(CoreEngine);

  hasContent = signal(false);
  showPreview = signal(false);

  ngOnInit() {
    this.hasContent.set(!!this.node().metadata?.content);
  }

  contentLength(): number {
    return this.node().metadata?.content?.length || 0;
  }

  updateTitle(event: Event) {
    const input = event.target as HTMLInputElement;
    this.engine.updateNodeTitle(this.node().id, input.value);
    this.hasContent.set(!!this.node().metadata?.content);
  }

  updateContent(event: Event) {
    const textarea = event.target as HTMLTextAreaElement;
    this.engine.updateNodeContent(this.node().id, textarea.value);
    this.hasContent.set(!!textarea.value);
  }

  togglePreview() {
    this.showPreview.update(v => !v);
  }
}
