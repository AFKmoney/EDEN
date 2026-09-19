import { Component, input, inject, signal, computed } from '@angular/core';
import { EdenNode, LogicGateType, TernaryValue } from '../../types/node';
import { CoreEngine } from '../../core/CoreEngine';
import { NgClass } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'eden-logic-node',
  standalone: true,
  imports: [NgClass, MatIconModule],
  template: `
    <div class="bg-[var(--color-eden-surface)]/95 border rounded-xl p-3.5 backdrop-blur-xl min-w-[260px] shadow-2xl transition-all flex flex-col gap-2"
         [ngClass]="getCardBorderClass()">
      
      <!-- Header with type indicator and gate badge -->
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-1.5">
          <span class="w-2 h-2 rounded-full" [ngClass]="getTritDotClass()"></span>
          <span class="text-[10px] font-mono tracking-wider font-semibold uppercase"
                [ngClass]="getTritTextClass()">
            {{ getGateLabel() }}
          </span>
        </div>

        <!-- Live Trit State Badge -->
        <div class="flex items-center gap-1">
          <span class="text-[10px] font-mono px-2 py-0.5 rounded font-bold transition-all"
                [ngClass]="getTritBadgeClass()">
            {{ getTritDisplay() }}
          </span>
        </div>
      </div>
      
      <!-- Editable Title -->
      <div class="flex items-center gap-1">
        <input 
          [value]="node().metadata.title || node().id"
          (mousedown)="$event.stopPropagation()"
          (change)="updateTitle($event)"
          class="bg-transparent border-none outline-none text-white font-semibold text-xs tracking-tight w-full placeholder-gray-500 focus:text-[var(--color-eden-neon)]"
          placeholder="Untitled Gate"
        />
      </div>

      <!-- Quick Trit Strobe Selector: -1, 0, +1 -->
      <div class="flex items-center gap-1 bg-black/40 p-1 rounded-lg border border-white/5">
        <span class="text-[9px] font-mono text-zinc-500 px-1">FORCE:</span>
        <button (click)="forceTrit('FALSE', $event)"
                title="Force Trit to -1 [FALSE]"
                [ngClass]="node().ternaryState === 'FALSE' ? 'bg-red-500/30 text-red-300 border-red-500/50' : 'bg-white/5 text-zinc-400 hover:text-white'"
                class="flex-1 py-0.5 text-[10px] font-mono font-bold rounded border border-transparent transition-colors">
          -1
        </button>
        <button (click)="forceTrit('UNKNOWN', $event)"
                title="Force Trit to 0 [UNKNOWN / NEUTRAL]"
                [ngClass]="node().ternaryState === 'UNKNOWN' ? 'bg-amber-500/30 text-amber-300 border-amber-500/50' : 'bg-white/5 text-zinc-400 hover:text-white'"
                class="flex-1 py-0.5 text-[10px] font-mono font-bold rounded border border-transparent transition-colors">
          0
        </button>
        <button (click)="forceTrit('TRUE', $event)"
                title="Force Trit to +1 [TRUE]"
                [ngClass]="node().ternaryState === 'TRUE' ? 'bg-emerald-500/30 text-emerald-300 border-emerald-500/50' : 'bg-white/5 text-zinc-400 hover:text-white'"
                class="flex-1 py-0.5 text-[10px] font-mono font-bold rounded border border-transparent transition-colors">
          +1
        </button>
      </div>

      <!-- Gate Type Selector Dropdown / Pills -->
      <div class="flex flex-wrap gap-1">
        @for (g of commonGates; track g) {
          <button (click)="setGateType(g, $event)" 
                  [ngClass]="gateType() === g ? 'bg-purple-600 text-white font-bold shadow-sm' : 'bg-black/30 text-zinc-400 hover:bg-purple-500/20 hover:text-zinc-200'"
                  class="px-2 py-0.5 text-[9px] font-mono rounded transition-colors">
            {{ g }}
          </button>
        }
      </div>

      <!-- Oscilloscope Waveform Display for PROBE nodes -->
      @if (gateType() === 'PROBE') {
        <div class="bg-black/60 border border-emerald-500/30 rounded-lg p-2 flex flex-col gap-1">
          <div class="flex items-center justify-between text-[9px] font-mono text-emerald-400">
            <span>OSCILLOSCOPE TRACE</span>
            <span>VAL: {{ getTritDisplay() }}</span>
          </div>
          <div class="h-8 flex items-end gap-1 bg-black/40 p-1 rounded border border-white/5">
            @for (sample of probeHistory(); track $index) {
              <div class="flex-1 rounded-sm transition-all duration-200"
                   [ngClass]="{
                     'h-full bg-emerald-500 shadow-[0_0_6px_#10b981]': sample === 'TRUE',
                     'h-1/2 bg-amber-500': sample === 'UNKNOWN',
                     'h-1 bg-red-500': sample === 'FALSE'
                   }"></div>
            }
          </div>
        </div>
      }

      <!-- Memory Readout for LATCH nodes -->
      @if (gateType() === 'LATCH') {
        <div class="bg-black/40 border border-purple-500/30 rounded-lg p-2 text-[10px] font-mono flex items-center justify-between text-zinc-300">
          <span class="text-zinc-500">STORED TRIT:</span>
          <span class="font-bold text-purple-300">{{ node().metadata.memoryState || node().ternaryState }}</span>
        </div>
      }

      <!-- Carry & Sum Info for ADDER nodes -->
      @if (gateType() === 'ADDER') {
        <div class="bg-black/40 border border-cyan-500/30 rounded-lg p-1.5 text-[10px] font-mono flex items-center justify-around text-zinc-300">
          <span>SUM: <strong class="text-cyan-400">{{ node().ternaryState }}</strong></span>
          <span class="text-zinc-600">|</span>
          <span>CARRY: <strong class="text-purple-400">{{ node().metadata.props?.['carry'] || '0' }}</strong></span>
        </div>
      }

      <!-- Neuromorphic readout for NEURON nodes -->
      @if (gateType() === 'NEURON') {
        <div class="bg-black/40 border border-emerald-500/30 rounded-lg p-1.5 text-[10px] font-mono flex items-center justify-between text-zinc-300">
          <span class="text-zinc-500">NET ACTIVATION:</span>
          <span class="font-bold text-emerald-400">{{ node().metadata.props?.['netActivation'] ?? '0' }}</span>
        </div>
      }

      <!-- 3-Way readout for COMPARATOR nodes -->
      @if (gateType() === 'COMPARATOR') {
        <div class="bg-black/40 border border-blue-500/30 rounded-lg p-1 text-[9px] font-mono flex items-center justify-around text-zinc-400">
          <span [ngClass]="node().ternaryState === 'TRUE' ? 'text-emerald-400 font-bold' : ''">A &gt; B (+1)</span>
          <span>|</span>
          <span [ngClass]="node().ternaryState === 'UNKNOWN' ? 'text-amber-400 font-bold' : ''">A = B (0)</span>
          <span>|</span>
          <span [ngClass]="node().ternaryState === 'FALSE' ? 'text-red-400 font-bold' : ''">A &lt; B (-1)</span>
        </div>
      }

      <!-- Optional Logic Expression / Note Area -->
      @if (showContent()) {
        <textarea
          [value]="node().metadata.content || ''"
          (mousedown)="$event.stopPropagation()"
          (change)="updateContent($event)"
          placeholder="Logic expression or notes..."
          class="bg-black/30 border border-white/10 rounded-md p-1.5 text-[10px] font-mono text-gray-300 outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/30 resize-none h-12 w-full transition-colors"
        ></textarea>
      }

      <!-- Footer action bar -->
      <div class="flex items-center justify-between pt-1 border-t border-white/5 text-[9px] font-mono text-zinc-500">
        <button (click)="toggleContent($event)" class="hover:text-zinc-300 transition-colors">
          {{ showContent() ? '▲ Hide Notes' : '▼ Notes' }}
        </button>
        <span class="text-[8px] opacity-70">ID: {{ node().id }}</span>
      </div>
    </div>
  `
})
export class LogicNode {
  node = input.required<EdenNode>();
  private engine = inject(CoreEngine);

