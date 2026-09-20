import { Component, input, output, inject, computed, HostListener, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { CoreEngine } from '../core/CoreEngine';
import { AppUiService } from '../core/AppUiService';
import { TerminalService } from '../core/TerminalService';
import { LogicGateType, TernaryValue, EdenNode } from '../types/node';
import { EdenEdge } from '../types/edge';
import { copyToClipboard } from '../core/ClipboardUtil';

export interface ContextMenuData {
  type: 'NODE' | 'EDGE' | 'CANVAS';
  screenX: number;
  screenY: number;
  worldX: number;
  worldY: number;
  targetId?: string;
}

@Component({
  selector: 'eden-context-menu',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  template: `
    <!-- Backdrop to close on click outside -->
    <div class="fixed inset-0 z-50 bg-transparent cursor-default select-none"
         (pointerdown)="onBackdropClick($event)"
         (contextmenu)="$event.preventDefault()">
      
      <!-- Context Menu Card -->
      <div id="eden-adaptive-context-menu"
           class="absolute bg-[#0a0f18]/95 border border-cyan-500/30 rounded-xl shadow-[0_10px_30px_rgba(0,0,0,0.85)] backdrop-blur-xl p-1.5 min-w-[240px] max-w-[320px] text-xs font-mono text-zinc-200 z-50 animate-fade-in divide-y divide-white/5"
           [style.left.px]="clampedX()"
           [style.top.px]="clampedY()"
           (pointerdown)="$event.stopPropagation()">

        <!-- ==================== CONTEXT: NODE ==================== -->
        @if (data().type === 'NODE' && targetNode(); as node) {
          <!-- Header -->
          <div class="px-2.5 py-2">
            <div class="flex items-center justify-between gap-2">
              <div class="flex items-center gap-1.5 truncate">
                <span class="w-2.5 h-2.5 rounded-full shrink-0"
                      [ngClass]="{
                        'bg-emerald-400 shadow-[0_0_8px_#34d399]': node.ternaryState === 'TRUE',
                        'bg-red-400 shadow-[0_0_8px_#f87171]': node.ternaryState === 'FALSE',
                        'bg-amber-400 shadow-[0_0_8px_#fbbf24]': node.ternaryState === 'UNKNOWN'
                      }"></span>
                <span class="font-bold text-white tracking-wide truncate">
                  {{ node.metadata.title || node.id }}
                </span>
              </div>
              <span class="text-[9px] px-1.5 py-0.5 rounded bg-white/10 text-cyan-300 uppercase shrink-0">
                {{ node.metadata.gateType || node.type }}
              </span>
            </div>
            <div class="text-[10px] text-zinc-400 mt-1 flex items-center justify-between">
              <span>ID: {{ node.id }}</span>
              <span>Trit: <strong class="text-white">{{ getTritLabel(node.ternaryState) }}</strong></span>
            </div>
          </div>

          <!-- Section 1: Force Trit State -->
          <div class="py-1.5 space-y-1">
            <div class="px-2 text-[9px] font-bold uppercase tracking-wider text-zinc-400">
              Force Ternary Signal
            </div>
            <div class="grid grid-cols-3 gap-1 px-1">
              <button (click)="setNodeState('FALSE')"
                      class="px-2 py-1 rounded bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-red-300 text-[11px] font-bold text-center transition-colors cursor-pointer">
                -1 (F)
              </button>
              <button (click)="setNodeState('UNKNOWN')"
                      class="px-2 py-1 rounded bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 text-[11px] font-bold text-center transition-colors cursor-pointer">
                0 (U)
              </button>
              <button (click)="setNodeState('TRUE')"
                      class="px-2 py-1 rounded bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 text-[11px] font-bold text-center transition-colors cursor-pointer">
                +1 (T)
              </button>
            </div>
          </div>

          <!-- Section 2: Change Logic Gate -->
          <div class="py-1.5">
            <div class="px-2 text-[9px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
              Convert Logic Gate
            </div>
            <div class="grid grid-cols-2 gap-1 px-1 max-h-[140px] overflow-y-auto pr-1">
              @for (g of commonGates; track g.type) {
                <button (click)="setGateType(g.type)"
                        [class.bg-cyan-500/20]="node.metadata.gateType === g.type"
                        [class.text-cyan-300]="node.metadata.gateType === g.type"
                        class="px-2 py-1 rounded hover:bg-white/10 text-[10px] flex items-center justify-between text-zinc-300 text-left transition-colors cursor-pointer">
                  <span>{{ g.name }}</span>
                  @if (node.metadata.gateType === g.type) {
                    <mat-icon style="font-size: 12px; width: 12px; height: 12px;">check</mat-icon>
                  }
                </button>
              }
            </div>
          </div>

          <!-- Section 3: Resize Node -->
          <div class="py-1.5">
            <div class="px-2 text-[9px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
              Dimensions & Scale
            </div>
            <div class="grid grid-cols-2 gap-1 px-1">
              <button (click)="resize(230, 140)" class="px-2 py-1 rounded hover:bg-white/10 text-[10px] text-zinc-300 text-left flex items-center gap-1.5 cursor-pointer">
                <mat-icon style="font-size: 13px; width: 13px; height: 13px;">compress</mat-icon>
                <span>Compact (230px)</span>
              </button>
              <button (click)="resize(280, 170)" class="px-2 py-1 rounded hover:bg-white/10 text-[10px] text-zinc-300 text-left flex items-center gap-1.5 cursor-pointer">
                <mat-icon style="font-size: 13px; width: 13px; height: 13px;">aspect_ratio</mat-icon>
                <span>Standard (280px)</span>
              </button>
              <button (click)="resize(350, 220)" class="px-2 py-1 rounded hover:bg-white/10 text-[10px] text-zinc-300 text-left flex items-center gap-1.5 cursor-pointer">
                <mat-icon style="font-size: 13px; width: 13px; height: 13px;">open_in_full</mat-icon>
                <span>Large (350px)</span>
              </button>
              <button (click)="resize(440, 280)" class="px-2 py-1 rounded hover:bg-white/10 text-[10px] text-zinc-300 text-left flex items-center gap-1.5 cursor-pointer">
                <mat-icon style="font-size: 13px; width: 13px; height: 13px;">fullscreen</mat-icon>
                <span>Maxi HD (440px)</span>
              </button>
            </div>
          </div>

          <!-- Section 4: Advanced Actions -->
          <div class="py-1 space-y-0.5">
            <button (click)="attachProbe()" class="w-full px-2.5 py-1.5 rounded hover:bg-cyan-500/15 text-cyan-300 text-left flex items-center gap-2 transition-colors cursor-pointer">
              <mat-icon style="font-size: 14px; width: 14px; height: 14px;">show_chart</mat-icon>
              <span>Attach Oscilloscope Probe</span>
            </button>

            <button (click)="duplicateNode()" class="w-full px-2.5 py-1.5 rounded hover:bg-white/10 text-zinc-200 text-left flex items-center gap-2 transition-colors cursor-pointer">
              <mat-icon style="font-size: 14px; width: 14px; height: 14px;">content_copy</mat-icon>
              <span>Duplicate Component</span>
            </button>

            <button (click)="deleteNode()" class="w-full px-2.5 py-1.5 rounded hover:bg-red-500/20 text-red-400 text-left flex items-center gap-2 transition-colors cursor-pointer">
              <mat-icon style="font-size: 14px; width: 14px; height: 14px;">delete</mat-icon>
              <span>Delete Component</span>
            </button>
          </div>
        }

        <!-- ==================== CONTEXT: EDGE ==================== -->
        @if (data().type === 'EDGE' && targetEdge(); as edge) {
          <!-- Header -->
          <div class="px-2.5 py-2">
            <div class="flex items-center gap-1.5 text-cyan-400 font-bold">
              <mat-icon style="font-size: 16px; width: 16px; height: 16px;">cable</mat-icon>
              <span>Trit Cable Connection</span>
            </div>
            <div class="text-[10px] text-zinc-400 mt-1 flex items-center justify-between">
              <span>{{ edge.sourceId }} &rarr; {{ edge.targetId }}</span>
            </div>
          </div>

          <!-- Edge Actions -->
          <div class="py-1 space-y-0.5">
            <button (click)="invertEdgeDirection()" class="w-full px-2.5 py-1.5 rounded hover:bg-white/10 text-zinc-200 text-left flex items-center gap-2 transition-colors cursor-pointer">
              <mat-icon style="font-size: 14px; width: 14px; height: 14px;">swap_horiz</mat-icon>
              <span>Invert Signal Direction</span>
            </button>

            <button (click)="insertNotGate()" class="w-full px-2.5 py-1.5 rounded hover:bg-purple-500/15 text-purple-300 text-left flex items-center gap-2 transition-colors cursor-pointer">
              <mat-icon style="font-size: 14px; width: 14px; height: 14px;">alt_route</mat-icon>
              <span>Insert NOT Inverter Midpoint</span>
            </button>

            <button (click)="deleteEdge()" class="w-full px-2.5 py-1.5 rounded hover:bg-red-500/20 text-red-400 text-left flex items-center gap-2 transition-colors cursor-pointer">
              <mat-icon style="font-size: 14px; width: 14px; height: 14px;">delete</mat-icon>
              <span>Delete Connection</span>
            </button>
          </div>
        }

        <!-- ==================== CONTEXT: CANVAS ==================== -->
        @if (data().type === 'CANVAS') {
          <!-- Header -->
          <div class="px-2.5 py-2 flex items-center justify-between text-zinc-400">
            <span class="text-[10px] uppercase font-bold text-cyan-400 flex items-center gap-1">
              <mat-icon style="font-size: 14px; width: 14px; height: 14px;">grid_view</mat-icon>
              Matrix Canvas
            </span>
            <span class="text-[10px] font-mono">
              [{{ data().worldX | number:'1.0-0' }}, {{ data().worldY | number:'1.0-0' }}]
            </span>
          </div>

          <!-- Canvas Quick Actions -->
          <div class="py-1 space-y-0.5">
            <button (click)="openComponentPalette()" class="w-full px-2.5 py-1.5 rounded hover:bg-cyan-500/15 text-cyan-300 text-left flex items-center gap-2 transition-colors cursor-pointer">
              <mat-icon style="font-size: 14px; width: 14px; height: 14px;">add_box</mat-icon>
              <span class="font-semibold">Add Component...</span>
            </button>

            <button (click)="autoLayout()" class="w-full px-2.5 py-1.5 rounded hover:bg-emerald-500/15 text-emerald-300 text-left flex items-center gap-2 transition-colors cursor-pointer">
              <mat-icon style="font-size: 14px; width: 14px; height: 14px;">view_column</mat-icon>
              <span>Auto Layout Side-by-Side (Zero Overlap)</span>
            </button>

            <button (click)="toggleVM()" class="w-full px-2.5 py-1.5 rounded hover:bg-white/10 text-zinc-200 text-left flex items-center gap-2 transition-colors cursor-pointer">
              <mat-icon style="font-size: 14px; width: 14px; height: 14px;">{{ engine.isVmRunning() ? 'pause' : 'play_arrow' }}</mat-icon>
              <span>{{ engine.isVmRunning() ? 'Pause VM Clock' : 'Start VM Clock' }}</span>
            </button>

            <button (click)="openLogicAnalyzer()" class="w-full px-2.5 py-1.5 rounded hover:bg-amber-500/15 text-amber-300 text-left flex items-center gap-2 transition-colors cursor-pointer">
              <mat-icon style="font-size: 14px; width: 14px; height: 14px;">show_chart</mat-icon>
              <span>Open Oscilloscope & Logic Analyzer</span>
            </button>

            <button (click)="openCircuitLibrary()" class="w-full px-2.5 py-1.5 rounded hover:bg-purple-500/15 text-purple-300 text-left flex items-center gap-2 transition-colors cursor-pointer">
              <mat-icon style="font-size: 14px; width: 14px; height: 14px;">developer_board</mat-icon>
              <span>Circuit Library</span>
            </button>

            <button (click)="exportVerilog()" class="w-full px-2.5 py-1.5 rounded hover:bg-white/10 text-zinc-200 text-left flex items-center gap-2 transition-colors cursor-pointer">
              <mat-icon style="font-size: 14px; width: 14px; height: 14px;">memory</mat-icon>
              <span>Generate Verilog HDL</span>
            </button>

            <button (click)="clearCircuit()" class="w-full px-2.5 py-1.5 rounded hover:bg-red-500/20 text-red-400 text-left flex items-center gap-2 transition-colors cursor-pointer">
              <mat-icon style="font-size: 14px; width: 14px; height: 14px;">delete_sweep</mat-icon>
              <span>Clear Canvas</span>
            </button>
          </div>
        }
      </div>
    </div>
  `
})
export class ContextMenu {
  data = input.required<ContextMenuData>();
  close = output<void>();

  public engine = inject(CoreEngine);
  public appUi = inject(AppUiService);
  public terminal = inject(TerminalService);

  readonly commonGates: { type: LogicGateType; name: string }[] = [
    { type: 'AND', name: 'AND (Min)' },
    { type: 'OR', name: 'OR (Max)' },
    { type: 'NOT', name: 'NOT (Inverter)' },
    { type: 'XOR', name: 'XOR (Sum Mod 3)' },
    { type: 'FULLADDER', name: 'Full-Adder 3-Trits' },
    { type: 'MULTIPLIER', name: 'Multiplier 2x1' },
    { type: 'MUX', name: 'MUX Multiplexer' },
    { type: 'LATCH', name: 'LATCH Storage' },
    { type: 'COMPARATOR', name: '3-Way Comparator' },
    { type: 'NEURON', name: 'Neuron Perceptron' },
    { type: 'CLOCK', name: 'Clock Oscillator' },
    { type: 'CONSTANT', name: 'Constant Source' },
    { type: 'PROBE', name: 'Oscilloscope Probe' }
  ];

  targetNode = computed<EdenNode | null>(() => {
    const d = this.data();
    if (d.type !== 'NODE' || !d.targetId) return null;
    return (this.engine.genome().nodes as Record<string, EdenNode>)[d.targetId] || null;
  });

  targetEdge = computed<EdenEdge | null>(() => {
    const d = this.data();
    if (d.type !== 'EDGE' || !d.targetId) return null;
    return (this.engine.genome().edges as Record<string, EdenEdge>)[d.targetId] || null;
  });

  clampedX = computed(() => {
    const x = this.data().screenX;
    const menuWidth = 280;
    const maxX = typeof window !== 'undefined' ? window.innerWidth - menuWidth - 10 : 800;
    return Math.max(10, Math.min(maxX, x));
  });

  clampedY = computed(() => {
    const y = this.data().screenY;
    const menuHeight = 360;
    const maxY = typeof window !== 'undefined' ? window.innerHeight - menuHeight - 10 : 600;
    return Math.max(10, Math.min(maxY, y));
  });

  getTritLabel(state: TernaryValue): string {
    if (state === 'TRUE') return '+1 [TRUE]';
    if (state === 'FALSE') return '-1 [FALSE]';
    return '0 [UNKNOWN]';
  }

  onBackdropClick(e: MouseEvent) {
    this.close.emit();
  }

  @HostListener('window:keydown.escape')
  onEscape() {
    this.close.emit();
  }

  // Node Actions
  setNodeState(state: TernaryValue) {
    const id = this.data().targetId;
    if (id) this.engine.setNodeTernaryState(id, state);
    this.close.emit();
  }

  setGateType(gate: LogicGateType) {
    const id = this.data().targetId;
    if (id) this.engine.setNodeGateType(id, gate);
    this.close.emit();
  }

  resize(w: number, h: number) {
    const id = this.data().targetId;
    if (id) this.engine.resizeNode(id, w, h);
    this.close.emit();
  }

  attachProbe() {
    const id = this.data().targetId;
    if (id) this.engine.attachProbeToNode(id);
    this.close.emit();
  }

  duplicateNode() {
    const id = this.data().targetId;
    if (id) this.engine.duplicateNode(id);
    this.close.emit();
  }

  deleteNode() {
    const id = this.data().targetId;
    if (id) this.engine.deleteNode(id);
    this.close.emit();
  }

  // Edge Actions
  invertEdgeDirection() {
    const id = this.data().targetId;
    if (id) this.engine.invertEdge(id);
    this.close.emit();
  }

  insertNotGate() {
    const id = this.data().targetId;
    if (id) this.engine.insertNotGateOnEdge(id);
    this.close.emit();
  }

  deleteEdge() {
    const id = this.data().targetId;
    if (id) this.engine.deleteEdge(id);
    this.close.emit();
  }

  // Canvas Actions
  openComponentPalette() {
    this.appUi.toggleComponentPalette();
    this.close.emit();
  }

  autoLayout() {
    this.engine.autoLayout();
    this.close.emit();
  }

  toggleVM() {
    this.engine.toggleVM();
    this.close.emit();
  }

  openLogicAnalyzer() {
    this.appUi.toggleLogicAnalyzer();
    this.close.emit();
  }

  openCircuitLibrary() {
    this.appUi.toggleCircuitLibrary();
    this.close.emit();
  }

  async exportVerilog() {
    const code = this.engine.generateVerilogHdl();
    const success = await copyToClipboard(code);
    if (success) {
      this.terminal.log('Synthesizable Verilog HDL code copied to clipboard.', 'SYSTEM');
    } else {
      this.terminal.log('Generated Verilog HDL code (clipboard unavailable).', 'WARN');
    }
    this.close.emit();
  }

  clearCircuit() {
    this.engine.clearCircuit();
    this.close.emit();
  }
}
