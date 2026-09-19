import { Component, inject, signal, computed, ViewChild, ElementRef, AfterViewChecked, HostListener } from '@angular/core';
import { NgClass, NgIf, DatePipe } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { CliUiService } from '../core/CliUiService';
import { EdenAiPipelineService, AiMode, ChatMessage } from '../core/EdenAiPipelineService';
import { AppUiService } from '../core/AppUiService';
import { CoreEngine } from '../core/CoreEngine';
import { AI_PROVIDERS, AiProvider } from '../types/provider';

@Component({
  selector: 'eden-chat-panel',
  standalone: true,
  imports: [NgClass, NgIf, MatIconModule, DragDropModule, DatePipe],
  template: `
    <div *ngIf="ui.isOpen()" 
         (click)="onBackdropClick($event)"
         class="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/40 backdrop-blur-[2px]">
      <div cdkDrag cdkDragBoundary="body" 
           (click)="$event.stopPropagation()"
           class="pointer-events-auto w-[680px] max-w-[96vw] h-[82vh] max-h-[850px] bg-[var(--color-eden-surface)] backdrop-blur-3xl border border-[var(--color-eden-border)] rounded-2xl shadow-2xl flex flex-col overflow-hidden transition-shadow duration-300"
           style="box-shadow: 0 0 50px rgba(16, 185, 129, 0.15), 0 20px 40px rgba(0, 0, 0, 0.8);">
        
        <!-- HEADER -->
        <div cdkDragHandle class="flex items-center justify-between px-4 py-3 border-b border-[var(--color-eden-border)] bg-gradient-to-r from-emerald-500/10 via-purple-500/5 to-transparent cursor-move select-none shrink-0">
          <div class="flex items-center gap-2.5">
            <div class="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.3)]">
              <mat-icon style="font-size: 18px; width: 18px; height: 18px;">psychology</mat-icon>
            </div>
            <div>
              <div class="flex items-center gap-2">
                <h2 class="text-white font-mono font-bold tracking-wider text-xs sm:text-sm">EDEN TERNARY OS CO-PILOT</h2>
                <span class="text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 uppercase font-semibold">
                  Kernel v3.0
                </span>
              </div>
              <p class="text-[10px] font-mono text-zinc-400 hidden sm:block">Autonomous control of logic gates, VM cycles, and circuit nodes</p>
            </div>
          </div>

          <div class="flex items-center gap-1.5">
            <!-- VM Status Badge -->
            <button (click)="engine.toggleVM()" 
                    [title]="engine.isVmRunning() ? 'Pause Virtual Machine' : 'Start Virtual Machine'"
                    class="px-2 py-1 rounded-lg font-mono text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer border"
                    [ngClass]="engine.isVmRunning() ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 animate-pulse' : 'bg-white/5 text-zinc-400 border-white/10 hover:bg-white/10'">
              <mat-icon style="font-size: 14px; width: 14px; height: 14px;">
                {{ engine.isVmRunning() ? 'flash_on' : 'flash_off' }}
              </mat-icon>
              <span>{{ engine.isVmRunning() ? 'VM ON' : 'VM OFF' }}</span>
            </button>

            <!-- Provider Hub shortcut -->
            <button (click)="appUi.toggleProviderHub()" 
                    title="Configure AI API keys"
                    class="p-1.5 rounded-lg text-zinc-400 hover:text-[var(--color-eden-neon)] hover:bg-white/5 transition-colors cursor-pointer">
              <mat-icon style="font-size: 18px; width: 18px; height: 18px;">settings</mat-icon>
            </button>

            <!-- Close button -->
            <button (click)="ui.toggle()" class="text-gray-400 hover:text-white transition-colors cursor-pointer p-1.5 rounded-lg hover:bg-white/5">
              <mat-icon style="font-size: 18px; width: 18px; height: 18px;">close</mat-icon>
            </button>
          </div>
        </div>

        <!-- QUICK OS ACTION STRIP -->
        <div class="px-3 py-2 bg-black/40 border-b border-white/5 flex items-center gap-1.5 overflow-x-auto shrink-0 custom-scrollbar text-[11px] font-mono">
          <span class="text-zinc-500 text-[10px] uppercase font-bold shrink-0 mr-1 flex items-center gap-1">
            <mat-icon style="font-size: 12px; width: 12px; height: 12px;">tune</mat-icon>
            OS Presets:
          </span>

          <button (click)="engine.synthesizeTernaryAlu()"
                  class="px-2 py-1 rounded-md bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/20 transition-all cursor-pointer shrink-0 flex items-center gap-1">
            <mat-icon style="font-size: 13px; width: 13px; height: 13px;" class="text-purple-400">memory</mat-icon>
            + Balanced ALU
          </button>

          <button (click)="engine.synthesizeTernaryNeuron()"
                  class="px-2 py-1 rounded-md bg-pink-500/10 hover:bg-pink-500/20 text-pink-300 border border-pink-500/20 transition-all cursor-pointer shrink-0 flex items-center gap-1">
            <mat-icon style="font-size: 13px; width: 13px; height: 13px;" class="text-pink-400">hub</mat-icon>
            + Neuron
          </button>

          <button (click)="engine.synthesizeTernaryMemoryWord()"
                  class="px-2 py-1 rounded-md bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/20 transition-all cursor-pointer shrink-0 flex items-center gap-1">
            <mat-icon style="font-size: 13px; width: 13px; height: 13px;" class="text-cyan-400">storage</mat-icon>
            + 3-Trit RAM
          </button>

          <button (click)="engine.synthesizeHalfAdder()"
                  class="px-2 py-1 rounded-md bg-white/[0.03] hover:bg-emerald-500/20 text-zinc-300 hover:text-emerald-300 border border-white/5 hover:border-emerald-500/30 transition-all cursor-pointer shrink-0 flex items-center gap-1">
            <mat-icon style="font-size: 13px; width: 13px; height: 13px;" class="text-emerald-400">add_box</mat-icon>
            + Half-Adder
          </button>

          <button (click)="engine.synthesizeRingOscillator()"
                  class="px-2 py-1 rounded-md bg-white/[0.03] hover:bg-cyan-500/20 text-zinc-300 hover:text-cyan-300 border border-white/5 hover:border-cyan-500/30 transition-all cursor-pointer shrink-0 flex items-center gap-1">
            <mat-icon style="font-size: 13px; width: 13px; height: 13px;" class="text-cyan-400">sync</mat-icon>
            + Oscillator
          </button>

          <button (click)="appUi.toggleTruthTable()"
                  class="px-2 py-1 rounded-md bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/20 transition-all cursor-pointer shrink-0 flex items-center gap-1">
            <mat-icon style="font-size: 13px; width: 13px; height: 13px;" class="text-emerald-400">analytics</mat-icon>
            Truth Table
          </button>

          <button (click)="appUi.toggleTasmStudio()"
                  class="px-2 py-1 rounded-md bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/20 transition-all cursor-pointer shrink-0 flex items-center gap-1">
            <mat-icon style="font-size: 13px; width: 13px; height: 13px;" class="text-cyan-400">terminal</mat-icon>
            TASM Studio
          </button>

          <button (click)="engine.stepVM()"
                  class="px-2 py-1 rounded-md bg-white/[0.03] hover:bg-amber-500/20 text-zinc-300 hover:text-amber-300 border border-white/5 hover:border-amber-500/30 transition-all cursor-pointer shrink-0 flex items-center gap-1">
            <mat-icon style="font-size: 13px; width: 13px; height: 13px;" class="text-amber-400">skip_next</mat-icon>
            Step Trit
          </button>

          <button (click)="engine.autoLayout()"
                  class="px-2 py-1 rounded-md bg-white/[0.03] hover:bg-blue-500/20 text-zinc-300 hover:text-blue-300 border border-white/5 hover:border-blue-500/30 transition-all cursor-pointer shrink-0 flex items-center gap-1">
            <mat-icon style="font-size: 13px; width: 13px; height: 13px;" class="text-blue-400">grid_view</mat-icon>
            Matrix Grid
          </button>

          <button (click)="engine.clearCircuit()"
                  class="px-2 py-1 rounded-md bg-white/[0.03] hover:bg-red-500/20 text-zinc-300 hover:text-red-300 border border-white/5 hover:border-red-500/30 transition-all cursor-pointer shrink-0 flex items-center gap-1 ml-auto">
            <mat-icon style="font-size: 13px; width: 13px; height: 13px;" class="text-red-400">clear_all</mat-icon>
            Clear
          </button>
        </div>

        <!-- PROVIDER SELECTOR BAR -->
        <div class="px-3 py-2 bg-black/20 border-b border-white/5 flex items-center justify-between gap-2 shrink-0">
          <div class="flex items-center gap-1.5 overflow-x-auto custom-scrollbar py-0.5">
            @for (prov of providerList; track prov) {
              @let config = getProviderConfig(prov);
              <button (click)="selectProvider(prov)"
                      [style.border-color]="selectedEngine() === prov ? config.color : 'transparent'"
                      [ngClass]="selectedEngine() === prov ? 'bg-white/10 text-white shadow-sm' : 'text-zinc-400 bg-white/[0.02] hover:bg-white/5'"
                      class="py-1 px-2 rounded-lg font-mono text-[10px] font-bold border transition-all cursor-pointer flex items-center gap-1 shrink-0">
                <mat-icon style="font-size: 13px; width: 13px; height: 13px;" [style.color]="config.color">
                  {{ config.icon }}
                </mat-icon>
                <span>{{ config.brand }}</span>
              </button>
            }
          </div>

          <span class="text-[10px] font-mono text-zinc-400 truncate max-w-[140px] hidden md:block" [title]="pipeline.activeModel()">
            {{ pipeline.activeModel() }}
          </span>
        </div>

        <!-- CHAT MESSAGES STREAM -->
        <div #scrollContainer class="flex-1 overflow-y-auto p-4 flex flex-col gap-3.5 custom-scrollbar bg-black/10">
          @for (msg of pipeline.chatMessages(); track msg.id) {
            <!-- User Message -->
            @if (msg.sender === 'user') {
              <div class="flex items-start gap-2.5 justify-end">
                <div class="flex flex-col items-end max-w-[85%]">
                  <div class="bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-3.5 py-2.5 rounded-2xl rounded-tr-sm text-xs font-mono shadow-md whitespace-pre-wrap break-words leading-relaxed border border-emerald-400/30">
                    {{ msg.text }}
                  </div>
                  <span class="text-[9px] font-mono text-zinc-500 mt-1 mr-1">
                    {{ msg.timestamp | date:'HH:mm:ss' }}
                  </span>
                </div>
                <div class="w-7 h-7 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-300 shrink-0 text-xs font-mono font-bold">
                  U
                </div>
              </div>
            }

            <!-- Assistant Message -->
            @if (msg.sender === 'assistant') {
              <div class="flex items-start gap-2.5 justify-start">
                <div class="w-7 h-7 rounded-full bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-300 shrink-0 shadow-[0_0_10px_rgba(168,85,247,0.3)]">
                  <mat-icon style="font-size: 15px; width: 15px; height: 15px;">smart_toy</mat-icon>
                </div>
                
                <div class="flex flex-col items-start max-w-[88%] w-full">
                  <div class="bg-zinc-900/90 border border-white/10 text-zinc-200 p-3.5 rounded-2xl rounded-tl-sm text-xs font-mono shadow-lg flex flex-col gap-2.5 w-full leading-relaxed">
                    <!-- Model info pill -->
                    <div class="flex items-center justify-between border-b border-white/5 pb-1.5 text-[10px] text-zinc-400">
                      <span class="flex items-center gap-1 text-[var(--color-eden-neon)] font-bold">
                        <mat-icon style="font-size: 12px; width: 12px; height: 12px;">memory</mat-icon>
                        {{ msg.model || 'Ternary OS Agent' }}
                      </span>
                      <span>{{ msg.timestamp | date:'HH:mm:ss' }}</span>
                    </div>

                    <!-- Actions Executed Badges -->
                    @if (msg.executedActions && msg.executedActions.length > 0) {
                      <div class="flex flex-wrap gap-1 p-1.5 bg-black/40 rounded-lg border border-emerald-500/20">
                        @for (action of msg.executedActions; track action) {
                          <span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 text-[9px] font-mono">
                            <mat-icon style="font-size: 10px; width: 10px; height: 10px;">check_circle</mat-icon>
                            {{ action }}
                          </span>
                        }
                      </div>
                    }

                    <!-- AI Reasoning Accordion / Box -->
                    @if (msg.reasoning) {
                      <div class="bg-blue-500/5 border border-blue-500/20 rounded-lg p-2.5 text-[11px] text-blue-200">
                        <div class="flex items-center gap-1.5 font-bold text-blue-400 text-[10px] mb-1">
                          <mat-icon style="font-size: 12px; width: 12px; height: 12px;">psychology</mat-icon>
                          Architectural Reasoning
                        </div>
                        <p class="italic text-zinc-300 text-[11px] leading-relaxed">{{ msg.reasoning }}</p>
                      </div>
                    }

                    <!-- Main text -->
                    <div class="whitespace-pre-wrap break-words leading-relaxed text-zinc-100">
                      {{ msg.text }}
                    </div>

                    <!-- Streaming spinner -->
                    @if (msg.isStreaming) {
                      <div class="flex items-center gap-2 text-[10px] text-emerald-400 animate-pulse mt-1">
                        <mat-icon class="animate-spin" style="font-size: 14px; width: 14px; height: 14px;">autorenew</mat-icon>
                        <span>Controlling OS in real-time...</span>
                      </div>
                    }
                  </div>
                </div>
              </div>
            }
          }
        </div>

        <!-- AGENTIC LOOP RUNNING BANNER -->
        <div *ngIf="pipeline.isAgenticLoopActive()" class="px-4 py-2 bg-red-950/40 border-t border-red-500/30 shrink-0 flex items-center justify-between">
          <div class="flex items-center gap-2 text-xs font-mono text-red-300">
            <span class="w-2 h-2 rounded-full bg-red-500 animate-ping"></span>
            <span class="font-bold">AUTONOMOUS LOOP ACTIVE</span>
            <span class="text-[10px] text-zinc-400">({{ pipeline.agenticIteration() }}/{{ pipeline.maxAgenticIterations() }})</span>
          </div>
          <button (click)="pipeline.abortAgenticLoop()"
                  class="px-2.5 py-1 rounded bg-red-600 hover:bg-red-500 text-white font-mono text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer shadow-md">
            <mat-icon style="font-size: 13px; width: 13px; height: 13px;">stop</mat-icon>
            Stop
          </button>
        </div>

        <!-- SUGGESTION CHIPS -->
        <div class="px-3 py-1.5 bg-black/30 border-t border-white/5 flex items-center gap-1.5 overflow-x-auto shrink-0 custom-scrollbar text-[10px] font-mono">
          <span class="text-zinc-500 shrink-0">Suggestions:</span>
          <button (click)="submitQuickPrompt('Synthesize a ternary Half-Adder circuit with zero overlap')"
                  class="px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-colors cursor-pointer shrink-0">
            "Ternary Half-Adder"
          </button>
          <button (click)="submitQuickPrompt('Create a CONSENSUS gate connected to two source trits and an oscilloscope PROBE')"
                  class="px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-colors cursor-pointer shrink-0">
            "Consensus Gate + Probe"
          </button>
          <button (click)="submitQuickPrompt('Start the VM and set clock speed to 80ms')"
                  class="px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-colors cursor-pointer shrink-0">
            "Start VM @ 80ms"
          </button>
          <button (click)="submitQuickPrompt('Set all constant trits to +1 and re-align the layout')"
                  class="px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-colors cursor-pointer shrink-0">
            "Set Trits + Layout"
          </button>
        </div>

        <!-- INPUT FOOTER -->
        <div class="p-3 bg-black/50 border-t border-[var(--color-eden-border)] flex flex-col gap-2 shrink-0">
          <div class="flex items-center justify-between text-[10px] font-mono text-zinc-400">
            <div class="flex items-center gap-2">
              <label class="flex items-center gap-1 cursor-pointer hover:text-white">
                <input type="checkbox" [checked]="isAgenticMode()" (change)="toggleAgenticMode()" class="rounded border-zinc-700 text-emerald-500 focus:ring-0">
                <span>Autonomous Agentic Loop</span>
              </label>

              <span class="text-zinc-600">|</span>

              <button (click)="clearChat()" class="text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer">
                Clear history
              </button>
            </div>

            <span class="text-zinc-500 hidden sm:inline">Enter to send • Shift+Enter for new line</span>
          </div>

          <div class="flex items-center gap-2">
            <textarea #chatInput
                      rows="2" 
                      class="flex-1 bg-black/60 border border-white/10 rounded-xl p-2.5 text-white font-mono text-xs focus:outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/60 transition-all resize-none placeholder-zinc-600 custom-scrollbar"
                      placeholder="Instruct the AI (e.g. 'Build a half adder with 2 inputs and a probe', 'Start the VM', 'Invert trit state')..."
                      (keydown.enter)="handleKeydown($event, chatInput)"
            ></textarea>

            <button (click)="sendFromInput(chatInput)"
                    [disabled]="pipeline.isExecuting() || pipeline.isAgenticLoopActive()"
                    class="h-full px-4 rounded-xl font-mono text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer border border-emerald-500/40"
                    [ngClass]="pipeline.isExecuting() || pipeline.isAgenticLoopActive() ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-[0_0_20px_rgba(16,185,129,0.4)]'">
              <mat-icon *ngIf="!pipeline.isExecuting() && !pipeline.isAgenticLoopActive()" style="font-size: 18px; width: 18px; height: 18px;">send</mat-icon>
              <mat-icon *ngIf="pipeline.isExecuting() || pipeline.isAgenticLoopActive()" class="animate-spin" style="font-size: 18px; width: 18px; height: 18px;">autorenew</mat-icon>
              <span class="hidden sm:inline">Execute</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  `,
  styles: [`
    .custom-scrollbar::-webkit-scrollbar {
      width: 4px;
      height: 4px;
    }
    .custom-scrollbar::-webkit-scrollbar-track {
      background: transparent;
    }
    .custom-scrollbar::-webkit-scrollbar-thumb {
      background: rgba(255, 255, 255, 0.15);
      border-radius: 4px;
    }
    .custom-scrollbar:hover::-webkit-scrollbar-thumb {
      background: rgba(255, 255, 255, 0.3);
    }
  `]
})
export class ChatPanel implements AfterViewChecked {
  @ViewChild('scrollContainer') private scrollContainer?: ElementRef;

