import {ChangeDetectionStrategy, Component, inject} from '@angular/core';
import {PromptBar} from './ui/PromptBar';
import {SurfaceRenderer} from './ui/SurfaceRenderer';
import {CodePreviewPanel} from './ui/CodePreviewPanel';
import {TerminalPanel} from './ui/TerminalPanel';
import {PackageManagerPanel} from './ui/PackageManagerPanel';
import {CliPanel} from './ui/CliPanel';
import {Sidebar} from './ui/Sidebar';
import {FileExplorerPanel} from './ui/FileExplorerPanel';
import {CoreEngine} from './core/CoreEngine';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-root',
  imports: [PromptBar, SurfaceRenderer, CodePreviewPanel, TerminalPanel, PackageManagerPanel, CliPanel, Sidebar, FileExplorerPanel],
  template: `
    <main class="relative w-full h-screen overflow-hidden transition-all duration-700"
          [style.background-color]="'var(--color-eden-bg)'"
          [style.background-image]="dynamicBackground()"
          [style.--eden-hue]="dynamicHue()">
      
      <!-- Left Sidebar -->
      <eden-sidebar />

      <!-- Surface Canvas (Renders Nodes & Edges) -->
      <eden-surface />
      
      <!-- Synapse Interface -->
      <eden-prompt-bar />

      <!-- Package Manager Overlay -->
      <eden-package-manager />

      <!-- CLI Framework Panel -->
      <eden-cli-panel />

      <!-- Compiler & Runner -->
      <eden-code-preview />

      <!-- System Terminal -->
      <eden-terminal />

      <!-- VFS Explorer -->
      <eden-file-explorer />
    </main>
  `,
  styles: []
})
export class App {
  public engine = inject(CoreEngine);
  
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
