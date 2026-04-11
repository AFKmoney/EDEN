import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class AppUiService {
  isPackageManagerOpen = signal(false);
  isCodePreviewOpen = signal(false);
  isTerminalOpen = signal(false);
  isFileExplorerOpen = signal(false);
  
  togglePackageManager() { this.isPackageManagerOpen.update(v => !v); }
  toggleCodePreview() { this.isCodePreviewOpen.update(v => !v); }
  toggleTerminal() { this.isTerminalOpen.update(v => !v); }
  toggleFileExplorer() { this.isFileExplorerOpen.update(v => !v); }
}