  showContent = signal(false);

  readonly commonGates: LogicGateType[] = [
    'AND', 'OR', 'NOT', 'XOR', 'CONSENSUS', 'MUX', 'LATCH', 'CLOCK', 'ADDER', 'COMPARATOR', 'NEURON', 'INVERTER', 'LFSR', 'PROBE'
  ];

  gateType(): LogicGateType {
    return (this.node().metadata?.gateType || 'AND') as LogicGateType;
  }

  getGateLabel(): string {
    const g = this.gateType();
    const map: Record<string, string> = {
      'AND': 'T-AND (Min)',
      'OR': 'T-OR (Max)',
      'NOT': 'T-NOT (Inv)',
      'XOR': 'T-SUM (XOR)',
      'CONSENSUS': 'T-Consensus',
      'MUX': 'T-Multiplexer',
      'LATCH': 'Trit Latch',
      'CLOCK': 'Trit Clock',
      'ADDER': 'Trit Adder',
      'COMPARATOR': 'T-Compare 3W',
      'NEURON': 'Neuromorphic',
      'INVERTER': 'Cyclic Shift',
      'LFSR': 'T-LFSR Gen',
      'MINMAX': 'Dual MinMax',
      'PROBE': 'Oscilloscope',
      'CONSTANT': 'Trit Source'
    };
    return map[g] || g;
  }

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

  getTritTextClass(): string {
    const s = this.node().ternaryState;
    if (s === 'TRUE') return 'text-emerald-400';
    if (s === 'FALSE') return 'text-red-400';
    return 'text-amber-400';
  }

  getCardBorderClass(): string {
    const s = this.node().ternaryState;
    if (s === 'TRUE') return 'border-emerald-500/40 hover:border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.15)]';
    if (s === 'FALSE') return 'border-red-500/40 hover:border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.15)]';
    return 'border-purple-500/30 hover:border-purple-500';
  }

  probeHistory(): TernaryValue[] {
    const h = this.node().metadata.history;
    if (h && h.length > 0) return h;
    return [this.node().ternaryState, this.node().ternaryState, this.node().ternaryState];
  }

  updateTitle(event: Event) {
    const input = event.target as HTMLInputElement;
    this.engine.updateNodeTitle(this.node().id, input.value);
  }

  updateContent(event: Event) {
    const textarea = event.target as HTMLTextAreaElement;
    this.engine.updateNodeContent(this.node().id, textarea.value);
  }

  toggleContent(e: MouseEvent) {
    e.stopPropagation();
    this.showContent.update(v => !v);
  }

  forceTrit(state: TernaryValue, e: MouseEvent) {
    e.stopPropagation();
    this.engine.setNodeTernaryState(this.node().id, state);
  }

  setGateType(type: LogicGateType, e: MouseEvent) {
    e.stopPropagation();
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

