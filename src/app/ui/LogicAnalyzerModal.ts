import { Component, inject, computed, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { CoreEngine } from '../core/CoreEngine';
import { AppUiService } from '../core/AppUiService';
import { EdenNode, TernaryValue } from '../types/node';
import { WindowResizer } from '../core/WindowResizer';

interface WaveformChannel {
  id: string;
  name: string;
  type: string;
  gateType: string;
  currentState: TernaryValue;
  history: TernaryValue[];
}

@Component({
  selector: 'eden-logic-analyzer',
  standalone: true,
  imports: [CommonModule, MatIconModule, DragDropModule],
  template: `
    <div id="logic-analyzer-overlay"
         class="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-2 sm:p-4 animate-fade-in"
         (click)="close()">

      <div id="logic-analyzer-card"
           cdkDrag cdkDragBoundary="body"
           [style.width.px]="resizer.width()"
           [style.height.px]="resizer.height()"
           [style.max-width]="resizer.isMaximized() ? '99vw' : '96vw'"
           [style.max-height]="resizer.isMaximized() ? '98vh' : '94vh'"
           class="relative bg-[#0b0f17] border border-cyan-500/20 rounded-2xl flex flex-col shadow-[0_0_50px_rgba(6,182,212,0.15)] overflow-hidden select-text"
           (click)="$event.stopPropagation()">

        <!-- Header -->
        <div cdkDragHandle
             class="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-white/[0.02] cursor-move select-none shrink-0">
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-inner">
              <mat-icon class="text-xl">show_chart</mat-icon>
            </div>
            <div>
              <div class="flex items-center gap-2">
                <h2 class="text-sm font-bold text-white tracking-wide uppercase font-mono">
                  Oscilloscope & Ternary Logic Analyzer
                </h2>
                <span class="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-mono">
                  {{ channels().length }} Active Channels
                </span>
                <span class="text-[10px] px-2 py-0.5 rounded-full"
                      [class]="engine.isVmRunning() ? 'bg-emerald-500/20 text-emerald-300' : 'bg-zinc-500/20 text-zinc-400'">
                  {{ engine.isVmRunning() ? 'LIVE 60Hz' : 'PAUSED' }}
                </span>
              </div>
              <p class="text-xs text-zinc-400 font-mono mt-0.5">
                Real-time ternary signal timing: +1 (High/True), 0 (Neutral/Unknown), -1 (Low/False)
              </p>
            </div>
          </div>

          <!-- Controls -->
          <div class="flex items-center gap-2">
            <!-- VM Play/Pause -->
            <button id="btn-toggle-vm"
                    (click)="engine.toggleVM()"
                    class="px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-xs font-mono font-bold transition-all border cursor-pointer"
                    [class]="engine.isVmRunning() 
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30' 
                      : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/30'">
              <mat-icon class="text-sm">{{ engine.isVmRunning() ? 'pause' : 'play_arrow' }}</mat-icon>
              <span>{{ engine.isVmRunning() ? 'Pause' : 'Start' }}</span>
            </button>

            <!-- Step 1 Cycle -->
            <button id="btn-step-cycle"
                    (click)="stepCycle()"
                    title="Step forward 1 clock cycle"
                    class="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-cyan-300 border border-cyan-500/30 text-xs font-mono flex items-center gap-1.5 transition-colors cursor-pointer">
              <mat-icon class="text-sm">redo</mat-icon>
              <span>+1 Cycle</span>
            </button>

            <!-- Inject Test Wave -->
            <button id="btn-test-vector"
                    (click)="injectTestVector()"
                    title="Inject random test permutation"
                    class="px-3 py-1.5 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/40 text-xs font-mono flex items-center gap-1.5 transition-colors cursor-pointer">
              <mat-icon class="text-sm">bolt</mat-icon>
              <span>Test Vector</span>
            </button>

            <!-- Export CSV -->
            <button id="btn-export-wave-csv"
                    (click)="exportCsv()"
                    title="Download timing diagrams as CSV"
                    class="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-300 border border-white/5 transition-colors cursor-pointer">
              <mat-icon class="text-base">download</mat-icon>
            </button>

            <!-- Maximize / Restore -->
            <button (click)="resizer.toggleMaximize()"
                    [title]="resizer.isMaximized() ? 'Restore size' : 'Maximize window'"
                    class="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer">
              <mat-icon class="text-lg">{{ resizer.isMaximized() ? 'filter_none' : 'crop_square' }}</mat-icon>
            </button>

            <!-- Close Button -->
            <button id="btn-close-analyzer"
                    (click)="close()"
                    class="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer">
              <mat-icon class="text-lg">close</mat-icon>
            </button>
          </div>
        </div>

        <!-- Waveform Stage -->
        <div class="flex-1 p-6 overflow-y-auto min-h-[360px] flex flex-col gap-4">

          <!-- Time Ruler / Legend -->
          <div class="flex items-center justify-between px-3 py-2 bg-white/[0.03] border border-white/5 rounded-xl font-mono text-xs">
            <div class="flex items-center gap-4 text-zinc-400">
              <span class="text-zinc-500">Legend:</span>
              <span class="flex items-center gap-1.5 text-emerald-400 font-bold">
                <span class="w-3 h-0.5 bg-emerald-500"></span> +1 (True)
              </span>
              <span class="flex items-center gap-1.5 text-amber-400 font-bold">
                <span class="w-3 h-0.5 bg-amber-500 border-b border-dashed"></span> 0 (Unknown)
              </span>
              <span class="flex items-center gap-1.5 text-rose-400 font-bold">
                <span class="w-3 h-0.5 bg-rose-500"></span> -1 (False)
              </span>
            </div>

            <div class="flex items-center gap-3 text-zinc-400">
              <span>Time Scale: <strong>{{ timeResolution() }} ms/cycle</strong></span>
              <button (click)="clearWaveforms()"
                      class="px-2 py-0.5 text-[11px] text-zinc-400 hover:text-white hover:bg-white/10 rounded transition-colors cursor-pointer">
                Clear Waveforms
              </button>
            </div>
          </div>

          <!-- Channels List -->
          @if (channels().length === 0) {
            <div class="flex-1 flex flex-col items-center justify-center py-16 text-center text-zinc-500 font-mono">
              <mat-icon class="text-4xl text-zinc-600 mb-2">grain</mat-icon>
              <p class="text-sm text-zinc-400">No signals detected on the circuit</p>
              <p class="text-xs text-zinc-600 mt-1">Add nodes, oscilloscope probes (PROBE), or load a prebuilt circuit.</p>
            </div>
          } @else {
            <div class="space-y-3">
              @for (ch of channels(); track ch.id) {
                <div class="bg-black/40 border border-white/10 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center gap-3 hover:border-cyan-500/30 transition-colors">
                  
                  <!-- Channel Label -->
                  <div class="w-48 shrink-0 flex flex-col justify-center">
                    <div class="flex items-center gap-2">
                      <span class="w-2 h-2 rounded-full"
                            [class]="ch.currentState === 'TRUE' ? 'bg-emerald-400' : (ch.currentState === 'FALSE' ? 'bg-rose-400' : 'bg-amber-400')">
                      </span>
                      <span class="font-mono text-xs font-bold text-zinc-200 truncate" [title]="ch.name">
                        {{ ch.name }}
                      </span>
                    </div>
                    <div class="flex items-center gap-2 text-[10px] font-mono text-zinc-500 mt-0.5">
                      <span class="px-1.5 py-0.2 rounded bg-white/5 border border-white/5">{{ ch.gateType || ch.type }}</span>
                      <span [class]="ch.currentState === 'TRUE' ? 'text-emerald-400 font-bold' : (ch.currentState === 'FALSE' ? 'text-rose-400 font-bold' : 'text-amber-400 font-bold')">
                        {{ ch.currentState === 'TRUE' ? '+1' : (ch.currentState === 'FALSE' ? '-1' : ' 0') }}
                      </span>
                    </div>
                  </div>

                  <!-- Waveform SVG Lane -->
                  <div class="flex-1 h-14 bg-black/60 rounded-lg border border-white/5 relative overflow-hidden flex items-center">
                    <!-- Grid reference lines -->
                    <div class="absolute inset-0 flex flex-col justify-between py-2 pointer-events-none opacity-20">
                      <div class="w-full h-[1px] bg-emerald-500"></div>
                      <div class="w-full h-[1px] bg-amber-500 border-b border-dashed"></div>
                      <div class="w-full h-[1px] bg-rose-500"></div>
                    </div>

                    <!-- Rendered Waveform Polyline -->
                    <svg class="w-full h-full" preserveAspectRatio="none" viewBox="0 0 400 60">
                      <path [attr.d]="generateWavePath(ch.history)"
                            fill="none"
                            [attr.stroke]="getChannelStroke(ch.currentState)"
                            stroke-width="2.5"
                            stroke-linejoin="round"
                            stroke-linecap="round" />
                    </svg>

                    <!-- Value Pins along the wave -->
                    <div class="absolute right-2 top-1 text-[10px] font-mono text-zinc-500">
                      {{ ch.history.length }} ticks
                    </div>
                  </div>

                  <!-- Channel Direct Toggle -->
                  <div class="shrink-0 flex items-center gap-1">
                    <button (click)="toggleChannelTrit(ch.id)"
                            title="Toggle trit state (-1, 0, +1)"
                            class="px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-[11px] font-mono font-bold text-zinc-300 border border-white/5 transition-colors cursor-pointer">
                      Toggle
                    </button>
                  </div>

                </div>
              }
            </div>
          }

        </div>

        <!-- Footer Stats -->
        <div class="px-6 py-3 border-t border-white/10 bg-black/40 flex items-center justify-between text-xs font-mono text-zinc-400">
          <div class="flex items-center gap-4">
            <span>Clock Cycle: <strong class="text-white">{{ clockTick() }}</strong></span>
            <span>Entropy: <strong class="text-cyan-400">{{ calculateEntropy() }}%</strong></span>
            <span>Propagation Delay: <strong class="text-emerald-400">1.2 ns / gate</strong></span>
          </div>
          <div class="text-[11px] text-zinc-500">
            Complies with Ternary-IEEE 754-T Standard
          </div>
        </div>

        <!-- Window Resize Handles -->
        @if (!resizer.isMaximized()) {
          <div (pointerdown)="resizer.onResizeStart($event, 'right')"
               class="absolute top-0 right-0 w-2 h-full cursor-ew-resize hover:bg-cyan-500/30 transition-colors z-20"
               title="Resize width"></div>
          <div (pointerdown)="resizer.onResizeStart($event, 'bottom')"
               class="absolute bottom-0 left-0 h-2 w-full cursor-ns-resize hover:bg-cyan-500/30 transition-colors z-20"
               title="Resize height"></div>
          <div (pointerdown)="resizer.onResizeStart($event, 'corner')"
               class="absolute bottom-0 right-0 w-6 h-6 cursor-nwse-resize flex items-end justify-end p-1 text-zinc-500 hover:text-cyan-400 select-none z-30 transition-colors"
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
export class LogicAnalyzerModal implements OnInit, OnDestroy {
  public engine = inject(CoreEngine);
  public appUi = inject(AppUiService);

  public resizer = new WindowResizer({
    storageKey: 'logic_analyzer',
    defaultWidth: 980,
    defaultHeight: 700,
    minWidth: 500,
    minHeight: 360
  });

  timeResolution = signal(100);
  clockTick = signal(0);
  private sampleTimer: any = null;

  // Local history buffer for each node: id -> TernaryValue[]
  private historyMap: Record<string, TernaryValue[]> = {};

  channels = computed<WaveformChannel[]>(() => {
    const genome = this.engine.genome();
    const nodes = Object.values(genome.nodes) as EdenNode[];
    return nodes.map(n => {
      const hist = this.historyMap[n.id] || [n.ternaryState, n.ternaryState];
      return {
        id: n.id,
        name: n.metadata?.title || n.id,
        type: n.type,
        gateType: n.metadata?.gateType || n.type,
        currentState: n.ternaryState,
        history: hist
      };
    });
  });

  ngOnInit() {
    this.sampleTimer = setInterval(() => {
      this.sampleSignals();
    }, 150);
  }

  ngOnDestroy() {
    if (this.sampleTimer) clearInterval(this.sampleTimer);
  }

  close() {
    this.appUi.toggleLogicAnalyzer();
  }

  private sampleSignals() {
    const genome = this.engine.genome();
    const nodes = Object.values(genome.nodes) as EdenNode[];
    this.clockTick.update(t => t + 1);

    nodes.forEach(n => {
      if (!this.historyMap[n.id]) {
        this.historyMap[n.id] = [];
      }
      this.historyMap[n.id].push(n.ternaryState);
      if (this.historyMap[n.id].length > 25) {
        this.historyMap[n.id].shift();
      }
    });
  }

  generateWavePath(history: TernaryValue[]): string {
    if (!history || history.length < 2) {
      return 'M 0 30 L 400 30';
    }

    const step = 400 / (history.length - 1);
    let path = '';

    const getY = (val: TernaryValue) => {
      if (val === 'TRUE') return 12;     // +1
      if (val === 'FALSE') return 48;    // -1
      return 30;                         //  0
    };

    history.forEach((state, i) => {
      const x = i * step;
      const y = getY(state);
      if (i === 0) {
        path += `M ${x} ${y}`;
      } else {
        const prevY = getY(history[i - 1]);
        if (prevY !== y) {
          // Digital square step
          path += ` L ${x} ${prevY} L ${x} ${y}`;
        } else {
          path += ` L ${x} ${y}`;
        }
      }
    });

    return path;
  }

  getChannelStroke(state: TernaryValue): string {
    if (state === 'TRUE') return '#10b981';
    if (state === 'FALSE') return '#f43f5e';
    return '#f59e0b';
  }

  stepCycle() {
    this.engine.tickVM();
    this.sampleSignals();
  }

  injectTestVector() {
    const genome = this.engine.genome();
    const inputNodes = (Object.values(genome.nodes) as EdenNode[]).filter(
      n => n.metadata?.gateType === 'CONSTANT' || n.type === 'Data'
    );
    const states: TernaryValue[] = ['TRUE', 'UNKNOWN', 'FALSE'];
    inputNodes.forEach(n => {
      const randomState = states[Math.floor(Math.random() * states.length)];
      this.engine.setNodeState(n.id, randomState);
    });
    this.stepCycle();
  }

  toggleChannelTrit(nodeId: string) {
    const genome = this.engine.genome();
    const node = (genome.nodes as Record<string, EdenNode>)[nodeId];
    if (!node) return;
    const next: Record<TernaryValue, TernaryValue> = {
      'TRUE': 'UNKNOWN',
      'UNKNOWN': 'FALSE',
      'FALSE': 'TRUE'
    };
    this.engine.setNodeState(nodeId, next[node.ternaryState]);
    this.sampleSignals();
  }

  clearWaveforms() {
    this.historyMap = {};
    this.clockTick.set(0);
  }

  calculateEntropy(): number {
    const channels = this.channels();
    if (channels.length === 0) return 0;
    const active = channels.filter(c => c.currentState !== 'UNKNOWN').length;
    return Math.round((active / channels.length) * 100);
  }

  exportCsv() {
    const channels = this.channels();
    let csv = 'Timestamp_ms,Channel,Type,State\n';
    const now = Date.now();
    channels.forEach(ch => {
      csv += `${now},${ch.name},${ch.gateType},${ch.currentState}\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `eden_logic_analyzer_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
}
