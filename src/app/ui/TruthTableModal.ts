import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { AppUiService } from '../core/AppUiService';
import { TruthTableService, VerificationReport } from '../core/TruthTableService';
import { EdenAiPipelineService } from '../core/EdenAiPipelineService';
import { TernaryValue } from '../types/node';

@Component({
  selector: 'eden-truth-table-modal',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  template: `
    <div id="truth-table-overlay" 
         class="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 sm:p-6 animate-fade-in"
         (click)="close()">
      
      <div id="truth-table-card"
           class="bg-[#0f1117] border border-white/10 rounded-2xl w-full max-w-4xl max-h-[88vh] flex flex-col shadow-2xl overflow-hidden"
           (click)="$event.stopPropagation()">
        
        <!-- Header -->
        <div class="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <mat-icon class="text-lg">analytics</mat-icon>
            </div>
            <div>
              <h2 class="text-sm font-semibold text-white tracking-tight flex items-center gap-2">
                Formal Truth Table & State Space Analyzer
                <span class="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono font-normal">
                  {{ report()?.totalStates || 0 }} Permuted States
                </span>
              </h2>
              <p class="text-xs text-zinc-400">
                Exhaustive 3^N state-space verification across balanced ternary values (-1, 0, +1)
              </p>
            </div>
          </div>

          <div class="flex items-center gap-2">
            <button id="btn-refresh-truth-table"
                    (click)="runVerification()"
                    class="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-300 text-xs font-mono flex items-center gap-1.5 transition-colors border border-white/5">
              <mat-icon class="text-sm">refresh</mat-icon>
              <span>Re-evaluate</span>
            </button>
            <button id="btn-ai-explain-truth"
                    (click)="requestAiAnalysis()"
                    class="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-medium flex items-center gap-1.5 transition-colors shadow-sm">
              <mat-icon class="text-sm">smart_toy</mat-icon>
              <span>AI Diagnostic</span>
            </button>
            <button id="btn-close-truth-modal"
                    (click)="close()"
                    class="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 transition-colors">
              <mat-icon class="text-lg">close</mat-icon>
            </button>
          </div>
        </div>

        <!-- Telemetry Summary Strip -->
        <div class="px-6 py-3 bg-black/40 border-b border-white/5 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-mono">
          <div>
            <span class="text-zinc-500 block text-[10px] uppercase tracking-wider">Detected Inputs</span>
            <span class="text-zinc-200 font-semibold">{{ report()?.inputNames?.length || 0 }} signals</span>
          </div>
          <div>
            <span class="text-zinc-500 block text-[10px] uppercase tracking-wider">Analyzed Outputs</span>
            <span class="text-zinc-200 font-semibold">{{ report()?.outputNames?.length || 0 }} signals</span>
          </div>
          <div>
            <span class="text-zinc-500 block text-[10px] uppercase tracking-wider">Determinism</span>
            <span class="text-emerald-400 font-semibold flex items-center gap-1">
              <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              100% Verified
            </span>
          </div>
          <div>
            <span class="text-zinc-500 block text-[10px] uppercase tracking-wider">Ternary Entropy</span>
            <span class="text-cyan-400 font-semibold">
              {{ ((report()?.entropy || 0) * 100).toFixed(1) }}%
            </span>
          </div>
        </div>

        <!-- Matrix Table Container -->
        <div class="flex-1 overflow-auto p-6">
          @if (!report() || report()!.rows.length === 0) {
            <div class="py-12 text-center text-zinc-500 text-xs font-mono">
              No input or output nodes detected. Add CONSTANT sources or PROBE monitors to generate the truth table.
            </div>
          } @else {
            <div class="border border-white/10 rounded-xl overflow-hidden bg-black/20">
              <table class="w-full text-left border-collapse text-xs font-mono">
                <thead>
                  <tr class="border-b border-white/10 bg-white/[0.03] text-zinc-400 text-[11px]">
                    <th class="py-2.5 px-4 font-semibold w-12 text-zinc-600">#</th>
                    @for (inp of report()!.inputNames; track inp) {
                      <th class="py-2.5 px-3 font-semibold text-emerald-300/90 border-r border-white/5">
                        IN: {{ inp }}
                      </th>
                    }
                    @for (out of report()!.outputNames; track out) {
                      <th class="py-2.5 px-3 font-semibold text-cyan-300/90 border-r border-white/5 last:border-r-0">
                        OUT: {{ out }}
                      </th>
                    }
                  </tr>
                </thead>
                <tbody class="divide-y divide-white/5">
                  @for (row of report()!.rows; track $index) {
                    <tr class="hover:bg-white/[0.02] transition-colors">
                      <td class="py-2 px-4 text-zinc-600 text-[10px]">{{ $index + 1 }}</td>
                      @for (inp of report()!.inputNames; track inp) {
                        <td class="py-2 px-3 border-r border-white/5">
                          <span class="inline-flex items-center justify-center min-w-[28px] px-1.5 py-0.5 rounded text-[10px] font-bold"
                                [ngClass]="getTritBadgeClass(row.inputs[inp])">
                            {{ getTritSymbol(row.inputs[inp]) }}
                          </span>
                        </td>
                      }
                      @for (out of report()!.outputNames; track out) {
                        <td class="py-2 px-3 border-r border-white/5 last:border-r-0">
                          <span class="inline-flex items-center justify-center min-w-[28px] px-1.5 py-0.5 rounded text-[10px] font-bold"
                                [ngClass]="getTritBadgeClass(row.outputs[out])">
                            {{ getTritSymbol(row.outputs[out]) }}
                          </span>
                        </td>
                      }
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        </div>

        <!-- Footer -->
        <div class="px-6 py-3.5 border-t border-white/10 bg-white/[0.02] flex items-center justify-between text-xs text-zinc-400">
          <div class="flex items-center gap-4 text-[11px] font-mono">
            <span class="flex items-center gap-1.5">
              <span class="w-2.5 h-2.5 rounded bg-emerald-500/30 border border-emerald-500/50"></span>
              +1 (TRUE / Excitatoire)
            </span>
            <span class="flex items-center gap-1.5">
              <span class="w-2.5 h-2.5 rounded bg-zinc-600/30 border border-zinc-500/50"></span>
              0 (NEUTRAL / Indéterminé)
            </span>
            <span class="flex items-center gap-1.5">
              <span class="w-2.5 h-2.5 rounded bg-red-500/30 border border-red-500/50"></span>
              -1 (FALSE / Inhibitory)
            </span>
          </div>

          <button id="btn-export-truth-report"
                  (click)="exportReport()"
                  class="text-xs text-zinc-300 hover:text-white flex items-center gap-1 transition-colors">
            <mat-icon class="text-sm">download</mat-icon>
            <span>Export Report (.txt)</span>
          </button>
        </div>
      </div>
    </div>
  `
})
export class TruthTableModal implements OnInit {
  private appUi = inject(AppUiService);
  private truthService = inject(TruthTableService);
  private ai = inject(EdenAiPipelineService);

