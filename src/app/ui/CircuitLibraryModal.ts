import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { CoreEngine } from '../core/CoreEngine';
import { AppUiService } from '../core/AppUiService';
import { TerminalService } from '../core/TerminalService';
import { copyToClipboard } from '../core/ClipboardUtil';
import { WindowResizer } from '../core/WindowResizer';

interface CircuitPreset {
  id: string;
  name: string;
  category: string;
  description: string;
  action: () => void;
  icon: string;
  complexity: string;
}

@Component({
  selector: 'eden-circuit-library',
  standalone: true,
  imports: [CommonModule, MatIconModule, DragDropModule],
  template: `
    <div id="circuit-library-overlay"
         class="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-2 sm:p-4 animate-fade-in"
         (click)="close()">

      <div id="circuit-library-card"
           cdkDrag cdkDragBoundary="body"
           [style.width.px]="resizer.width()"
           [style.height.px]="resizer.height()"
           [style.max-width]="resizer.isMaximized() ? '99vw' : '96vw'"
           [style.max-height]="resizer.isMaximized() ? '98vh' : '94vh'"
           class="relative bg-[#0b0f17] border border-purple-500/20 rounded-2xl flex flex-col shadow-[0_0_50px_rgba(168,85,247,0.15)] overflow-hidden select-text"
           (click)="$event.stopPropagation()">

        <!-- Header -->
        <div cdkDragHandle
             class="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-white/[0.02] cursor-move select-none shrink-0">
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <mat-icon class="text-xl">developer_board</mat-icon>
            </div>
            <div>
              <h2 class="text-sm font-bold text-white tracking-wide uppercase font-mono flex items-center gap-2">
                Circuit & Architecture Library
                <span class="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-mono">
                  1-Click Synthesis
                </span>
              </h2>
              <p class="text-xs text-zinc-400 font-mono mt-0.5">
                Real hardware architectures implemented in balanced ternary logic (-1, 0, +1)
              </p>
            </div>
          </div>

          <!-- Quick Import/Export Toolbar -->
          <div class="flex items-center gap-2">
            <input #fileInput type="file" accept=".json" class="hidden" (change)="onFileSelected($event)" />

            <button (click)="fileInput.click()"
                    title="Import circuit from JSON file"
                    class="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-300 border border-white/5 text-xs font-mono flex items-center gap-1 transition-colors cursor-pointer">
              <mat-icon class="text-sm">upload</mat-icon>
              <span>Import</span>
            </button>

            <button (click)="exportJson()"
                    title="Export active circuit to JSON"
                    class="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-300 border border-white/5 text-xs font-mono flex items-center gap-1 transition-colors cursor-pointer">
              <mat-icon class="text-sm">download</mat-icon>
              <span>Export JSON</span>
            </button>

            <button (click)="exportVerilog()"
                    title="Generate and copy synthesizable Verilog HDL"
                    class="px-2.5 py-1.5 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-xs font-mono flex items-center gap-1 transition-colors cursor-pointer">
              <mat-icon class="text-sm">{{ isVerilogCopied() ? 'check' : 'code' }}</mat-icon>
              <span>{{ isVerilogCopied() ? 'Copied!' : 'Verilog HDL' }}</span>
            </button>

            <!-- Maximize / Restore -->
            <button (click)="resizer.toggleMaximize()"
                    [title]="resizer.isMaximized() ? 'Restore size' : 'Maximize window'"
                    class="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer">
              <mat-icon class="text-lg">{{ resizer.isMaximized() ? 'filter_none' : 'crop_square' }}</mat-icon>
            </button>

            <button id="btn-close-circuit-lib"
                    (click)="close()"
                    class="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer">
              <mat-icon class="text-lg">close</mat-icon>
            </button>
          </div>
        </div>

        <!-- Grid of Useful Circuits -->
        <div class="flex-1 p-6 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-4">
          @for (c of circuits; track c.id) {
            <div class="bg-black/35 border border-white/5 hover:border-purple-500/40 rounded-xl p-4 transition-all flex flex-col justify-between group">
              <div>
                <div class="flex items-start justify-between gap-3 mb-2">
                  <div class="flex items-center gap-2.5">
                    <div class="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-400 flex items-center justify-center shrink-0">
                      <mat-icon class="text-base">{{ c.icon }}</mat-icon>
                    </div>
                    <div>
                      <h3 class="font-mono text-xs font-bold text-white group-hover:text-purple-300 transition-colors">{{ c.name }}</h3>
                      <span class="text-[10px] font-mono text-zinc-500">{{ c.category }}</span>
                    </div>
                  </div>
                  <span class="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/5 text-zinc-400 border border-white/5">
                    {{ c.complexity }}
                  </span>
                </div>
                <p class="text-xs text-zinc-400 leading-relaxed font-sans">
                  {{ c.description }}
                </p>
              </div>

              <div class="mt-4 pt-3 border-t border-white/5 flex items-center justify-between">
                <span class="text-[11px] font-mono text-emerald-400 flex items-center gap-1">
                  <mat-icon class="text-xs">check_circle</mat-icon>
                  Zero Overlap
                </span>
                <button (click)="loadPreset(c)"
                        class="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-mono text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer">
                  <span>Synthesize</span>
                  <mat-icon class="text-sm">bolt</mat-icon>
                </button>
              </div>
            </div>
          }
        </div>

        <!-- Window Resize Handles -->
        @if (!resizer.isMaximized()) {
          <div (pointerdown)="resizer.onResizeStart($event, 'right')"
               class="absolute top-0 right-0 w-2 h-full cursor-ew-resize hover:bg-purple-500/30 transition-colors z-20"
               title="Resize width"></div>
          <div (pointerdown)="resizer.onResizeStart($event, 'bottom')"
               class="absolute bottom-0 left-0 h-2 w-full cursor-ns-resize hover:bg-purple-500/30 transition-colors z-20"
               title="Resize height"></div>
          <div (pointerdown)="resizer.onResizeStart($event, 'corner')"
               class="absolute bottom-0 right-0 w-6 h-6 cursor-nwse-resize flex items-end justify-end p-1 text-zinc-500 hover:text-purple-400 select-none z-30 transition-colors"
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
export class CircuitLibraryModal {
  public engine = inject(CoreEngine);
  public appUi = inject(AppUiService);
  public terminal = inject(TerminalService);

  public resizer = new WindowResizer({
    storageKey: 'circuit_library',
    defaultWidth: 980,
    defaultHeight: 700,
    minWidth: 480,
    minHeight: 350
  });

  isVerilogCopied = signal(false);

  circuits: CircuitPreset[] = [
    {
      id: 'full_adder',
      name: 'Ternary Full-Adder (FA)',
      category: 'Arithmetic & ALU',
      description: 'Adds three trits (A + B + Cin) to produce balanced Sum and Carry-Out (Cout). The physical hardware foundation of any ternary CPU.',
      action: () => this.engine.synthesizeFullAdder(),
      icon: 'calculate',
      complexity: '6 Nodes / 5 Wires'
    },
    {
      id: 'half_adder',
      name: 'Ternary Half-Adder (HA)',
      category: 'Arithmetic & ALU',
      description: 'Adds two trits (A + B) using balanced modulo-3 XOR sum and consensus carry logic.',
      action: () => this.engine.synthesizeHalfAdder(),
      icon: 'functions',
      complexity: '6 Nodes / 4 Wires'
    },
    {
      id: 'multiplier',
      name: 'Balanced 2x1 Trit Multiplier',
      category: 'Scientific Computing',
      description: 'Performs direct A * B multiplication without separate sign bits, enabling ultra-low-power tensor and convolution operations.',
      action: () => this.engine.synthesizeTernaryMultiplier(),
      icon: 'close',
      complexity: '4 Nodes / 3 Wires'
    },
    {
      id: 'consensus_tmr',
      name: 'Triple Modular Redundancy (TMR) Arbiter',
      category: 'Fault Tolerance & Aerospace',
      description: 'Mission-critical voting logic: 3 redundant sensor channels with consensus arbitration to eliminate single-event radiation upsets.',
      action: () => this.engine.synthesizeConsensusArbiter(),
      icon: 'how_to_reg',
      complexity: '5 Nodes / 4 Wires'
    },
    {
      id: 'ternary_alu',
      name: 'Complete Ternary ALU',
      category: 'CPU Architecture',
      description: 'Arithmetic Logic Unit: balanced addition, 3-way comparison, cyclic shift, and bus multiplexing controlled by instruction opcode.',
      action: () => this.engine.synthesizeTernaryAlu(),
      icon: 'memory',
      complexity: '8 Nodes / 7 Wires'
    },
    {
      id: 'memory_word',
      name: 'RAM Word Cell & Latch Register',
      category: 'Memory & Storage',
      description: 'Synchronous edge-triggered storage cell with write-enable gating and dedicated read bus.',
      action: () => this.engine.synthesizeTernaryMemoryWord(),
      icon: 'save',
      complexity: '6 Nodes / 5 Wires'
    },
    {
      id: 'perceptron',
      name: 'Ternary Neuromorphic Perceptron',
      category: 'Artificial Intelligence',
      description: 'Spiking neural element (-1 inhibition, 0 rest, +1 excitation) computing a ternary synaptic dot-product.',
      action: () => this.engine.synthesizeNeuromorphicPerceptron(),
      icon: 'psychology',
      complexity: '6 Nodes / 5 Wires'
    },
    {
      id: 'lfsr_crypto',
      name: 'Pseudo-Random Trit Generator (LFSR)',
      category: 'Cryptography & RNG',
      description: 'Ternary Galois polynomial producing a maximum-length pseudo-random sequence for hardware cryptography.',
      action: () => this.engine.synthesizeTernaryLfsr(),
      icon: 'shuffle',
      complexity: '5 Nodes / 4 Wires'
    },
    {
      id: 'oscillator',
      name: 'Odd-Stage Ring Oscillator',
      category: 'Clock & Signal Generation',
      description: 'Odd-phase cyclical feedback loop generating an autonomous ternary square wave without external timing.',
      action: () => this.engine.synthesizeRingOscillator(),
      icon: 'loop',
      complexity: '5 Nodes / 4 Wires'
    },
    {
      id: 'logic_bench',
      name: 'Universal Logic Evaluation Bench',
      category: 'Formal Verification',
      description: 'Dual-mirror comparator testing Kleene AND, OR, and XOR gates simultaneously for comprehensive truth table validation.',
      action: () => this.engine.synthesizeLogicBench(),
      icon: 'science',
      complexity: '7 Nodes / 6 Wires'
    }
  ];

  loadPreset(c: CircuitPreset) {
    c.action();
    this.close();
  }

  close() {
    this.appUi.toggleCircuitLibrary();
  }

  exportJson() {
    const json = this.engine.exportCircuitJson();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `eden_circuit_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async exportVerilog() {
    const verilog = this.engine.generateVerilogHdl();
    const success = await copyToClipboard(verilog);
    if (success) {
      this.isVerilogCopied.set(true);
      this.terminal.log('Synthesizable Verilog HDL exported and copied to clipboard.', 'SYSTEM');
      setTimeout(() => this.isVerilogCopied.set(false), 2500);
    } else {
      this.terminal.log('Generated Verilog HDL (unable to access clipboard in current frame).', 'WARN');
    }
  }

  onFileSelected(event: any) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (content) {
        this.engine.importCircuitJson(content);
        this.close();
      }
    };
    reader.readAsText(file);
  }
}
