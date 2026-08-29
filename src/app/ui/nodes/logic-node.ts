import { Component, input, inject, signal, OnInit } from '@angular/core';
import { EdenNode } from '../../types/node';
import { CoreEngine } from '../../core/CoreEngine';
import { NgClass } from '@angular/common';

@Component({
  selector: 'eden-logic-node',
  standalone: true,
  imports: [NgClass],
  template: `
    <div class="bg-[var(--color-eden-surface)] border border-[var(--color-eden-border)] rounded-xl p-4 backdrop-blur-xl min-w-[220px] shadow-lg transition-all hover:border-purple-500 hover:shadow-[0_0_20px_rgba(168,85,247,0.3)] flex flex-col gap-2">
      
      <!-- Header with type indicator and gate selector -->
      <div class="flex items-center justify-between">
        <div class="text-[10px] font-mono text-purple-400 tracking-widest uppercase opacity-80">Logic_Cell</div>
        <div class="flex gap-1">
          @if (hasGateType()) {
            <span class="text-[8px] bg-purple-500/20 text-purple-400 px-1 rounded">{{ gateType() }}</span>
          }
          @if (hasContent()) {
            <span class="text-[8px] bg-purple-500/20 text-purple-400 px-1 rounded">code</span>
          }
        </div>
      </div>
      
      <!-- Editable Title -->
      <input 
        [value]="node().metadata.title || node().id"
        (mousedown)="$event.stopPropagation()"
        (change)="updateTitle($event)"
        class="bg-transparent border-none outline-none text-white font-semibold tracking-tight w-full placeholder-gray-500"
        placeholder="Untitled Logic Node"
      />
      
      <!-- Gate Type Selector -->
      <div class="flex gap-1 mt-1">
        <button (click)="setGateType('AND')" 
                [ngClass]="gateType() === 'AND' ? 'bg-purple-600 text-white' : 'bg-black/30 text-gray-400 hover:bg-purple-500/20'"
                class="flex-1 py-1 text-[10px] font-mono font-bold rounded transition-colors">
          AND
        </button>
        <button (click)="setGateType('OR')" 
                [ngClass]="gateType() === 'OR' ? 'bg-purple-600 text-white' : 'bg-black/30 text-gray-400 hover:bg-purple-500/20'"
                class="flex-1 py-1 text-[10px] font-mono font-bold rounded transition-colors">
          OR
        </button>
        <button (click)="setGateType('NOT')" 
                [ngClass]="gateType() === 'NOT' ? 'bg-purple-600 text-white' : 'bg-black/30 text-gray-400 hover:bg-purple-500/20'"
                class="flex-1 py-1 text-[10px] font-mono font-bold rounded transition-colors">
          NOT
        </button>
      </div>
      
      <!-- Content Area -->
      <textarea
        [value]="node().metadata.content || ''"
        (mousedown)="$event.stopPropagation()"
        (change)="updateContent($event)"
        placeholder="Enter logic expression, condition, or ternary operation..."
        class="bg-black/30 border border-white/10 rounded-md p-2 text-xs font-mono text-gray-300 outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/30 resize-y min-h-[60px] w-full mt-1 transition-colors"
        [ngClass]="{
          'border-purple-500/30': hasContent(),
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
export class LogicNode implements OnInit {
  node = input.required<EdenNode>();
  private engine = inject(CoreEngine);

  hasContent = signal(false);

  ngOnInit() {
    this.hasContent.set(!!this.node().metadata?.content);
  }

  gateType(): 'AND' | 'OR' | 'NOT' | undefined {
    return this.node().metadata?.gateType;
  }

  hasGateType(): boolean {
    return !!this.gateType();
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

  setGateType(type: 'AND' | 'OR' | 'NOT') {
    this.engine.mutate({
      nodes: {
        [this.node().id]: {
          ...this.node(),
          metadata: {
            ...this.node().metadata,
            gateType: type
          }
        }
      }
    });
  }
}