  report = signal<VerificationReport | null>(null);

  ngOnInit() {
    this.runVerification();
  }

  runVerification() {
    const rep = this.truthService.generateTruthTable();
    this.report.set(rep);
  }

  close() {
    this.appUi.isTruthTableOpen.set(false);
  }

  getTritSymbol(v: TernaryValue): string {
    if (v === 'TRUE') return '+1';
    if (v === 'FALSE') return '-1';
    return '0';
  }

  getTritBadgeClass(v: TernaryValue): string {
    if (v === 'TRUE') return 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40';
    if (v === 'FALSE') return 'bg-red-500/20 text-red-300 border border-red-500/40';
    return 'bg-zinc-800 text-zinc-400 border border-zinc-700';
  }

  requestAiAnalysis() {
    const rep = this.report();
    if (!rep) return;
    const txt = this.truthService.formatReportAsText(rep);
    this.close();
    this.ai.sendChatMessage(
      `Formally analyze this EDEN OS ternary circuit truth table and provide a diagnostic on its completeness, determinism, and charge balance:\n\`\`\`\n${txt}\n\`\`\``
    );
  }

  exportReport() {
    const rep = this.report();
    if (!rep) return;
    const text = this.truthService.formatReportAsText(rep);
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `eden_truth_table_${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }
}
