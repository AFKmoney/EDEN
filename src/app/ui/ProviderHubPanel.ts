import { Component, inject, signal, computed } from '@angular/core';
import { NgClass, NgIf } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { AI_PROVIDERS, AiProvider, ProviderConfig, ProviderModel } from '../types/provider';
import { EdenAiPipelineService } from '../core/EdenAiPipelineService';
import { CliService } from '../core/CliService';
import { AppUiService } from '../core/AppUiService';
import { WindowResizer } from '../core/WindowResizer';

@Component({
  selector: 'eden-provider-hub',
  standalone: true,
  imports: [NgClass, NgIf, MatIconModule, DragDropModule],
  template: `
    <div *ngIf="appUi.isProviderHubOpen()" class="fixed inset-0 z-50 pointer-events-none flex items-center justify-center p-2 sm:p-4">
      <div cdkDrag cdkDragBoundary="body" 
           [style.width.px]="resizer.width()"
           [style.height.px]="resizer.height()"
           [style.max-width]="resizer.isMaximized() ? '99vw' : '96vw'"
           [style.max-height]="resizer.isMaximized() ? '98vh' : '94vh'"
           class="relative pointer-events-auto bg-[var(--color-eden-surface)] backdrop-blur-3xl border border-[var(--color-eden-border)] rounded-2xl shadow-2xl flex flex-col overflow-hidden select-text"
           style="box-shadow: 0 0 50px rgba(0, 255, 170, 0.15);">
        
        <!-- Header -->
        <div cdkDragHandle class="flex items-center justify-between px-6 py-4 border-b border-[var(--color-eden-border)] bg-gradient-to-r from-emerald-500/10 via-cyan-500/5 to-transparent cursor-move select-none shrink-0">
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-lg bg-[var(--color-eden-neon)]/10 border border-[var(--color-eden-neon)]/30 flex items-center justify-center text-[var(--color-eden-neon)]">
              <mat-icon style="font-size: 20px; width: 20px; height: 20px;">hub</mat-icon>
            </div>
            <div>
              <h2 class="text-white font-mono font-bold tracking-wider text-sm flex items-center gap-2">
                EDEN NEURAL AI HUB
                <span class="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[var(--color-eden-neon)]/20 text-[var(--color-eden-neon)] border border-[var(--color-eden-neon)]/30 font-semibold">
                  9 PROVIDERS
                </span>
              </h2>
              <p class="text-[11px] text-zinc-400 font-mono">Select active intelligence engine, configure keys, and test connectivity</p>
            </div>
          </div>
          <div class="flex items-center gap-1.5">
            <!-- Maximize / Restore -->
            <button (click)="resizer.toggleMaximize()"
                    [title]="resizer.isMaximized() ? 'Restore size' : 'Maximize window'"
                    class="text-zinc-400 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-white/10 cursor-pointer">
              <mat-icon style="font-size: 18px; width: 18px; height: 18px;">{{ resizer.isMaximized() ? 'filter_none' : 'crop_square' }}</mat-icon>
            </button>
            <button (click)="appUi.toggleProviderHub()" class="text-zinc-400 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-white/10 cursor-pointer">
              <mat-icon style="font-size: 20px; width: 20px; height: 20px;">close</mat-icon>
            </button>
          </div>
        </div>

        <!-- Main Layout: Left Provider List, Right Detail/Settings View -->
        <div class="flex-1 flex min-h-0 overflow-hidden">
          
          <!-- Left Provider Sidebar (Grid of Providers) -->
          <div class="w-64 border-r border-[var(--color-eden-border)] bg-black/20 flex flex-col overflow-y-auto custom-scrollbar p-2.5 gap-1.5">
            <div class="text-[10px] font-mono uppercase tracking-wider text-zinc-500 px-2 py-1">
              Select Provider
            </div>

            @for (providerKey of providerKeys; track providerKey) {
              @let prov = getProvider(providerKey);
              <button (click)="selectProvider(providerKey)"
                      class="w-full px-3 py-2.5 rounded-xl border text-left flex items-center gap-3 transition-all cursor-pointer relative group"
                      [ngClass]="{
                        'bg-white/10 border-white/20 shadow-md': selectedProviderId() === providerKey,
                        'border-transparent hover:bg-white/5 text-zinc-400 hover:text-zinc-200': selectedProviderId() !== providerKey
                      }">
                
                <!-- Provider Icon -->
                <div class="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border"
                     [style.background-color]="prov.accentColor"
                     [style.border-color]="prov.color">
                  <mat-icon style="font-size: 18px; width: 18px; height: 18px;" [style.color]="prov.color">
                    {{ prov.icon }}
                  </mat-icon>
                </div>

                <div class="flex-1 min-w-0">
                  <div class="flex items-center justify-between">
                    <span class="text-xs font-mono font-bold truncate" [style.color]="selectedProviderId() === providerKey ? prov.color : 'inherit'">
                      {{ prov.name }}
                    </span>
                    @if (pipeline.activeProvider() === providerKey) {
                      <span class="w-2 h-2 rounded-full bg-[var(--color-eden-neon)] shrink-0 shadow-[0_0_6px_var(--color-eden-neon)] animate-pulse" title="Active Engine"></span>
                    }
                  </div>
                  <div class="text-[10px] text-zinc-500 font-mono truncate">
                    {{ prov.brand }}
                  </div>
                </div>

                <!-- Active Indicator Badge -->
                @if (pipeline.activeProvider() === providerKey) {
                  <div class="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r bg-[var(--color-eden-neon)]"></div>
                }
              </button>
            }
          </div>

          <!-- Right Content: Selected Provider Details, Model Selection & Key Setup -->
          <div class="flex-1 flex flex-col overflow-y-auto custom-scrollbar p-6 bg-black/10">
            @let selected = currentProvider();
            
            <!-- Provider Title Header -->
            <div class="flex items-start justify-between pb-4 border-b border-[var(--color-eden-border)]">
              <div class="flex items-center gap-4">
                <div class="w-12 h-12 rounded-xl flex items-center justify-center border shadow-lg"
                     [style.background-color]="selected.accentColor"
                     [style.border-color]="selected.color">
                  <mat-icon style="font-size: 26px; width: 26px; height: 26px;" [style.color]="selected.color">
                    {{ selected.icon }}
                  </mat-icon>
                </div>
                <div>
                  <div class="flex items-center gap-2">
                    <h3 class="text-lg font-bold font-mono text-white tracking-wide">{{ selected.name }}</h3>
                    @if (pipeline.activeProvider() === selected.id) {
                      <span class="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold">
                        ACTIVE IN ENGINE
                      </span>
                    }
                  </div>
                  <p class="text-xs text-zinc-400 font-mono mt-0.5">{{ selected.endpointDescription }}</p>
                </div>
              </div>

              <!-- Set as Active Provider Button -->
              @if (pipeline.activeProvider() !== selected.id) {
                <button (click)="activateProvider(selected.id)"
                        class="px-4 py-2 rounded-xl text-xs font-mono font-bold transition-all shadow-md flex items-center gap-2 cursor-pointer bg-[var(--color-eden-neon)]/15 text-[var(--color-eden-neon)] border border-[var(--color-eden-neon)]/40 hover:bg-[var(--color-eden-neon)] hover:text-black">
                  <mat-icon style="font-size: 16px; width: 16px; height: 16px;">bolt</mat-icon>
                  SET ACTIVE PROVIDER
                </button>
              } @else {
                <div class="px-4 py-2 rounded-xl text-xs font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 flex items-center gap-2">
                  <mat-icon style="font-size: 16px; width: 16px; height: 16px;">check_circle</mat-icon>
                  CURRENT ENGINE
                </div>
              }
            </div>

            <!-- Model Selection Grid -->
            <div class="mt-5">
              <div class="flex items-center justify-between mb-2.5">
                <span class="text-xs font-mono font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
                  <mat-icon style="font-size: 16px; width: 16px; height: 16px;" class="text-[var(--color-eden-neon)]">tune</mat-icon>
                  Available Models
                </span>
                <span class="text-[11px] font-mono text-zinc-500">
                  Active: <span class="text-[var(--color-eden-neon)] font-bold">{{ pipeline.activeModel() }}</span>
                </span>
              </div>

              <div class="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                @for (model of selected.models; track model.id) {
                  <div (click)="selectModel(model.id)"
                       class="p-3 rounded-xl border transition-all cursor-pointer flex flex-col justify-between group"
                       [ngClass]="{
                         'bg-white/10 border-[var(--color-eden-neon)]/60 shadow-[0_0_15px_rgba(0,255,170,0.15)]': pipeline.activeModel() === model.id && pipeline.activeProvider() === selected.id,
                         'bg-black/30 border-white/5 hover:border-white/20 hover:bg-white/5': !(pipeline.activeModel() === model.id && pipeline.activeProvider() === selected.id)
                       }">
                    <div class="flex items-start justify-between gap-2">
                      <div>
                        <span class="text-xs font-mono font-bold text-white group-hover:text-[var(--color-eden-neon)] transition-colors">
                          {{ model.name }}
                        </span>
                        <div class="text-[10px] font-mono text-zinc-500 mt-0.5">{{ model.id }}</div>
                      </div>
                      @if (model.badge) {
                        <span class="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white/10 text-zinc-300 border border-white/10 font-bold shrink-0">
                          {{ model.badge }}
                        </span>
                      }
                    </div>
                    <p class="text-[11px] text-zinc-400 font-mono mt-2 line-clamp-2">
                      {{ model.description }}
                    </p>
                  </div>
                }
              </div>
            </div>

            <!-- API Key Configuration Section -->
            @if (selected.id !== 'local') {
              <div class="mt-6 p-4 rounded-xl border border-[var(--color-eden-border)] bg-black/40 flex flex-col gap-3">
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-2">
                    <mat-icon style="font-size: 16px; width: 16px; height: 16px;" class="text-yellow-400">key</mat-icon>
                    <span class="text-xs font-mono font-bold uppercase tracking-wider text-zinc-300">
                      {{ selected.name }} API Key
                    </span>
                  </div>
                  <span class="text-[10px] font-mono px-2 py-0.5 rounded-full"
                        [ngClass]="hasCustomKey() ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : 'bg-zinc-800 text-zinc-400'">
                    {{ hasCustomKey() ? 'Custom Key Saved' : 'Using Environment Key' }}
                  </span>
                </div>

                <div class="text-[11px] text-zinc-400 font-mono">
                  Optional: Provide your own <code class="text-zinc-200">{{ selected.keyEnvName }}</code> to override default server credentials. Keys are stored locally in your browser sandbox.
                </div>

                <div class="flex items-center gap-2">
                  <div class="flex-1 bg-black/60 border border-[var(--color-eden-border)] rounded-lg px-3 py-2 flex items-center gap-2 focus-within:border-[var(--color-eden-neon)] transition-colors">
                    <input 
                      #keyInput
                      [type]="showKey() ? 'text' : 'password'" 
                      [placeholder]="selected.keyPlaceholder" 
                      [value]="currentCustomKey()"
                      class="flex-1 bg-transparent border-none outline-none text-white font-mono text-xs"
                      (keydown.enter)="saveKey(keyInput.value)"
                    />
                    <button (click)="showKey.set(!showKey())" type="button" class="text-zinc-500 hover:text-white transition-colors">
                      <mat-icon style="font-size: 16px; width: 16px; height: 16px;">{{ showKey() ? 'visibility_off' : 'visibility' }}</mat-icon>
                    </button>
                  </div>
                  
                  <button (click)="saveKey(keyInput.value)"
                          class="px-4 py-2 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-lg transition-colors font-mono text-xs font-bold flex items-center gap-1.5 cursor-pointer">
                    <mat-icon style="font-size: 16px; width: 16px; height: 16px;">save</mat-icon>
                    SAVE
                  </button>

                  @if (hasCustomKey()) {
                    <button (click)="clearKey(); keyInput.value = ''"
                            class="px-3 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg transition-colors font-mono text-xs font-bold flex items-center gap-1 cursor-pointer"
                            title="Remove custom key">
                      <mat-icon style="font-size: 16px; width: 16px; height: 16px;">delete</mat-icon>
                    </button>
                  }
                </div>
              </div>
            }

            <!-- Test Connectivity / Latency Ping -->
            <div class="mt-4 flex items-center justify-between p-3 rounded-xl border border-white/5 bg-white/[0.02]">
              <div class="flex items-center gap-2">
                <button (click)="testPing()"
                        [disabled]="isPinging()"
                        class="px-3 py-1.5 bg-blue-500/20 text-blue-300 border border-blue-500/40 rounded-lg font-mono text-xs font-bold flex items-center gap-2 hover:bg-blue-500/30 transition-colors disabled:opacity-50 cursor-pointer">
                  <mat-icon [class.animate-spin]="isPinging()" style="font-size: 15px; width: 15px; height: 15px;">
                    {{ isPinging() ? 'autorenew' : 'network_ping' }}
                  </mat-icon>
                  {{ isPinging() ? 'TESTING...' : 'TEST CONNECTIVITY' }}
                </button>
                @if (pingLatency() !== null) {
                  <span class="text-xs font-mono text-emerald-400 flex items-center gap-1">
                    <mat-icon style="font-size: 14px; width: 14px; height: 14px;">check_circle</mat-icon>
                    {{ pingLatency() }}ms latency
                  </span>
                }
                @if (pingError()) {
                  <span class="text-xs font-mono text-red-400 truncate max-w-xs" [title]="pingError()">
                    {{ pingError() }}
                  </span>
                }
              </div>

              <div class="text-[11px] font-mono text-zinc-500 flex items-center gap-1.5">
                <span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                <span>Ready for Prompt & CLI injection</span>
              </div>
            </div>

          </div>
        </div>

        <!-- Window Resize Handles -->
        @if (!resizer.isMaximized()) {
          <div (pointerdown)="resizer.onResizeStart($event, 'right')"
               class="absolute top-0 right-0 w-2 h-full cursor-ew-resize hover:bg-[var(--color-eden-neon)]/30 transition-colors z-20"
               title="Resize width"></div>
          <div (pointerdown)="resizer.onResizeStart($event, 'bottom')"
               class="absolute bottom-0 left-0 h-2 w-full cursor-ns-resize hover:bg-[var(--color-eden-neon)]/30 transition-colors z-20"
               title="Resize height"></div>
          <div (pointerdown)="resizer.onResizeStart($event, 'corner')"
               class="absolute bottom-0 right-0 w-6 h-6 cursor-nwse-resize flex items-end justify-end p-1 text-zinc-500 hover:text-[var(--color-eden-neon)] select-none z-30 transition-colors"
               title="Drag to resize window">
            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M22 22H20V20H22V22ZM22 18H20V16H22V18ZM18 22H16V20H18V22ZM22 14H20V12H22V14ZM18 18H16V16H18V18ZM14 22H12V20H14V22Z"/>
            </svg>
          </div>
        }

      </div>
    </div>
  `,
  styles: [`
    .custom-scrollbar::-webkit-scrollbar {
      width: 4px;
    }
    .custom-scrollbar::-webkit-scrollbar-track {
      background: transparent;
    }
    .custom-scrollbar::-webkit-scrollbar-thumb {
      background: var(--color-eden-border);
      border-radius: 4px;
    }
  `]
})
export class ProviderHubPanel {
  public appUi = inject(AppUiService);
  public pipeline = inject(EdenAiPipelineService);
  private cli = inject(CliService);

