import { Component, inject, signal, computed, ViewChild, ElementRef } from '@angular/core';
import { NgClass, NgIf, DatePipe } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { AppUiService } from '../core/AppUiService';
import { VfsService, VirtualFile } from '../core/VfsService';
import { TerminalService } from '../core/TerminalService';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'eden-file-explorer',
  standalone: true,
  imports: [NgClass, NgIf, MatIconModule, DragDropModule, DatePipe, FormsModule],
  template: `
    <div *ngIf="ui.isFileExplorerOpen()" class="fixed inset-0 z-50 pointer-events-none flex items-center justify-center">
      <div cdkDrag class="pointer-events-auto w-[850px] h-[550px] bg-[var(--color-eden-surface)] backdrop-blur-3xl border border-[var(--color-eden-border)] rounded-2xl shadow-2xl flex flex-col overflow-hidden"
           style="box-shadow: 0 0 40px rgba(168, 85, 247, 0.15);"
           (dragover)="onDragOver($event)"
           (drop)="onFileDrop($event)"
           (dragleave)="isDraggingOver.set(false)">
        
        <!-- Drag overlay -->
        <div *ngIf="isDraggingOver()" class="absolute inset-0 z-50 bg-purple-500/20 backdrop-blur-sm border-2 border-dashed border-purple-400 rounded-2xl flex items-center justify-center pointer-events-none">
          <div class="flex flex-col items-center gap-3">
            <mat-icon class="text-purple-300" style="font-size: 48px; width: 48px; height: 48px;">cloud_upload</mat-icon>
            <span class="text-purple-200 font-mono text-lg font-bold">Drop files here to upload</span>
          </div>
        </div>

        <!-- Header -->
        <div cdkDragHandle class="flex items-center justify-between p-4 border-b border-[var(--color-eden-border)] bg-gradient-to-r from-purple-500/10 to-transparent cursor-move">
          <div class="flex items-center gap-2">
            <mat-icon class="text-purple-400">folder_open</mat-icon>
            <h2 class="text-white font-mono font-bold tracking-wider">VIRTUAL FILE SYSTEM</h2>
          </div>
          <div class="flex items-center gap-2">
            <!-- Upload Button -->
            <button (click)="triggerUpload()" 
                    class="flex items-center gap-1 px-3 py-1.5 bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 rounded-lg hover:bg-emerald-500/30 transition-colors font-mono text-xs font-bold cursor-pointer">
              <mat-icon style="font-size: 14px; width: 14px; height: 14px;">upload_file</mat-icon>
              UPLOAD
            </button>
            <!-- Export All Button -->
            <button (click)="exportAll()" 
                    class="flex items-center gap-1 px-3 py-1.5 bg-blue-500/15 text-blue-400 border border-blue-500/30 rounded-lg hover:bg-blue-500/30 transition-colors font-mono text-xs font-bold cursor-pointer">
              <mat-icon style="font-size: 14px; width: 14px; height: 14px;">download</mat-icon>
              EXPORT ALL
            </button>
            <!-- Import Bundle Button -->
            <button (click)="triggerImport()" 
                    class="flex items-center gap-1 px-3 py-1.5 bg-yellow-500/15 text-yellow-400 border border-yellow-500/30 rounded-lg hover:bg-yellow-500/30 transition-colors font-mono text-xs font-bold cursor-pointer">
              <mat-icon style="font-size: 14px; width: 14px; height: 14px;">folder_zip</mat-icon>
              IMPORT
            </button>
            <button (click)="ui.toggleFileExplorer()" class="text-gray-400 hover:text-white transition-colors cursor-pointer ml-2">
              <mat-icon>close</mat-icon>
            </button>
          </div>
        </div>

        <!-- Hidden file inputs -->
        <input type="file" #fileUploadInput multiple (change)="onFileUpload($event)" class="hidden" />
        <input type="file" #importInput accept=".json" (change)="onImportBundle($event)" class="hidden" />

        <!-- Body -->
        <div class="flex-1 flex overflow-hidden">
          
          <!-- Sidebar: File List -->
          <div class="w-64 border-r border-[var(--color-eden-border)] bg-black/40 flex flex-col">
            <div class="p-2 border-b border-[var(--color-eden-border)] flex justify-between items-center">
              <span class="text-xs font-mono text-gray-400 uppercase tracking-wider">Files ({{ fileCount() }})</span>
              <button (click)="createNewFile()" class="text-gray-400 hover:text-white cursor-pointer">
                <mat-icon style="font-size: 16px; width: 16px; height: 16px;">note_add</mat-icon>
              </button>
            </div>
            <div class="flex-1 overflow-y-auto p-2 space-y-1">
              @for (file of vfs.listFiles(); track file.path) {
                <div (click)="selectFile(file)" 
                     class="group flex items-center justify-between p-2 rounded-md cursor-pointer transition-colors"
                     [ngClass]="selectedFile()?.path === file.path ? 'bg-purple-500/20 text-purple-300' : 'text-gray-300 hover:bg-white/5'">
                  <div class="flex items-center gap-2 overflow-hidden">
                    <mat-icon style="font-size: 16px; width: 16px; height: 16px;" class="shrink-0" [ngClass]="getFileIconColor(file.path)">{{ getFileIcon(file.path) }}</mat-icon>
                    <span class="text-xs font-mono truncate">{{ file.path }}</span>
                  </div>
                  <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button (click)="$event.stopPropagation(); downloadFile(file.path)" class="text-gray-500 hover:text-blue-400 transition-colors cursor-pointer">
                      <mat-icon style="font-size: 14px; width: 14px; height: 14px;">download</mat-icon>
                    </button>
                    <button (click)="$event.stopPropagation(); deleteFile(file.path)" class="text-gray-500 hover:text-red-400 transition-colors cursor-pointer">
                      <mat-icon style="font-size: 14px; width: 14px; height: 14px;">delete</mat-icon>
                    </button>
                  </div>
                </div>
              }
              @if (vfs.listFiles().length === 0) {
                <div class="text-xs text-gray-500 font-mono p-4 italic text-center flex flex-col items-center gap-2">
                  <mat-icon class="text-gray-600" style="font-size: 32px; width: 32px; height: 32px;">cloud_upload</mat-icon>
                  <span>No files in VFS.</span>
                  <span class="text-[10px] text-gray-600">Drag & drop files here or click UPLOAD</span>
                </div>
              }
            </div>
          </div>

          <!-- Main: Editor -->
          <div class="flex-1 flex flex-col bg-black/60">
            @if (selectedFile(); as file) {
              <div class="p-2 border-b border-[var(--color-eden-border)] flex items-center justify-between bg-black/40">
                <input type="text" [ngModel]="file.path" (ngModelChange)="updateFilePath($event)" class="bg-transparent border-none outline-none text-sm font-mono text-white w-full" />
                <div class="flex items-center gap-2 shrink-0 ml-4">
                  <span class="text-[10px] text-gray-500 font-mono">{{ getFileSize(file.content) }}</span>
                  <span class="text-[10px] text-gray-500 font-mono">{{ file.updatedAt | date:'short' }}</span>
                  <button (click)="downloadFile(file.path)" class="text-gray-400 hover:text-blue-400 transition-colors cursor-pointer" title="Download this file">
                    <mat-icon style="font-size: 16px; width: 16px; height: 16px;">download</mat-icon>
                  </button>
                </div>
              </div>
              <textarea 
                [ngModel]="file.content" 
                (ngModelChange)="updateFileContent($event)"
                class="flex-1 w-full bg-transparent border-none outline-none p-4 text-gray-300 font-mono text-sm resize-none focus:ring-0"
                spellcheck="false"
              ></textarea>
            } @else {
              <div class="flex-1 flex flex-col items-center justify-center text-gray-500 font-mono text-sm gap-3">
                <mat-icon class="text-gray-600" style="font-size: 48px; width: 48px; height: 48px;">description</mat-icon>
                <span>Select a file to edit</span>
                <span class="text-xs text-gray-600">or drag & drop files to upload</span>
              </div>
            }
          </div>
        </div>

        <!-- Status Bar -->
        <div class="flex items-center justify-between px-4 py-1.5 bg-black/40 border-t border-[var(--color-eden-border)] text-[10px] font-mono text-gray-500">
          <span>EDEN VFS v2.0 // {{ fileCount() }} files</span>
          <span>Drag & drop supported • Upload • Download • Export/Import</span>
        </div>
      </div>
    </div>
  `
})
export class FileExplorerPanel {
  public ui = inject(AppUiService);
  public vfs = inject(VfsService);
  private terminal = inject(TerminalService);

