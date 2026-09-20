import { Component, inject, ViewChild, ElementRef, AfterViewChecked, signal } from '@angular/core';
import { TerminalService } from '../core/TerminalService';
import { MatIconModule } from '@angular/material/icon';
import { DatePipe, NgClass, NgIf } from '@angular/common';
import { AppUiService } from '../core/AppUiService';
import { CliUiService } from '../core/CliUiService';
import { EdenAiPipelineService } from '../core/EdenAiPipelineService';
import { CoreEngine } from '../core/CoreEngine';

@Component({
  selector: 'eden-terminal',
  standalone: true,
  imports: [MatIconModule, DatePipe, NgClass, NgIf],
  template: `
    <div class="fixed bottom-0 left-0 w-full bg-[var(--color-eden-bg)] border-t border-[var(--color-eden-border)] font-mono text-xs flex flex-col z-40 transition-transform duration-300 shadow-[0_-10px_40px_rgba(0,0,0,0.5)]"
         [style.height.px]="isMaximized() ? (windowHeight() - 60) : terminalHeight()"
         [class.translate-y-full]="!ui.isTerminalOpen()">
      
      <!-- Top Resize Handle -->
      <div (pointerdown)="onResizeStart($event)"
           class="absolute top-0 left-0 w-full h-2 cursor-ns-resize hover:bg-[var(--color-eden-neon)]/40 transition-colors z-20"
           title="Drag to resize terminal height"></div>

      <!-- Terminal Header -->
      <div class="flex items-center justify-between px-4 py-2 bg-[var(--color-eden-surface)] border-b border-[var(--color-eden-border)] cursor-pointer select-none" (click)="ui.toggleTerminal()">
        <div class="flex items-center gap-2 text-[var(--color-eden-neon)] font-bold">
          <mat-icon style="font-size: 16px; width: 16px; height: 16px;">terminal</mat-icon>
          <span>NEXUS_TERMINAL v3.0 // TERNARY_VM</span>
        </div>
        <div class="flex items-center gap-3">
          <button (click)="$event.stopPropagation(); terminal.clear()" class="text-gray-500 hover:text-white transition-colors flex items-center gap-1 cursor-pointer">
            <mat-icon style="font-size: 14px; width: 14px; height: 14px;">delete_sweep</mat-icon>
            <span class="text-[10px] uppercase">Clear</span>
          </button>
          <button (click)="$event.stopPropagation(); toggleMaximize()" 
                  [title]="isMaximized() ? 'Restore height' : 'Maximize terminal'"
                  class="text-gray-400 hover:text-white transition-colors cursor-pointer p-1 rounded hover:bg-white/10">
            <mat-icon style="font-size: 16px; width: 16px; height: 16px;">
              {{ isMaximized() ? 'filter_none' : 'crop_square' }}
            </mat-icon>
          </button>
          <mat-icon style="font-size: 18px; width: 18px; height: 18px;" class="text-gray-400">
            {{ ui.isTerminalOpen() ? 'expand_more' : 'expand_less' }}
          </mat-icon>
        </div>
      </div>

      <!-- Terminal Output -->
      <div class="flex-1 overflow-y-auto p-3 space-y-1.5" #scrollContainer>
        @for (log of terminal.logs(); track log.timestamp) {
          <div class="flex gap-3 items-start">
            <span class="text-gray-600 shrink-0">[{{ log.timestamp | date:'HH:mm:ss.SSS' }}]</span>
            <span class="shrink-0 font-bold"
                  [ngClass]="{
                    'text-blue-400': log.level === 'INFO',
                    'text-yellow-400': log.level === 'WARN',
                    'text-red-400': log.level === 'ERROR',
                    'text-[var(--color-eden-neon)]': log.level === 'SYSTEM',
                    'text-emerald-400': log.level === 'TERNARY'
                  }">
              [{{ log.level }}]
            </span>
            <span class="text-gray-300 whitespace-pre-wrap break-words font-mono"
                  [ngClass]="{
                    'text-red-300 font-bold': log.message.startsWith('[AGENT]'),
                    'bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-blue-400': log.level === 'SYSTEM' && log.message.includes('LOCAL')
                  }">
              {{ log.message }}
            </span>
          </div>
        }
        @if (terminal.logs().length === 0) {
          <div class="text-gray-600 italic">Waiting for system events...</div>
        }
      </div>

      <!-- Terminal Input -->
      <div class="p-2 bg-black/40 border-t border-[var(--color-eden-border)] flex items-center gap-2">
        <span class="text-[var(--color-eden-neon)] font-bold">root@eden:~#</span>
        <input 
          #cmdInput
          type="text" 
          class="flex-1 bg-transparent border-none outline-none text-white font-mono text-xs"
          placeholder="Type a command (e.g. /local create a node, /gemini analyze graph, clear)..."
          (keydown.enter)="executeCommand(cmdInput.value); cmdInput.value = ''"
          [disabled]="pipeline.isExecuting()"
        />
        <mat-icon *ngIf="pipeline.isExecuting()" class="text-[var(--color-eden-neon)] animate-spin" style="font-size: 14px; width: 14px; height: 14px;">autorenew</mat-icon>
      </div>
    </div>
  `
})
export class TerminalPanel implements AfterViewChecked {
  public terminal = inject(TerminalService);
  public ui = inject(AppUiService);
  public cliUi = inject(CliUiService);
  public pipeline = inject(EdenAiPipelineService);
  public engine = inject(CoreEngine);

