import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class AppUiService {
  isPackageManagerOpen = signal(false);
  isCodePreviewOpen = signal(false);
  isTerminalOpen = signal(false);
  isFileExplorerOpen = signal(false);
  isProviderHubOpen = signal(false);
  isTruthTableOpen = signal(false);
  isTasmStudioOpen = signal(false);
  isTelemetryHudOpen = signal(true);
  isLogicAnalyzerOpen = signal(false);
  isComponentPaletteOpen = signal(false);
  isCircuitLibraryOpen = signal(false);
  
  togglePackageManager() { this.isPackageManagerOpen.update(v => !v); }
  toggleCodePreview() { this.isCodePreviewOpen.update(v => !v); }
  toggleTerminal() { this.isTerminalOpen.update(v => !v); }
  toggleFileExplorer() { this.isFileExplorerOpen.update(v => !v); }
  toggleProviderHub() { this.isProviderHubOpen.update(v => !v); }
  toggleTruthTable() { this.isTruthTableOpen.update(v => !v); }
  toggleTasmStudio() { this.isTasmStudioOpen.update(v => !v); }
  toggleTelemetryHud() { this.isTelemetryHudOpen.update(v => !v); }
  toggleLogicAnalyzer() { this.isLogicAnalyzerOpen.update(v => !v); }
  toggleComponentPalette() { this.isComponentPaletteOpen.update(v => !v); }
  toggleCircuitLibrary() { this.isCircuitLibraryOpen.update(v => !v); }
}