  @ViewChild('fileUploadInput') fileUploadInput!: ElementRef<HTMLInputElement>;
  @ViewChild('importInput') importInput!: ElementRef<HTMLInputElement>;

  selectedFile = signal<VirtualFile | null>(null);
  isDraggingOver = signal(false);

  fileCount = computed(() => this.vfs.listFiles().length);

  selectFile(file: VirtualFile) {
    this.selectedFile.set(file);
  }

  createNewFile() {
    const path = '/new_file_' + Math.random().toString(36).substr(2, 5) + '.txt';
    this.vfs.writeFile(path, '');
    this.selectFile({ path, content: '', updatedAt: Date.now() });
  }

  deleteFile(path: string) {
    this.vfs.deleteFile(path);
    if (this.selectedFile()?.path === path) {
      this.selectedFile.set(null);
    }
    this.terminal.log(`VFS: Deleted ${path}`, 'SYSTEM');
  }

  updateFilePath(newPath: string) {
    const current = this.selectedFile();
    if (current && newPath !== current.path) {
      this.vfs.deleteFile(current.path);
      this.vfs.writeFile(newPath, current.content);
      this.selectedFile.set({ ...current, path: newPath });
    }
  }

  updateFileContent(newContent: string) {
    const current = this.selectedFile();
    if (current) {
      this.vfs.writeFile(current.path, newContent);
      this.selectedFile.set({ ...current, content: newContent, updatedAt: Date.now() });
    }
  }

