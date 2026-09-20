import {ChangeDetectionStrategy, Component, inject} from '@angular/core';
import {RouterOutlet} from '@angular/router';
import {FloatingChatButton} from './ui/FloatingChatButton';
import {SurfaceRenderer} from './ui/SurfaceRenderer';
import {CodePreviewPanel} from './ui/CodePreviewPanel';
import {TerminalPanel} from './ui/TerminalPanel';
import {PackageManagerPanel} from './ui/PackageManagerPanel';
import {ChatPanel} from './ui/ChatPanel';
import {Sidebar} from './ui/Sidebar';
import {FileExplorerPanel} from './ui/FileExplorerPanel';
import {ProviderHubPanel} from './ui/ProviderHubPanel';
import {TruthTableModal} from './ui/TruthTableModal';
import {TasmStudioModal} from './ui/TasmStudioModal';
import {TelemetryHud} from './ui/TelemetryHud';
import {LogicAnalyzerModal} from './ui/LogicAnalyzerModal';
import {ComponentPaletteModal} from './ui/ComponentPaletteModal';
import {CircuitLibraryModal} from './ui/CircuitLibraryModal';
import {CoreEngine} from './core/CoreEngine';
import {AppUiService} from './core/AppUiService';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-root',
  imports: [
    FloatingChatButton,
    SurfaceRenderer,
    CodePreviewPanel,
    TerminalPanel,
    PackageManagerPanel,
    ChatPanel,
    Sidebar,
    FileExplorerPanel,
    ProviderHubPanel,
    TruthTableModal,
    TasmStudioModal,
    TelemetryHud,
    LogicAnalyzerModal,
    ComponentPaletteModal,
    CircuitLibraryModal,
    RouterOutlet
  ],
  template: `
    <main class="relative w-full h-screen overflow-hidden transition-all duration-700"
          [style.background-color]="'var(--color-eden-bg)'"
          [style.background-image]="dynamicBackground()"
          [style.--eden-hue]="dynamicHue()">
      
      <!-- Left Sidebar -->
      <eden-sidebar />

      <!-- Surface Canvas (Renders Nodes & Edges) -->
      <eden-surface />
      
      <!-- Dedicated AI Chat Floating Trigger (No bottom bar popup, zero overlapping) -->
      <eden-floating-chat-button />

      <!-- Kernel Live Telemetry HUD -->
      @if (appUi.isTelemetryHudOpen()) {
        <eden-telemetry-hud />
      }

      <!-- Formal Verification Truth Table Modal -->
      @if (appUi.isTruthTableOpen()) {
        <eden-truth-table-modal />
      }

      <!-- TASM Studio & Transpiler Modal -->
      @if (appUi.isTasmStudioOpen()) {
        <eden-tasm-studio-modal />
      }

      <!-- Logic Analyzer & Real-time Oscilloscope Modal -->
      @if (appUi.isLogicAnalyzerOpen()) {
        <eden-logic-analyzer />
      }

      <!-- Component Palette Modal -->
      @if (appUi.isComponentPaletteOpen()) {
        <eden-component-palette />
      }

      <!-- Useful Circuits Library Modal -->
      @if (appUi.isCircuitLibraryOpen()) {
        <eden-circuit-library />
      }

      <!-- Package Manager Overlay -->
      <eden-package-manager />

      <!-- Ternary AI Chat & OS Controller -->
      <eden-chat-panel />

      <!-- AI Provider Hub Panel -->
      <eden-provider-hub />

      <!-- Compiler & Runner -->
      <eden-code-preview />

      <!-- System Terminal -->
      <eden-terminal />

      <!-- VFS Explorer -->
      <eden-file-explorer />

      <!-- Angular Routed Views (Marketplace, Login, Register, Profile) -->
      <div class="relative z-50">
        <router-outlet />
      </div>
    </main>
  `,
  styles: []
})
export class App {
  public engine = inject(CoreEngine);
  public appUi = inject(AppUiService);
  
  dynamicHue() {
    // Base 270 (Purple), shifts towards 330 (Pink/Magenta) based on activity
    return 270 + (this.engine.activityLevel() * 0.6);
  }

  dynamicBackground() {
    const activity = this.engine.activityLevel();
    // Create a subtle radial glow in the center that intensifies and expands with activity
    const opacity = (activity / 100) * 0.15; // Max 15% opacity
    const size = 30 + (activity / 100) * 40; // 30% to 70% size
    return `radial-gradient(circle at 50% 50%, hsla(var(--eden-hue), 80%, 60%, ${opacity}) 0%, transparent ${size}%)`;
  }
}
