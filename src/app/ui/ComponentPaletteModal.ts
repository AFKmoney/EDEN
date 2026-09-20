import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { CoreEngine } from '../core/CoreEngine';
import { AppUiService } from '../core/AppUiService';
import { LogicGateType, NodeType } from '../types/node';
import { WindowResizer } from '../core/WindowResizer';

interface PaletteItem {
  gateType: LogicGateType;
  title: string;
  category: 'sources' | 'logic' | 'arithmetic' | 'measurement';
  description: string;
  icon: string;
  type: NodeType;
  color: string;
}

@Component({
  selector: 'eden-component-palette',
  standalone: true,
  imports: [CommonModule, MatIconModule, DragDropModule],
  template: `
    <div id="component-palette-overlay"
         class="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-2 sm:p-4 animate-fade-in"
         (click)="close()">

      <div id="component-palette-card"
           cdkDrag cdkDragBoundary="body"
           [style.width.px]="resizer.width()"
           [style.height.px]="resizer.height()"
           [style.max-width]="resizer.isMaximized() ? '99vw' : '96vw'"
           [style.max-height]="resizer.isMaximized() ? '98vh' : '94vh'"
           class="relative bg-[#0b0f17] border border-emerald-500/20 rounded-2xl flex flex-col shadow-[0_0_50px_rgba(16,185,129,0.15)] overflow-hidden select-text"
           (click)="$event.stopPropagation()">

        <!-- Header -->
        <div cdkDragHandle
             class="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-white/[0.02] cursor-move select-none shrink-0">
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <mat-icon class="text-xl">add_box</mat-icon>
            </div>
            <div>
              <h2 class="text-sm font-bold text-white tracking-wide uppercase font-mono flex items-center gap-2">
                Ternary Component Palette
                <span class="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono">
                  Zero Overlap Guaranteed
                </span>
              </h2>
              <p class="text-xs text-zinc-400 font-mono mt-0.5">
                Click any component to insert it side-by-side with anti-collision protection
              </p>
            </div>
          </div>

          <div class="flex items-center gap-1.5">
            <!-- Maximize / Restore -->
            <button (click)="resizer.toggleMaximize()"
                    [title]="resizer.isMaximized() ? 'Restore size' : 'Maximize window'"
                    class="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer">
              <mat-icon class="text-lg">{{ resizer.isMaximized() ? 'filter_none' : 'crop_square' }}</mat-icon>
            </button>

            <!-- Close -->
            <button id="btn-close-palette"
                    (click)="close()"
                    class="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer">
              <mat-icon class="text-lg">close</mat-icon>
            </button>
          </div>
        </div>

        <!-- Body / Categories -->
        <div class="flex-1 p-6 overflow-y-auto space-y-6">

          <!-- Sources & Clocks -->
          <div>
            <div class="flex items-center gap-2 text-xs font-mono font-bold text-cyan-400 uppercase tracking-wider mb-3">
              <mat-icon class="text-sm">sensors</mat-icon>
              <span>Sources & Clocks</span>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
              @for (item of getCategory('sources'); track item.gateType) {
                <div class="bg-black/30 hover:bg-white/[0.04] border border-white/5 hover:border-cyan-500/40 rounded-xl p-3.5 transition-all flex flex-col justify-between group cursor-pointer"
                     (click)="addComponent(item)">
                  <div>
                    <div class="flex items-center justify-between mb-1.5">
                      <div class="flex items-center gap-2">
                        <div class="w-7 h-7 rounded-lg bg-cyan-500/10 text-cyan-400 flex items-center justify-center">
                          <mat-icon class="text-sm">{{ item.icon }}</mat-icon>
                        </div>
                        <span class="font-mono text-xs font-bold text-zinc-200 group-hover:text-cyan-300 transition-colors">{{ item.title }}</span>
                      </div>
                      <span class="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/5 text-zinc-400">{{ item.gateType }}</span>
                    </div>
                    <p class="text-[11px] text-zinc-400 leading-relaxed">{{ item.description }}</p>
                  </div>
                  <div class="mt-3 pt-2 border-t border-white/5 flex items-center justify-between text-[11px] font-mono text-cyan-400 font-bold">
                    <span>+ Insert</span>
                    <mat-icon class="text-sm group-hover:translate-x-1 transition-transform">arrow_forward</mat-icon>
                  </div>
                </div>
              }
            </div>
          </div>

          <!-- Kleene & Ternary Logic Gates -->
          <div>
            <div class="flex items-center gap-2 text-xs font-mono font-bold text-purple-400 uppercase tracking-wider mb-3">
              <mat-icon class="text-sm">alt_route</mat-icon>
              <span>Ternary Logic Gates (Kleene & Modulo-3)</span>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
              @for (item of getCategory('logic'); track item.gateType) {
                <div class="bg-black/30 hover:bg-white/[0.04] border border-white/5 hover:border-purple-500/40 rounded-xl p-3.5 transition-all flex flex-col justify-between group cursor-pointer"
                     (click)="addComponent(item)">
                  <div>
                    <div class="flex items-center justify-between mb-1.5">
                      <div class="flex items-center gap-2">
                        <div class="w-7 h-7 rounded-lg bg-purple-500/10 text-purple-400 flex items-center justify-center">
                          <mat-icon class="text-sm">{{ item.icon }}</mat-icon>
                        </div>
                        <span class="font-mono text-xs font-bold text-zinc-200 group-hover:text-purple-300 transition-colors">{{ item.title }}</span>
                      </div>
                      <span class="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/5 text-zinc-400">{{ item.gateType }}</span>
                    </div>
                    <p class="text-[11px] text-zinc-400 leading-relaxed">{{ item.description }}</p>
                  </div>
                  <div class="mt-3 pt-2 border-t border-white/5 flex items-center justify-between text-[11px] font-mono text-purple-400 font-bold">
                    <span>+ Insert</span>
                    <mat-icon class="text-sm group-hover:translate-x-1 transition-transform">arrow_forward</mat-icon>
                  </div>
                </div>
              }
            </div>
          </div>

          <!-- Arithmetic & Memory -->
          <div>
            <div class="flex items-center gap-2 text-xs font-mono font-bold text-emerald-400 uppercase tracking-wider mb-3">
              <mat-icon class="text-sm">memory</mat-icon>
              <span>Arithmetic & Balanced Storage</span>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
              @for (item of getCategory('arithmetic'); track item.gateType) {
                <div class="bg-black/30 hover:bg-white/[0.04] border border-white/5 hover:border-emerald-500/40 rounded-xl p-3.5 transition-all flex flex-col justify-between group cursor-pointer"
                     (click)="addComponent(item)">
                  <div>
                    <div class="flex items-center justify-between mb-1.5">
                      <div class="flex items-center gap-2">
                        <div class="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                          <mat-icon class="text-sm">{{ item.icon }}</mat-icon>
                        </div>
                        <span class="font-mono text-xs font-bold text-zinc-200 group-hover:text-emerald-300 transition-colors">{{ item.title }}</span>
                      </div>
                      <span class="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/5 text-zinc-400">{{ item.gateType }}</span>
                    </div>
                    <p class="text-[11px] text-zinc-400 leading-relaxed">{{ item.description }}</p>
                  </div>
                  <div class="mt-3 pt-2 border-t border-white/5 flex items-center justify-between text-[11px] font-mono text-emerald-400 font-bold">
                    <span>+ Insert</span>
                    <mat-icon class="text-sm group-hover:translate-x-1 transition-transform">arrow_forward</mat-icon>
                  </div>
                </div>
              }
            </div>
          </div>

          <!-- Measurement & Telemetry -->
          <div>
            <div class="flex items-center gap-2 text-xs font-mono font-bold text-amber-400 uppercase tracking-wider mb-3">
              <mat-icon class="text-sm">analytics</mat-icon>
              <span>Measurement, Telemetry & Probes</span>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
              @for (item of getCategory('measurement'); track item.gateType) {
                <div class="bg-black/30 hover:bg-white/[0.04] border border-white/5 hover:border-amber-500/40 rounded-xl p-3.5 transition-all flex flex-col justify-between group cursor-pointer"
                     (click)="addComponent(item)">
                  <div>
                    <div class="flex items-center justify-between mb-1.5">
                      <div class="flex items-center gap-2">
                        <div class="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center">
                          <mat-icon class="text-sm">{{ item.icon }}</mat-icon>
                        </div>
                        <span class="font-mono text-xs font-bold text-zinc-200 group-hover:text-amber-300 transition-colors">{{ item.title }}</span>
                      </div>
                      <span class="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/5 text-zinc-400">{{ item.gateType }}</span>
                    </div>
                    <p class="text-[11px] text-zinc-400 leading-relaxed">{{ item.description }}</p>
                  </div>
                  <div class="mt-3 pt-2 border-t border-white/5 flex items-center justify-between text-[11px] font-mono text-amber-400 font-bold">
                    <span>+ Insert</span>
                    <mat-icon class="text-sm group-hover:translate-x-1 transition-transform">arrow_forward</mat-icon>
                  </div>
                </div>
              }
            </div>
          </div>

        </div>

        <!-- Window Resize Handles -->
        @if (!resizer.isMaximized()) {
          <!-- Right edge -->
          <div (pointerdown)="resizer.onResizeStart($event, 'right')"
               class="absolute top-0 right-0 w-2 h-full cursor-ew-resize hover:bg-emerald-500/30 transition-colors z-20"
               title="Resize width"></div>
          <!-- Bottom edge -->
          <div (pointerdown)="resizer.onResizeStart($event, 'bottom')"
               class="absolute bottom-0 left-0 h-2 w-full cursor-ns-resize hover:bg-emerald-500/30 transition-colors z-20"
               title="Resize height"></div>
          <!-- Bottom-Right corner grip -->
          <div (pointerdown)="resizer.onResizeStart($event, 'corner')"
               class="absolute bottom-0 right-0 w-6 h-6 cursor-nwse-resize flex items-end justify-end p-1 text-zinc-500 hover:text-emerald-400 select-none z-30 transition-colors"
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
export class ComponentPaletteModal {
  public engine = inject(CoreEngine);
  public appUi = inject(AppUiService);

  public resizer = new WindowResizer({
    storageKey: 'component_palette',
    defaultWidth: 980,
    defaultHeight: 700,
    minWidth: 480,
    minHeight: 350
  });

  paletteItems: PaletteItem[] = [
    // Sources
    {
      gateType: 'CONSTANT',
      title: 'Fixed Trit Source',
      category: 'sources',
      description: 'Interactive test signal source (-1, 0, +1) with 1-click toggling.',
      icon: 'tune',
      type: 'Data',
      color: 'cyan'
    },
    {
      gateType: 'CLOCK',
      title: 'Master Clock',
      category: 'sources',
      description: 'Autonomous periodic oscillator (-1 -> 0 -> +1) pacing latches and registers.',
      icon: 'schedule',
      type: 'Data',
      color: 'cyan'
    },
    {
      gateType: 'LFSR',
      title: 'LFSR Generator',
      category: 'sources',
      description: 'Linear-feedback shift register generating a pseudo-random ternary stream.',
      icon: 'shuffle',
      type: 'Data',
      color: 'cyan'
    },

    // Logic
    {
      gateType: 'AND',
      title: 'AND Gate (Kleene Min)',
      category: 'logic',
      description: 'Min(A, B): Evaluates True (+1) only if both inputs are True.',
      icon: 'grain',
      type: 'Logic',
      color: 'purple'
    },
    {
      gateType: 'OR',
      title: 'OR Gate (Kleene Max)',
      category: 'logic',
      description: 'Max(A, B): Selects the highest logical level among inputs.',
      icon: 'merge',
      type: 'Logic',
      color: 'purple'
    },
    {
      gateType: 'NOT',
      title: 'Kleene Inverter',
      category: 'logic',
      description: 'Phase inversion: +1 becomes -1, -1 becomes +1, 0 stays neutral.',
      icon: 'compare_arrows',
      type: 'Logic',
      color: 'purple'
    },
    {
      gateType: 'XOR',
      title: 'Symmetric Sum Mod-3',
      category: 'logic',
      description: 'Balanced modulo-3 addition: the core foundation of the ternary half-adder.',
      icon: 'call_split',
      type: 'Logic',
      color: 'purple'
    },
    {
      gateType: 'CONSENSUS',
      title: 'Consensus Arbiter',
      category: 'logic',
      description: 'Fault-tolerant voter: validates majority agreement across computational channels.',
      icon: 'how_to_reg',
      type: 'Logic',
      color: 'purple'
    },
    {
      gateType: 'INVERTER',
      title: 'Cyclic Inverter',
      category: 'logic',
      description: 'Ternary cyclic rotation: shifts each state (-1 -> 0 -> +1 -> -1).',
      icon: 'autorenew',
      type: 'Logic',
      color: 'purple'
    },

    // Arithmetic & Memory
    {
      gateType: 'FULLADDER',
      title: 'Full-Adder (FA)',
      category: 'arithmetic',
      description: 'Computes A + B + Cin to generate Sum (-1,0,+1) and Carry-Out (Cout).',
      icon: 'calculate',
      type: 'Logic',
      color: 'emerald'
    },
    {
      gateType: 'ADDER',
      title: 'Half-Adder (HA)',
      category: 'arithmetic',
      description: 'Computes balanced A + B with simultaneous Carry output.',
      icon: 'functions',
      type: 'Logic',
      color: 'emerald'
    },
    {
      gateType: 'MULTIPLIER',
      title: '2x1 Trit Multiplier',
      category: 'arithmetic',
      description: 'Balanced A * B multiplication: (+1)*(+1)=+1, (-1)*(-1)=+1, (+1)*(-1)=-1.',
      icon: 'close',
      type: 'Logic',
      color: 'emerald'
    },
    {
      gateType: 'COMPARATOR',
      title: '3-Way Comparator',
      category: 'arithmetic',
      description: 'Evaluates A > B (+1), A == B (0), and A < B (-1) in a single step.',
      icon: 'balance',
      type: 'Logic',
      color: 'emerald'
    },
    {
      gateType: 'MUX',
      title: '3-Way Multiplexer',
      category: 'arithmetic',
      description: 'Routes 3 input channels based on the select trit value (-1, 0, +1).',
      icon: 'route',
      type: 'Logic',
      color: 'emerald'
    },
    {
      gateType: 'LATCH',
      title: 'Ternary Latch Register',
      category: 'arithmetic',
      description: 'Stores a trit upon clock pulse. The fundamental cell of ternary SRAM.',
      icon: 'save',
      type: 'Logic',
      color: 'emerald'
    },
    {
      gateType: 'NEURON',
      title: 'Neuromorphic Neuron',
      category: 'arithmetic',
      description: '3-state perceptron: excitatory (+1), resting potential (0), inhibitory (-1).',
      icon: 'psychology',
      type: 'Logic',
      color: 'emerald'
    },

    // Measurement
    {
      gateType: 'PROBE',
      title: 'Oscilloscope Probe',
      category: 'measurement',
      description: 'Monitors real-time waveforms and logs transitions on any circuit connection.',
      icon: 'show_chart',
      type: 'UI',
      color: 'amber'
    }
  ];

  getCategory(cat: 'sources' | 'logic' | 'arithmetic' | 'measurement') {
    return this.paletteItems.filter(i => i.category === cat);
  }

  addComponent(item: PaletteItem) {
    this.engine.addNodeOfType(item.gateType, item.title, item.type);
    this.close();
  }

  close() {
    this.appUi.toggleComponentPalette();
  }
}
