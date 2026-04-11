import { Component, input, inject } from '@angular/core';
import { EdenNode } from '../../types/node';
import { CoreEngine } from '../../core/CoreEngine';

@Component({
  selector: 'eden-logic-node',
  standalone: true,
  template: `
    <div class="bg-[var(--color-eden-surface)] border border-[var(--color-eden-border)] rounded-xl p-4 backdrop-blur-xl min-w-[220px] shadow-lg transition-all hover:border-[var(--color-eden-neon)] hover:shadow-[0_0_20px_var(--color-eden-neon)] flex flex-col gap-2">
      <div class="text-[10px] font-mono text-[var(--color-eden-neon)] tracking-widest uppercase opacity-80">Logic_Cell</div>
      <input 
        [value]="node().metadata.title || node().id"
        (mousedown)="$event.stopPropagation()"
        (change)="updateTitle($event)"
        class="bg-transparent border-none outline-none text-white font-semibold tracking-tight w-full"
      />
      <textarea
        [value]="node().metadata.content || ''"
        (mousedown)="$event.stopPropagation()"
        (change)="updateContent($event)"
        placeholder="Enter logic script..."
        class="bg-black/30 border border-white/10 rounded-md p-2 text-xs font-mono text-gray-300 outline-none focus:border-[var(--color-eden-neon)] resize-y min-h-[60px] w-full mt-2"
      ></textarea>
    </div>
  `
})
export class LogicNode {
  node = input.required<EdenNode>();
  private engine = inject(CoreEngine);

  updateTitle(event: Event) {
    const input = event.target as HTMLInputElement;
    this.engine.updateNodeTitle(this.node().id, input.value);
  }

  updateContent(event: Event) {
    const textarea = event.target as HTMLTextAreaElement;
    this.engine.updateNodeContent(this.node().id, textarea.value);
  }
}