  public ui = inject(CliUiService);
  public appUi = inject(AppUiService);
  public pipeline = inject(EdenAiPipelineService);
  public engine = inject(CoreEngine);

  readonly providerList: AiProvider[] = [
    'nvidia', 'claude', 'gemini', 'openai', 'deepseek', 'groq', 'mistral', 'openrouter', 'local'
  ];

  selectedEngine = computed<AiProvider>(() => this.pipeline.activeProvider());
  isAgenticMode = signal<boolean>(false);

  ngAfterViewChecked() {
    this.scrollToBottom();
  }

  private scrollToBottom() {
    if (this.scrollContainer) {
      try {
        const el = this.scrollContainer.nativeElement;
        el.scrollTop = el.scrollHeight;
      } catch {}
    }
  }

  getProviderConfig(provider: AiProvider) {
    return AI_PROVIDERS[provider];
  }

  selectProvider(provider: AiProvider) {
    this.pipeline.setProvider(provider);
  }

  toggleAgenticMode() {
    this.isAgenticMode.update(v => !v);
  }

  handleKeydown(event: Event, textarea: HTMLTextAreaElement) {
    const kbEvent = event as KeyboardEvent;
    if (kbEvent.key === 'Enter' && !kbEvent.shiftKey) {
      kbEvent.preventDefault();
      this.sendFromInput(textarea);
    }
  }

  async sendFromInput(textarea: HTMLTextAreaElement) {
    const text = textarea.value.trim();
    if (!text || this.pipeline.isExecuting() || this.pipeline.isAgenticLoopActive()) return;

    textarea.value = '';
    await this.pipeline.sendChatMessage(text, { isAgentic: this.isAgenticMode() });
  }

  async submitQuickPrompt(promptText: string) {
    await this.pipeline.sendChatMessage(promptText, { isAgentic: this.isAgenticMode() });
  }

  clearChat() {
    this.pipeline.chatMessages.set([]);
  }

  onBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      this.ui.toggle();
    }
  }

  @HostListener('window:keydown.escape')
  onEscapePress() {
    if (this.ui.isOpen()) {
      this.ui.toggle();
    }
  }
}
