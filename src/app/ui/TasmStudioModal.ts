import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { AppUiService } from '../core/AppUiService';
import { CoreEngine } from '../core/CoreEngine';
import { TasmCompilerService } from '../core/TasmCompilerService';
import { TerminalService } from '../core/TerminalService';
import { copyToClipboard } from '../core/ClipboardUtil';
import { WindowResizer } from '../core/WindowResizer';

type TranspileTarget = 'tasm' | 'verilog' | 'cpp';

@Component({
  selector: 'eden-tasm-studio-modal',
  standalone: true,
  imports: [CommonModule, MatIconModule, DragDropModule],
  template: `
    <div id="tasm-studio-overlay" 
         class="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-2 sm:p-4 animate-fade-in"
         (click)="close()">
      
      <div id="tasm-studio-card"
           cdkDrag cdkDragBoundary="body"
           [style.width.px]="resizer.width()"
           [style.height.px]="resizer.height()"
           [style.max-width]="resizer.isMaximized() ? '99vw' : '96vw'"
           [style.max-height]="resizer.isMaximized() ? '98vh' : '94vh'"
           class="relative bg-[#0f1117] border border-white/10 rounded-2xl flex flex-col shadow-2xl overflow-hidden select-text"
           (click)="$event.stopPropagation()">
        
        <!-- Header -->
        <div cdkDragHandle
             class="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-white/[0.02] cursor-move select-none shrink-0">
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <mat-icon class="text-lg">terminal</mat-icon>
            </div>
            <div>
              <h2 class="text-sm font-semibold text-white tracking-tight flex items-center gap-2">
                TASM Studio & Hardware Transpiler
                <span class="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-mono">
                  Ternary Assembly v3.0
                </span>
              </h2>
              <p class="text-xs text-zinc-400">
                Balanced ternary assembly editor, synthesizable Verilog HDL & C++20 transpiler
              </p>
            </div>
          </div>

          <div class="flex items-center gap-2">
            <!-- Target selector tabs -->
            <div class="flex items-center bg-black/50 p-0.5 rounded-lg border border-white/10 text-xs font-mono">
              <button (click)="activeTarget.set('tasm')"
                      [ngClass]="activeTarget() === 'tasm' ? 'bg-cyan-500 text-black font-bold shadow-sm' : 'text-zinc-400 hover:text-white'"
                      class="px-2.5 py-1 rounded transition-colors cursor-pointer">
                TASM
              </button>
              <button (click)="switchToVerilog()"
                      [ngClass]="activeTarget() === 'verilog' ? 'bg-cyan-500 text-black font-bold shadow-sm' : 'text-zinc-400 hover:text-white'"
                      class="px-2.5 py-1 rounded transition-colors cursor-pointer">
                Verilog HDL
              </button>
              <button (click)="switchToCpp()"
                      [ngClass]="activeTarget() === 'cpp' ? 'bg-cyan-500 text-black font-bold shadow-sm' : 'text-zinc-400 hover:text-white'"
                      class="px-2.5 py-1 rounded transition-colors cursor-pointer">
                C++20 VM
              </button>
            </div>

            <!-- Maximize / Restore -->
            <button (click)="resizer.toggleMaximize()"
                    [title]="resizer.isMaximized() ? 'Restore size' : 'Maximize window'"
                    class="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer">
              <mat-icon class="text-lg">{{ resizer.isMaximized() ? 'filter_none' : 'crop_square' }}</mat-icon>
            </button>

            <button id="btn-close-tasm"
                    (click)="close()"
                    class="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer">
              <mat-icon class="text-lg">close</mat-icon>
            </button>
          </div>
        </div>

        <!-- Preset Templates Selector & Actions Bar -->
        <div class="px-6 py-2.5 bg-black/40 border-b border-white/5 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
          <div class="flex items-center gap-2">
            <span class="text-zinc-500 text-[11px]">TASM Templates:</span>
            <select (change)="loadPreset($event)" 
                    class="bg-black/60 border border-white/10 rounded-lg px-2.5 py-1 text-xs text-zinc-300 outline-none focus:border-cyan-500">
              <option value="half_adder">Balanced Ternary Half-Adder</option>
              <option value="alu">Full Balanced Ternary ALU</option>
              <option value="neuron">3-Synapse Neuromorphic Perceptron</option>
              <option value="ram_word">RAM Word (3-Trit Latch Register)</option>
              <option value="decision_tree">3-Way Ternary Decision Engine</option>
              <option value="oscillator">3-Stage Odd Ring Oscillator</option>
              <option value="lfsr">Ternary LFSR Random Generator</option>
            </select>
          </div>

          <div class="flex items-center gap-2">
            @if (activeTarget() === 'tasm') {
              <button id="btn-decompile-canvas"
                      (click)="decompileCurrentGraph()"
                      class="px-2.5 py-1 rounded bg-white/5 hover:bg-white/10 text-zinc-300 text-xs flex items-center gap-1.5 border border-white/5 transition-colors">
                <mat-icon class="text-sm">code</mat-icon>
                <span>Decompile Canvas</span>
              </button>
              <button id="btn-compile-to-os"
                      (click)="compileToOsCircuit()"
                      class="px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs flex items-center gap-1.5 shadow-sm transition-colors">
                <mat-icon class="text-sm">play_arrow</mat-icon>
                <span>Compile to OS</span>
              </button>
            } @else {
              <button (click)="copyCode()"
                      class="px-2.5 py-1 rounded bg-white/5 hover:bg-white/10 text-zinc-300 text-xs flex items-center gap-1.5 border border-white/5 transition-colors">
                <mat-icon class="text-sm">content_copy</mat-icon>
                <span>{{ isCopied() ? 'Copied!' : 'Copy' }}</span>
              </button>
              <button (click)="downloadCode()"
                      class="px-3 py-1 rounded bg-cyan-600 hover:bg-cyan-500 text-white font-medium text-xs flex items-center gap-1.5 shadow-sm transition-colors">
                <mat-icon class="text-sm">download</mat-icon>
                <span>Export File</span>
              </button>
            }
          </div>
        </div>

        <!-- Code Editor Area -->
        <div class="flex-1 p-6 overflow-hidden flex flex-col">
          <div class="relative flex-1 rounded-xl border border-white/10 bg-black/60 overflow-hidden flex flex-col font-mono text-xs">
            <div class="px-4 py-1.5 bg-white/[0.02] border-b border-white/5 text-[10px] text-zinc-500 flex items-center justify-between">
              <span>{{ getFileName() }}</span>
              <span>Lines: {{ getLineCount() }}</span>
            </div>
            
            <textarea
              id="tasm-code-editor"
              [value]="displayedCode()"
              (input)="onCodeChange($event)"
              [readonly]="activeTarget() !== 'tasm'"
              spellcheck="false"
              class="flex-1 w-full p-4 bg-transparent text-zinc-200 outline-none resize-none font-mono leading-relaxed selection:bg-cyan-500/30 selection:text-white focus:ring-0"
              placeholder="; Enter your TASM code here..."
            ></textarea>
          </div>

          @if (compileError()) {
            <div class="mt-3 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-xs font-mono flex items-center gap-2">
              <mat-icon class="text-sm">error</mat-icon>
              <span>{{ compileError() }}</span>
            </div>
          }
          @if (compileSuccess()) {
            <div class="mt-3 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-mono flex items-center gap-2">
              <mat-icon class="text-sm">check_circle</mat-icon>
              <span>{{ compileSuccess() }}</span>
            </div>
          }
        </div>

        <!-- Footer documentation -->
        <div class="px-6 py-3 border-t border-white/10 bg-white/[0.02] flex items-center justify-between text-xs text-zinc-500 font-mono">
          <div class="flex items-center gap-3 text-[11px]">
            <span class="text-zinc-400">Commandes TASM:</span>
            <span><code>INPUT &lt;id&gt;, &lt;val&gt;</code></span>
            <span><code>GATE &lt;id&gt;, &lt;type&gt;, &lt;in1&gt;, &lt;in2&gt;</code></span>
            <span><code>PROBE &lt;id&gt;, &lt;src&gt;</code></span>
          </div>
          <span class="text-[10px] text-zinc-600">Dual-Rail Verilog Synthesizable</span>
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
export class TasmStudioModal implements OnInit {
  private appUi = inject(AppUiService);
  private engine = inject(CoreEngine);
  private tasm = inject(TasmCompilerService);
  private terminal = inject(TerminalService);

  public resizer = new WindowResizer({
    storageKey: 'tasm_studio',
    defaultWidth: 980,
    defaultHeight: 700,
    minWidth: 500,
    minHeight: 360
  });

  activeTarget = signal<TranspileTarget>('tasm');
  tasmCode = signal<string>('');
  verilogCode = signal<string>('');
  cppCode = signal<string>('');

  compileError = signal<string | null>(null);
  compileSuccess = signal<string | null>(null);
  isCopied = signal<boolean>(false);

  ngOnInit() {
    this.decompileCurrentGraph();
  }

  close() {
    this.appUi.isTasmStudioOpen.set(false);
  }

  displayedCode(): string {
    const t = this.activeTarget();
    if (t === 'verilog') return this.verilogCode();
    if (t === 'cpp') return this.cppCode();
    return this.tasmCode();
  }

  onCodeChange(event: Event) {
    const val = (event.target as HTMLTextAreaElement).value;
    if (this.activeTarget() === 'tasm') {
      this.tasmCode.set(val);
      this.compileError.set(null);
      this.compileSuccess.set(null);
    }
  }

  switchToVerilog() {
    const genome = this.engine.genome();
    const v = this.tasm.transpileToVerilog(genome.nodes, genome.edges);
    this.verilogCode.set(v);
    this.activeTarget.set('verilog');
  }

  switchToCpp() {
    const genome = this.engine.genome();
    const c = this.tasm.transpileToCpp(genome.nodes, genome.edges);
    this.cppCode.set(c);
    this.activeTarget.set('cpp');
  }

  decompileCurrentGraph() {
    const genome = this.engine.genome();
    const code = this.tasm.decompile(genome.nodes, genome.edges);
    this.tasmCode.set(code);
    this.activeTarget.set('tasm');
    this.compileSuccess.set(`Decompiled successfully: ${Object.keys(genome.nodes).length} nodes exported.`);
  }

  compileToOsCircuit() {
    this.compileError.set(null);
    this.compileSuccess.set(null);

    const res = this.tasm.compile(this.tasmCode());
    if (!res.success) {
      this.compileError.set(res.error || 'Syntax error');
      return;
    }

    this.engine.saveSnapshot();
    this.engine.mutate({ nodes: res.nodes, edges: res.edges });
    this.terminal.log(`[TASM] Circuit compiled: ${res.nodeCount} nodes, ${res.edgeCount} connections.`, 'TERNARY');
    this.compileSuccess.set(`Circuit injected successfully into OS (${res.nodeCount} nodes, ${res.edgeCount} connections)!`);
    if (!this.engine.isVmRunning()) this.engine.startVM();
  }

  loadPreset(event: Event) {
    const val = (event.target as HTMLSelectElement).value;
    let code = '';
    switch (val) {
      case 'half_adder':
        code = `; --- BALANCED TERNARY HALF ADDER ---
INPUT a, TRUE
INPUT b, FALSE
GATE sum, XOR, a, b
GATE carry, CONSENSUS, a, b
PROBE out_sum, sum
PROBE out_carry, carry`;
        break;
      case 'alu':
        code = `; --- BALANCED TERNARY ALU ---
INPUT op_a, TRUE
INPUT op_b, FALSE
INPUT opcode, UNKNOWN
GATE add_unit, ADDER, op_a, op_b
GATE cmp_unit, COMPARATOR, op_a, op_b
GATE xor_unit, XOR, op_a, op_b
GATE alu_mux, MUX, opcode, add_unit, cmp_unit, xor_unit
PROBE result, alu_mux`;
        break;
      case 'neuron':
        code = `; --- NEUROMORPHIC PERCEPTRON ---
INPUT w1, TRUE
INPUT w2, UNKNOWN
INPUT w3, FALSE
GATE soma, NEURON, w1, w2, w3
GATE axon_inv, NOT, soma
PROBE spike_train, axon_inv`;
        break;
      case 'ram_word':
        code = `; --- 3-TRIT STATIC RAM WORD ---
GATE clk, CLOCK
INPUT d0, TRUE
INPUT d1, UNKNOWN
INPUT d2, FALSE
GATE r0, LATCH, clk, d0
GATE r1, LATCH, clk, d1
GATE r2, LATCH, clk, d2
PROBE bus, r0`;
        break;
      case 'decision_tree':
        code = `; --- 3-WAY DECISION TREE ---
INPUT condition, UNKNOWN
INPUT abort_action, FALSE
INPUT idle_action, UNKNOWN
INPUT commit_action, TRUE
GATE router, MUX, condition, abort_action, idle_action, commit_action
PROBE decision_out, router`;
        break;
      case 'oscillator':
        code = `; --- 3-STAGE RING OSCILLATOR ---
GATE n1, NOT, n3
GATE n2, NOT, n1
GATE n3, NOT, n2
PROBE pulse, n1`;
        break;
      case 'lfsr':
        code = `; --- TERNARY LFSR STREAM GENERATOR ---
GATE master_clk, CLOCK
GATE lfsr_core, LFSR, master_clk, inverter
GATE inverter, INVERTER, lfsr_core
PROBE stream, lfsr_core`;
        break;
    }

    this.tasmCode.set(code);
    this.activeTarget.set('tasm');
    this.compileSuccess.set('Modèle chargé dans l\'éditeur.');
  }

  getFileName(): string {
    const t = this.activeTarget();
    if (t === 'verilog') return 'eden_ternary_core.v';
    if (t === 'cpp') return 'EdenTernaryCircuit.hpp';
    return 'circuit.tasm';
  }

  getLineCount(): number {
    return this.displayedCode().split('\n').length;
  }

  async copyCode() {
    const success = await copyToClipboard(this.displayedCode());
    if (success) {
      this.isCopied.set(true);
      this.terminal.log(`[TASM] Code copied to clipboard (${this.getFileName()}).`, 'SYSTEM');
      setTimeout(() => this.isCopied.set(false), 2000);
    } else {
      this.terminal.log('[TASM] Unable to write to clipboard in this environment.', 'WARN');
    }
  }

  downloadCode() {
    const text = this.displayedCode();
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = this.getFileName();
    a.click();
    URL.revokeObjectURL(url);
  }
}
