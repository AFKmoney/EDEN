import { Component, input, inject, signal } from '@angular/core';
import { EdenNode, TernaryValue } from '../../types/node';
import { CoreEngine } from '../../core/CoreEngine';
import { NgClass } from '@angular/common';

@Component({
  selector: 'eden-ui-node',
  standalone: true,
  imports: [NgClass],
  template: `
    <div class="bg-[var(--color-eden-surface)]/95 border rounded-xl p-3.5 backdrop-blur-xl min-w-[260px] shadow-2xl transition-all flex flex-col gap-2"
         [ngClass]="getCardBorderClass()">
      
      <!-- Header with type indicator -->
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-1.5">
          <span class="w-2 h-2 rounded-full" [ngClass]="getTritDotClass()"></span>
          <span class="text-[10px] font-mono tracking-wider font-semibold uppercase text-emerald-400">
            Trit_Display
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
        class="bg-transparent border-none outline-none text-white font-semibold text-xs tracking-tight w-full placeholder-gray-500 focus:text-emerald-400"
        placeholder="Untitled UI Display"
      />
      
      <!-- Trit Strobe Bar -->
      <div class="flex items-center gap-1 bg-black/40 p-1 rounded-lg border border-white/5">
        <span class="text-[9px] font-mono text-zinc-500 px-1">STATE:</span>
        <button (click)="forceTrit('FALSE', $event)"
                title="Set to -1 [FALSE]"
                [ngClass]="node().ternaryState === 'FALSE' ? 'bg-red-500/30 text-red-300 border-red-500/50' : 'bg-white/5 text-zinc-400 hover:text-white'"
                class="flex-1 py-1 text-[10px] font-mono font-bold rounded border border-transparent transition-colors">
          -1
        </button>
        <button (click)="forceTrit('UNKNOWN', $event)"
                title="Set to 0 [UNKNOWN / NEUTRAL]"
                [ngClass]="node().ternaryState === 'UNKNOWN' ? 'bg-amber-500/30 text-amber-300 border-amber-500/50' : 'bg-white/5 text-zinc-400 hover:text-white'"
                class="flex-1 py-1 text-[10px] font-mono font-bold rounded border border-transparent transition-colors">
          0
        </button>
        <button (click)="forceTrit('TRUE', $event)"
                title="Set to +1 [TRUE]"
                [ngClass]="node().ternaryState === 'TRUE' ? 'bg-emerald-500/30 text-emerald-300 border-emerald-500/50' : 'bg-white/5 text-zinc-400 hover:text-white'"
                class="flex-1 py-1 text-[10px] font-mono font-bold rounded border border-transparent transition-colors">
          +1
        </button>
      </div>

      <!-- Live Graphical Trit Gauge -->
      <div class="bg-black/50 border border-white/5 rounded-lg p-2 flex flex-col gap-1.5">
        <div class="flex justify-between text-[9px] font-mono text-zinc-400">
          <span>-1 (FALSE)</span>
          <span>0 (NEUTRAL)</span>
          <span>+1 (TRUE)</span>
        </div>
        <div class="h-2.5 bg-zinc-900 rounded-full overflow-hidden flex border border-white/10">
          <div class="w-1/3 transition-all duration-300" [ngClass]="node().ternaryState === 'FALSE' ? 'bg-red-500 shadow-[0_0_8px_#ef4444]' : 'bg-transparent'"></div>
          <div class="w-1/3 transition-all duration-300" [ngClass]="node().ternaryState === 'UNKNOWN' ? 'bg-amber-500 shadow-[0_0_8px_#f59e0b]' : 'bg-transparent'"></div>
          <div class="w-1/3 transition-all duration-300" [ngClass]="node().ternaryState === 'TRUE' ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : 'bg-transparent'"></div>
        </div>
      </div>

      <!-- Footer with ID -->
      <div class="flex items-center justify-between pt-1 border-t border-white/5 text-[9px] font-mono text-zinc-500">
        <span>Ternary Visualizer</span>
        <span class="text-[8px] opacity-70">ID: {{ node().id }}</span>
      </div>
    </div>
  `
})
export class UiNode {
  node = input.required<EdenNode>();
  private engine = inject(CoreEngine);

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
    return 'border-emerald-500/30 hover:border-emerald-500';
  }

  updateTitle(event: Event) {
    const input = event.target as HTMLInputElement;
    this.engine.updateNodeTitle(this.node().id, input.value);
  }

  forceTrit(state: TernaryValue, e: MouseEvent) {
    e.stopPropagation();
    this.engine.setNodeTernaryState(this.node().id, state);
  }
}