  @ViewChild('scrollContainer') private scrollContainer!: ElementRef;

  terminalHeight = signal<number>(300);
  isMaximized = signal<boolean>(false);
  windowHeight = signal<number>(typeof window !== 'undefined' ? window.innerHeight : 800);

  toggleMaximize() {
    this.isMaximized.update(v => !v);
  }

  onResizeStart(event: PointerEvent) {
    event.preventDefault();
    event.stopPropagation();

    const startY = event.clientY;
    const startHeight = this.terminalHeight();

    const onPointerMove = (e: PointerEvent) => {
      const deltaY = startY - e.clientY;
      const maxHeight = (typeof window !== 'undefined' ? window.innerHeight : 800) - 80;
      const newHeight = Math.max(140, Math.min(maxHeight, startHeight + deltaY));
      this.terminalHeight.set(newHeight);
      this.isMaximized.set(false);
    };

    const onPointerUp = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  }

  ngAfterViewChecked() {
    this.scrollToBottom();
  }

  private scrollToBottom(): void {
    try {
      this.scrollContainer.nativeElement.scrollTop = this.scrollContainer.nativeElement.scrollHeight;
    } catch(err) { }
  }

  async executeCommand(cmd: string) {
    if (!cmd || !cmd.trim()) return;
    
    const trimmed = cmd.trim();
    this.terminal.log(trimmed, 'INFO'); // Echo command

    const lower = trimmed.toLowerCase();

    // Built-in Terminal Commands
    if (lower === 'clear') {
      this.terminal.clear();
      return;
    }

    if (lower === 'help') {
      this.terminal.log('=== EDEN TERNARY OS TERMINAL COMMANDS ===', 'SYSTEM');
      this.terminal.log('  status       - Display VM clock cycle, node count, and active AI model', 'INFO');
      this.terminal.log('  start / run  - Start continuous Ternary VM clock execution', 'INFO');
      this.terminal.log('  stop / pause - Pause Ternary VM clock execution', 'INFO');
      this.terminal.log('  step         - Advance 1 clock cycle', 'INFO');
      this.terminal.log('  autolayout   - Auto-arrange canvas nodes side-by-side with zero overlap', 'INFO');
      this.terminal.log('  truth        - Open Formal Verification Truth Table Matrix', 'INFO');
      this.terminal.log('  tasm         - Open TASM Studio, Verilog & C++ Transpiler', 'INFO');
      this.terminal.log('  scope        - Open Oscilloscope & Logic Analyzer', 'INFO');
      this.terminal.log('  circuits     - Open Useful Circuits Preset Library', 'INFO');
      this.terminal.log('  files        - Open Virtual File System (VFS)', 'INFO');
      this.terminal.log('  packages     - Open NPM Package Manager', 'INFO');
      this.terminal.log('  alu          - Synthesize Full Balanced Ternary ALU', 'INFO');
      this.terminal.log('  neuron       - Synthesize Neuromorphic Perceptron', 'INFO');
      this.terminal.log('  clear        - Clear terminal console', 'INFO');
      this.terminal.log('  /local <cmd> - Run local AI pipeline tool', 'INFO');
      this.terminal.log('  /gemini <cmd>- Run cloud Gemini AI pipeline tool', 'INFO');
      this.terminal.log('  /agent <local|gemini> <objective> - Launch autonomous agentic loop', 'INFO');
      return;
    }

    if (lower === 'status') {
      const nodes = Object.keys(this.engine.genome().nodes).length;
      const edges = Object.keys(this.engine.genome().edges).length;
      this.terminal.log(`VM Status: ${this.engine.isVmRunning() ? 'RUNNING' : 'PAUSED'} | Cycles: #${this.engine.vmCycles()}`, 'SYSTEM');
      this.terminal.log(`Graph: ${nodes} nodes, ${edges} edges | Frequency: ${this.engine.vmSpeed()} Hz`, 'INFO');
      this.terminal.log(`Active Provider: ${this.pipeline.activeProvider().toUpperCase()} [${this.pipeline.activeModel()}]`, 'INFO');
      return;
    }

    if (lower === 'start' || lower === 'run') {
      this.engine.startVM();
      this.terminal.log('Ternary Virtual Machine started.', 'SYSTEM');
      return;
    }

    if (lower === 'stop' || lower === 'pause') {
      this.engine.stopVM();
      this.terminal.log('Ternary Virtual Machine paused.', 'SYSTEM');
      return;
    }

    if (lower === 'step') {
      this.engine.stepVM();
      this.terminal.log(`VM advanced to cycle #${this.engine.vmCycles()}`, 'TERNARY');
      return;
    }

    if (lower === 'autolayout') {
      this.engine.autoLayout();
      this.terminal.log('Nodes auto-arranged side-by-side with zero overlap.', 'SYSTEM');
      return;
    }

    if (lower === 'truth' || lower === 'truthtable') {
      this.ui.toggleTruthTable();
      this.terminal.log('Toggled Formal Verification Truth Table.', 'SYSTEM');
      return;
    }

    if (lower === 'tasm') {
      this.ui.toggleTasmStudio();
      this.terminal.log('Toggled TASM Studio & Transpiler.', 'SYSTEM');
      return;
    }

    if (lower === 'scope' || lower === 'analyzer' || lower === 'oscilloscope') {
      this.ui.toggleLogicAnalyzer();
      this.terminal.log('Toggled Oscilloscope & Logic Analyzer.', 'SYSTEM');
      return;
    }

    if (lower === 'circuits' || lower === 'library') {
      this.ui.toggleCircuitLibrary();
      this.terminal.log('Toggled Useful Circuits Library.', 'SYSTEM');
      return;
    }

    if (lower === 'files' || lower === 'vfs') {
      this.ui.toggleFileExplorer();
      this.terminal.log('Toggled Virtual File System.', 'SYSTEM');
      return;
    }

    if (lower === 'packages' || lower === 'npm') {
      this.ui.togglePackageManager();
      this.terminal.log('Toggled NPM Package Manager.', 'SYSTEM');
      return;
    }

    if (lower === 'alu') {
      this.engine.synthesizeTernaryAlu();
      this.terminal.log('Synthesized Full Balanced Ternary ALU on canvas.', 'TERNARY');
      return;
    }

    if (lower === 'neuron') {
      this.engine.synthesizeTernaryNeuron();
      this.terminal.log('Synthesized Neuromorphic Perceptron on canvas.', 'TERNARY');
      return;
    }

    let engineName: 'local' | 'gemini' | null = null;
    let args = '';
    let isAgentic = false;

    if (trimmed.startsWith('/agent local ') || trimmed === '/agent local') {
      engineName = 'local';
      args = trimmed.replace('/agent local', '').trim();
      isAgentic = true;
    } else if (trimmed.startsWith('/agent gemini ') || trimmed === '/agent gemini') {
      engineName = 'gemini';
      args = trimmed.replace('/agent gemini', '').trim();
      isAgentic = true;
    } else if (trimmed.startsWith('/local ') || trimmed === '/local') {
      engineName = 'local';
      args = trimmed.replace('/local', '').trim();
    } else if (trimmed.startsWith('/gemini ') || trimmed === '/gemini') {
      engineName = 'gemini';
      args = trimmed.replace('/gemini', '').trim();
    } else {
      this.terminal.log(`Command not found: "${trimmed}". Type "help" for a list of commands or use /local, /gemini, /agent.`, 'ERROR');
      return;
    }

    if (isAgentic) {
      if (!args) {
        this.terminal.log(`Provide an objective. Usage: /agent ${engineName} <objective>`, 'ERROR');
        return;
      }
      this.cliUi.isOpen.set(true); // Open CLI Panel to show the Agentic Tracker
      await this.pipeline.executeAgenticLoop(engineName, args);
    } else {
      if (args.startsWith('-')) {
        await this.pipeline.executeRaw(engineName, args);
      } else {
        await this.pipeline.execute(engineName, args);
      }
    }
  }
}
