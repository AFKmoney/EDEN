import { Component, input, inject, signal, OnInit } from '@angular/core';
import { EdenNode } from '../../types/node';
import { CoreEngine } from '../../core/CoreEngine';
import { NgClass } from '@angular/common';

@Component({
  selector: 'eden-data-node',
  standalone: true,
  imports: [NgClass],
  template: `
    <div class="bg-[var(--color-eden-surface)] border border-[var(--color-eden-border)] rounded-xl p-4 backdrop-blur-xl min-w-[220px] shadow-lg transition-all hover:border-cyan-500 hover:shadow-[0_0_20px_rgba(6,182,212,0.3)] flex flex-col gap-2">
      
      <!-- Header with type indicator -->
      <div class="flex items-center justify-between">
        <div class="text-[10px] font-mono text-cyan-400 tracking-widest uppercase opacity-80">Data_Cell</div>
        <div class="flex gap-1">
          @if (hasContent()) {
            <span class="text-[8px] bg-cyan-500/20 text-cyan-400 px-1 rounded">content</span>
          }
        </div>
      </div>
      
      <!-- Editable Title -->
      <input 
        [value]="node().metadata.title || node().id"
        (mousedown)="$event.stopPropagation()"
        (change)="updateTitle($event)"
        class="bg-transparent border-none outline-none text-white font-semibold tracking-tight w-full placeholder-gray-500"
        placeholder="Untitled Data Node"
      />
      
      <!-- Content Area -->
      <textarea
        [value]="node().metadata.content || ''"
        (mousedown)="$event.stopPropagation()"
        (change)="updateContent($event)"
        placeholder="Enter JSON schema, data structure, or any content..."
        class="bg-black/30 border border-white/10 rounded-md p-2 text-xs font-mono text-gray-300 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/30 resize-y min-h-[60px] w-full mt-2 transition-colors"
        [ngClass]="{
          'border-cyan-500/30': hasContent(),
          'border-dashed': !hasContent()
        }"
      ></textarea>
      
      <!-- Footer with stats -->
      @if (contentLength() > 0) {
        <div class="text-[8px] font-mono text-gray-500 text-right">
          {{ contentLength() }} chars
        </div>
      }
    </div>
  `
})
export class DataNode implements OnInit {
  node = input.required<EdenNode>();
  private engine = inject(CoreEngine);

  hasContent = signal(false);

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
}
