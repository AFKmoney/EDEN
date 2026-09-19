import { Component, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { CoreEngine } from '../core/CoreEngine';
import { AppUiService } from '../core/AppUiService';
import { CliUiService } from '../core/CliUiService';
import { TernaryAudioService } from '../core/TernaryAudioService';
import { EdenAiPipelineService } from '../core/EdenAiPipelineService';
import { EdenNode } from '../types/node';

@Component({
  selector: 'eden-telemetry-hud',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  template: `
    <div id="eden-telemetry-hud"
         class="fixed left-1/2 -translate-x-1/2 z-40 bg-[#0c0d12]/95 border border-white/10 rounded-2xl shadow-2xl backdrop-blur-xl px-3.5 py-2 flex items-center gap-3 transition-all duration-300 max-w-[calc(100vw-360px)] overflow-x-auto text-xs font-mono select-none custom-scrollbar"
         [style.bottom]="appUi.isTerminalOpen() ? '312px' : '16px'">
      
      <!-- VM Running / Pause Controller -->
      <div class="flex items-center gap-2 pr-3 border-r border-white/10">
        <button id="hud-toggle-vm"
                (click)="toggleVm()"
                [title]="engine.isVmRunning() ? 'Pause Virtual Machine' : 'Start Virtual Machine'"
                [ngClass]="engine.isVmRunning() ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/30' : 'bg-amber-500/20 text-amber-400 border-amber-500/40 hover:bg-amber-500/30'"
                class="w-7 h-7 rounded-lg border flex items-center justify-center transition-colors">
          <mat-icon class="text-base">{{ engine.isVmRunning() ? 'pause' : 'play_arrow' }}</mat-icon>
        </button>

        <button id="hud-step-vm"
                (click)="stepVm()"
                title="Advance 1 Clock Cycle"
                class="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-300 flex items-center justify-center transition-colors">
          <mat-icon class="text-base">skip_next</mat-icon>
        </button>

        <div class="flex flex-col">
          <span class="text-[9px] text-zinc-500 uppercase font-semibold tracking-wider">VM Cycle</span>
          <span class="text-zinc-200 font-bold tabular-nums">#{{ engine.vmCycles() }}</span>
        </div>
      </div>

      <!-- Real-Time Shannon Entropy & Net Charge -->
      <div class="flex items-center gap-3 pr-3 border-r border-white/10">
        <div class="flex flex-col">
          <span class="text-[9px] text-zinc-500 uppercase font-semibold tracking-wider">Entropy H3</span>
          <span class="text-cyan-400 font-bold tabular-nums">{{ shannonEntropy() }}</span>
        </div>

        <div class="flex flex-col">
          <span class="text-[9px] text-zinc-500 uppercase font-semibold tracking-wider">Charge ∑T</span>
          <span [ngClass]="netCharge() > 0 ? 'text-emerald-400' : netCharge() < 0 ? 'text-rose-400' : 'text-zinc-400'"
                class="font-bold tabular-nums">
            {{ netCharge() > 0 ? '+' : '' }}{{ netCharge() }}
          </span>
        </div>
      </div>

      <!-- Trit Balance Distribution Bar -->
      <div class="flex items-center gap-2 pr-3 border-r border-white/10">
        <div class="flex flex-col">
          <span class="text-[9px] text-zinc-500 uppercase font-semibold tracking-wider flex items-center justify-between gap-2">
            <span>Distribution</span>
            <span class="text-zinc-400 font-normal">{{ totalNodes() }} Nodes</span>
          </span>
          <div class="flex items-center gap-1 mt-0.5">
            <span class="px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-400 text-[10px] font-bold border border-rose-500/30">
              -1: {{ tritCounts().falseCount }}
            </span>
            <span class="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 text-[10px] font-bold border border-zinc-700">
              0: {{ tritCounts().unknownCount }}
            </span>
            <span class="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[10px] font-bold border border-emerald-500/30">
              +1: {{ tritCounts().trueCount }}
            </span>
          </div>
        </div>
      </div>

      <!-- Audio Sonification Toggle -->
      <div class="flex items-center pr-3 border-r border-white/10">
        <button id="hud-toggle-audio"
                (click)="toggleAudio()"
                [title]="audio.isAudioActive() ? 'Mute harmonic sound' : 'Enable acoustic sonification'"
                [ngClass]="audio.isAudioActive() ? 'bg-purple-500/20 text-purple-400 border-purple-500/40' : 'bg-white/5 text-zinc-400 border-white/10'"
                class="px-2.5 py-1 rounded-lg border flex items-center gap-1.5 transition-colors cursor-pointer">
          <mat-icon class="text-sm">{{ audio.isAudioActive() ? 'volume_up' : 'volume_off' }}</mat-icon>
          <span class="text-[11px]">{{ audio.isAudioActive() ? 'Sound ON' : 'Sound OFF' }}</span>
        </button>
      </div>

      <!-- Quick Modal Openers -->
      <div class="flex items-center gap-1.5">
        <button id="hud-open-truth-table"
                (click)="appUi.toggleTruthTable()"
                title="Truth Table & Formal Verification"
                class="px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/20 flex items-center gap-1 transition-colors cursor-pointer">
          <mat-icon class="text-sm">analytics</mat-icon>
          <span class="text-[11px]">Truth Table</span>
        </button>

        <button id="hud-open-tasm"
                (click)="appUi.toggleTasmStudio()"
                title="TASM Studio & Verilog / C++ Transpiler"
                class="px-2.5 py-1 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/20 flex items-center gap-1 transition-colors cursor-pointer">
          <mat-icon class="text-sm">terminal</mat-icon>
          <span class="text-[11px]">TASM Studio</span>
        </button>

        <button id="hud-btn-alu"
                (click)="synthesizeAlu()"
                title="Synthesize Full Balanced Ternary ALU"
                class="px-2.5 py-1 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/20 flex items-center gap-1 transition-colors cursor-pointer">
          <mat-icon class="text-sm">memory</mat-icon>
          <span class="text-[11px]">ALU</span>
        </button>

        <button id="hud-btn-neuron"
                (click)="synthesizeNeuron()"
                title="Synthesize Neuromorphic Perceptron"
                class="px-2.5 py-1 rounded-lg bg-pink-500/10 hover:bg-pink-500/20 text-pink-300 border border-pink-500/20 flex items-center gap-1 transition-colors cursor-pointer">
          <mat-icon class="text-sm">hub</mat-icon>
          <span class="text-[11px]">Neuron</span>
        </button>

        <button id="hud-open-copilot"
                (click)="cliUi.toggle()"
                title="EDEN AI Copilot (Chat & OS Control)"
                class="px-2.5 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5 transition-colors cursor-pointer shrink-0">
          <mat-icon class="text-sm text-emerald-400">psychology</mat-icon>
          <span class="text-[11px] font-bold">AI Copilot</span>
        </button>
      </div>

    </div>
  `
})
export class TelemetryHud {
  public engine = inject(CoreEngine);
  public appUi = inject(AppUiService);
  public cliUi = inject(CliUiService);
  public audio = inject(TernaryAudioService);
  public ai = inject(EdenAiPipelineService);

  totalNodes = computed(() => Object.keys(this.engine.genome().nodes).length);

  tritCounts = computed(() => {
    const nodes = Object.values(this.engine.genome().nodes) as EdenNode[];
    let trueCount = 0;
    let falseCount = 0;
    let unknownCount = 0;

    for (const n of nodes) {
      if (n.ternaryState === 'TRUE') trueCount++;
      else if (n.ternaryState === 'FALSE') falseCount++;
      else unknownCount++;
    }

    return { trueCount, falseCount, unknownCount };
  });

  netCharge = computed(() => {
    const counts = this.tritCounts();
    return counts.trueCount - counts.falseCount;
  });

  shannonEntropy = computed(() => {
    const counts = this.tritCounts();
    const total = counts.trueCount + counts.falseCount + counts.unknownCount;
    if (total === 0) return '0.00';

    const pT = counts.trueCount / total;
    const pF = counts.falseCount / total;
    const pU = counts.unknownCount / total;

    let h = 0;
    if (pT > 0) h -= pT * Math.log2(pT);
    if (pF > 0) h -= pF * Math.log2(pF);
    if (pU > 0) h -= pU * Math.log2(pU);

    // Normalize by log2(3) = 1.58496
    const normalized = h / 1.58496;
    return normalized.toFixed(2);
  });

  toggleVm() {
    if (this.engine.isVmRunning()) {
      this.engine.stopVM();
    } else {
      this.engine.startVM();
    }
  }

  stepVm() {
    this.engine.stepVM();
  }

  toggleAudio() {
    this.audio.toggleAudio();
  }

  synthesizeAlu() {
    this.engine.synthesizeTernaryAlu();
  }

  synthesizeNeuron() {
    this.engine.synthesizeTernaryNeuron();
  }
}