  public resizer = new WindowResizer({
    storageKey: 'provider_hub',
    defaultWidth: 840,
    defaultHeight: 640,
    minWidth: 500,
    minHeight: 380
  });

  readonly providerKeys: AiProvider[] = [
    'nvidia',
    'claude',
    'gemini',
    'openai',
    'deepseek',
    'groq',
    'mistral',
    'openrouter',
    'local'
  ];

  selectedProviderId = signal<AiProvider>('nvidia');
  showKey = signal<boolean>(false);
  isPinging = signal<boolean>(false);
  pingLatency = signal<number | null>(null);
  pingError = signal<string | null>(null);

  currentProvider = computed<ProviderConfig>(() => {
    return AI_PROVIDERS[this.selectedProviderId()];
  });

  currentCustomKey = computed<string>(() => {
    const keys = this.cli.storedKeys();
    return keys[this.selectedProviderId()] || '';
  });

  hasCustomKey = computed<boolean>(() => {
    return !!this.currentCustomKey();
  });

  getProvider(id: AiProvider): ProviderConfig {
    return AI_PROVIDERS[id];
  }

  selectProvider(id: AiProvider) {
    this.selectedProviderId.set(id);
    this.pingLatency.set(null);
    this.pingError.set(null);
  }

  activateProvider(id: AiProvider) {
    this.pipeline.setProvider(id);
  }

  selectModel(modelId: string) {
    if (this.pipeline.activeProvider() !== this.selectedProviderId()) {
      this.pipeline.setProvider(this.selectedProviderId(), modelId);
    } else {
      this.pipeline.setModel(modelId);
    }
  }

  saveKey(key: string) {
    this.cli.setStoredKey(this.selectedProviderId(), key);
    // Force refresh reactive signal
    this.selectedProviderId.set(this.selectedProviderId());
  }

  clearKey() {
    this.cli.setStoredKey(this.selectedProviderId(), '');
    this.selectedProviderId.set(this.selectedProviderId());
  }

  async testPing() {
    this.isPinging.set(true);
    this.pingLatency.set(null);
    this.pingError.set(null);

    const start = Date.now();
    try {
      const res = await this.cli.execute(this.selectedProviderId(), '--version', 'raw', this.pipeline.activeModel());
      this.pingLatency.set(Date.now() - start);
      if (res.error || res.stderr) {
        this.pingError.set(res.error || res.stderr || 'Inference error');
      }
    } catch (err: unknown) {
      this.pingError.set(err instanceof Error ? err.message : 'Failed to reach API');
    } finally {
      this.isPinging.set(false);
    }
  }
}