  // --- UPLOAD ---

  triggerUpload() {
    this.fileUploadInput.nativeElement.click();
  }

  async onFileUpload(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const uploaded = await this.vfs.uploadFiles(input.files);
    this.terminal.log(`VFS: Uploaded ${uploaded.length} file(s): ${uploaded.join(', ')}`, 'SYSTEM');

    // Select the first uploaded file
    if (uploaded.length > 0) {
      const file = this.vfs.listFiles().find(f => f.path === uploaded[0]);
      if (file) this.selectFile(file);
    }

    // Reset the input so re-uploading the same file triggers change
    input.value = '';
  }

  // --- DRAG & DROP ---

  onDragOver(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDraggingOver.set(true);
  }

  async onFileDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDraggingOver.set(false);

    if (!event.dataTransfer?.files || event.dataTransfer.files.length === 0) return;

    const uploaded = await this.vfs.uploadFiles(event.dataTransfer.files);
    this.terminal.log(`VFS: Drag-uploaded ${uploaded.length} file(s): ${uploaded.join(', ')}`, 'SYSTEM');

    if (uploaded.length > 0) {
      const file = this.vfs.listFiles().find(f => f.path === uploaded[0]);
      if (file) this.selectFile(file);
    }
  }

  // --- DOWNLOAD ---

  downloadFile(path: string) {
    const success = this.vfs.downloadFile(path);
    if (success) {
      this.terminal.log(`VFS: Downloaded ${path}`, 'SYSTEM');
    } else {
      this.terminal.log(`VFS: File not found: ${path}`, 'ERROR');
    }
  }

  // --- EXPORT / IMPORT ---

  exportAll() {
    this.vfs.exportAll();
    this.terminal.log('VFS: Exported all files as JSON bundle.', 'SYSTEM');
  }

  triggerImport() {
    this.importInput.nativeElement.click();
  }

  async onImportBundle(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    try {
      const count = await this.vfs.importBundle(input.files[0]);
      this.terminal.log(`VFS: Imported ${count} file(s) from bundle.`, 'SYSTEM');
    } catch (e: any) {
      this.terminal.log(`VFS: Import failed: ${e.message}`, 'ERROR');
    }

    input.value = '';
  }

  // --- Helpers ---

  getFileSize(content: string): string {
    const bytes = new TextEncoder().encode(content).length;
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  getFileIcon(path: string): string {
    const ext = path.split('.').pop()?.toLowerCase();
    const iconMap: Record<string, string> = {
      'ts': 'code', 'js': 'code', 'py': 'code', 'rs': 'code', 'go': 'code',
      'html': 'web', 'css': 'palette', 'json': 'data_object',
      'md': 'article', 'txt': 'description',
      'svg': 'image', 'png': 'image', 'jpg': 'image',
      'yaml': 'settings', 'yml': 'settings', 'toml': 'settings',
      'sh': 'terminal', 'bat': 'terminal', 'ps1': 'terminal',
    };
    return iconMap[ext || ''] || 'insert_drive_file';
  }

  getFileIconColor(path: string): string {
    const ext = path.split('.').pop()?.toLowerCase();
    const colorMap: Record<string, string> = {
      'ts': 'text-blue-400', 'js': 'text-yellow-400', 'py': 'text-green-400',
      'html': 'text-orange-400', 'css': 'text-pink-400', 'json': 'text-emerald-400',
      'md': 'text-gray-300', 'txt': 'text-gray-400',
      'rs': 'text-orange-300', 'go': 'text-cyan-400',
    };
    return colorMap[ext || ''] || 'text-gray-400';
  }
}
