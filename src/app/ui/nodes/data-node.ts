import { Component, input, inject, signal } from '@angular/core';
import { EdenNode, TernaryValue } from '../../types/node';
import { CoreEngine } from '../../core/CoreEngine';
import { NgClass } from '@angular/common';

@Component({
  selector: 'eden-data-node',
  standalone: true,
  imports: [NgClass],
  template: `
    <div class="bg-[var(--color-eden-surface)]/95 border rounded-xl p-3.5 backdrop-blur-xl min-w-[260px] shadow-2xl transition-all flex flex-col gap-2"
         [ngClass]="getCardBorderClass()">
      
      <!-- Header with type indicator -->
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-1.5">
          <span class="w-2 h-2 rounded-full" [ngClass]="getTritDotClass()"></span>
          <span class="text-[10px] font-mono tracking-wider font-semibold uppercase text-cyan-400">
            Trit_Source
          </span>
        </div>

        <div class="flex items-center gap-1">
          <span class="text-[10px] font-mono px-2 py-0.5 rounded font-bold transition-all"
                [ngClass]="getTritBadgeClass()">
            {{ getTritDisplay() }}
          </span>
        </div>
      </div>
      
      <!-- Editable Title -->
      <input 
        [value]="node().metadata.title || node().id"
        (mousedown)="$event.stopPropagation()"
        (change)="updateTitle($event)"
        class="bg-transparent border-none outline-none text-white font-semibold text-xs tracking-tight w-full placeholder-gray-500 focus:text-cyan-400"
        placeholder="Untitled Data Node"
      />
      
      <!-- Interactive Trit Toggle Bar -->
      <div class="flex items-center gap-1 bg-black/40 p-1 rounded-lg border border-white/5">
        <span class="text-[9px] font-mono text-zinc-500 px-1">OUTPUT:</span>
        <button (click)="forceTrit('FALSE', $event)"
                title="Emit -1 [FALSE]"
                [ngClass]="node().ternaryState === 'FALSE' ? 'bg-red-500/30 text-red-300 border-red-500/50' : 'bg-white/5 text-zinc-400 hover:text-white'"
                class="flex-1 py-1 text-[10px] font-mono font-bold rounded border border-transparent transition-colors">
          -1
        </button>
        <button (click)="forceTrit('UNKNOWN', $event)"
                title="Emit 0 [UNKNOWN / NEUTRAL]"
                [ngClass]="node().ternaryState === 'UNKNOWN' ? 'bg-amber-500/30 text-amber-300 border-amber-500/50' : 'bg-white/5 text-zinc-400 hover:text-white'"
                class="flex-1 py-1 text-[10px] font-mono font-bold rounded border border-transparent transition-colors">
          0
        </button>
        <button (click)="forceTrit('TRUE', $event)"
                title="Emit +1 [TRUE]"
                [ngClass]="node().ternaryState === 'TRUE' ? 'bg-emerald-500/30 text-emerald-300 border-emerald-500/50' : 'bg-white/5 text-zinc-400 hover:text-white'"
                class="flex-1 py-1 text-[10px] font-mono font-bold rounded border border-transparent transition-colors">
          +1
        </button>
      </div>

      <!-- Content Area (Optional payload) -->
      @if (showPayload()) {
        <textarea
          [value]="node().metadata.content || ''"
          (mousedown)="$event.stopPropagation()"
          (change)="updateContent($event)"
          placeholder="Payload / Signal details..."
          class="bg-black/30 border border-white/10 rounded-md p-1.5 text-[10px] font-mono text-gray-300 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/30 resize-none h-12 w-full transition-colors"
        ></textarea>
      }

      <div class="flex items-center justify-between pt-1 border-t border-white/5 text-[9px] font-mono text-zinc-500">
        <button (click)="togglePayload($event)" class="hover:text-zinc-300 transition-colors">
          {{ showPayload() ? '▲ Hide Payload' : '▼ Payload' }}
        </button>
        <span class="text-[8px] opacity-70">ID: {{ node().id }}</span>
      </div>
    </div>
  `
})
export class DataNode {
  node = input.required<EdenNode>();
  private engine = inject(CoreEngine);
  showPayload = signal(false);

  getTritDisplay(): string {
    const s = this.node().ternaryState;
    if (s === 'TRUE') return '+1 [TRUE]';
    if (s === 'FALSE') return '-1 [FALSE]';
    return '0 [NEUTRAL]';
  }

  getTritBadgeClass(): string {
    const s = this.node().ternaryState;
    if (s === 'TRUE') return 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-[0_0_8px_rgba(16,185,129,0.3)]';
    if (s === 'FALSE') return 'bg-red-500/20 text-red-400 border border-red-500/40 shadow-[0_0_8px_rgba(239,68,68,0.3)]';
    return 'bg-amber-500/20 text-amber-400 border border-amber-500/40';
  }

  getTritDotClass(): string {
    const s = this.node().ternaryState;
    if (s === 'TRUE') return 'bg-emerald-400 shadow-[0_0_6px_#10b981]';
    if (s === 'FALSE') return 'bg-red-400 shadow-[0_0_6px_#ef4444]';
    return 'bg-amber-400';
  }

  getCardBorderClass(): string {
    const s = this.node().ternaryState;
    if (s === 'TRUE') return 'border-emerald-500/40 hover:border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.15)]';
    if (s === 'FALSE') return 'border-red-500/40 hover:border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.15)]';
    return 'border-cyan-500/30 hover:border-cyan-500';
  }

  updateTitle(event: Event) {
    const input = event.target as HTMLInputElement;
    this.engine.updateNodeTitle(this.node().id, input.value);
  }

  updateContent(event: Event) {
    const textarea = event.target as HTMLTextAreaElement;
    this.engine.updateNodeContent(this.node().id, textarea.value);
  }

  forceTrit(state: TernaryValue, e: MouseEvent) {
    e.stopPropagation();
    this.engine.setNodeTernaryState(this.node().id, state);
  }

  togglePayload(e: MouseEvent) {
    e.stopPropagation();
    this.showPayload.update(v => !v);
  }
}

