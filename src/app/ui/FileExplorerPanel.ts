import { Component, inject, signal, computed } from '@angular/core';
import { NgClass, NgIf, DatePipe } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { AppUiService } from '../core/AppUiService';
import { VfsService, VirtualFile } from '../core/VfsService';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'eden-file-explorer',
  standalone: true,
  imports: [NgClass, NgIf, MatIconModule, DragDropModule, DatePipe, FormsModule],
  template: `
    <div *ngIf="ui.isFileExplorerOpen()" class="fixed inset-0 z-50 pointer-events-none flex items-center justify-center">
      <div cdkDrag class="pointer-events-auto w-[800px] h-[500px] bg-[var(--color-eden-surface)] backdrop-blur-3xl border border-[var(--color-eden-border)] rounded-2xl shadow-2xl flex flex-col overflow-hidden"
           style="box-shadow: 0 0 40px rgba(168, 85, 247, 0.15);">
        
        <!-- Header -->
        <div cdkDragHandle class="flex items-center justify-between p-4 border-b border-[var(--color-eden-border)] bg-gradient-to-r from-purple-500/10 to-transparent cursor-move">
          <div class="flex items-center gap-2">
            <mat-icon class="text-purple-400">folder_open</mat-icon>
            <h2 class="text-white font-mono font-bold tracking-wider">VIRTUAL FILE SYSTEM</h2>
          </div>
          <button (click)="ui.toggleFileExplorer()" class="text-gray-400 hover:text-white transition-colors cursor-pointer">
            <mat-icon>close</mat-icon>
          </button>
        </div>

        <!-- Body -->
        <div class="flex-1 flex overflow-hidden">
          
          <!-- Sidebar: File List -->
          <div class="w-64 border-r border-[var(--color-eden-border)] bg-black/40 flex flex-col">
            <div class="p-2 border-b border-[var(--color-eden-border)] flex justify-between items-center">
              <span class="text-xs font-mono text-gray-400 uppercase tracking-wider">Files</span>
              <button (click)="createNewFile()" class="text-gray-400 hover:text-white cursor-pointer">
                <mat-icon style="font-size: 16px; width: 16px; height: 16px;">note_add</mat-icon>
              </button>
            </div>
            <div class="flex-1 overflow-y-auto p-2 space-y-1">
              @for (file of vfs.listFiles(); track file.path) {
                <div (click)="selectFile(file)" 
                     class="flex items-center justify-between p-2 rounded-md cursor-pointer transition-colors"
                     [ngClass]="selectedFile()?.path === file.path ? 'bg-purple-500/20 text-purple-300' : 'text-gray-300 hover:bg-white/5'">
                  <div class="flex items-center gap-2 overflow-hidden">
                    <mat-icon style="font-size: 16px; width: 16px; height: 16px;" class="shrink-0 text-gray-400">insert_drive_file</mat-icon>
                    <span class="text-xs font-mono truncate">{{ file.path }}</span>
                  </div>
                  <button (click)="$event.stopPropagation(); deleteFile(file.path)" class="text-gray-500 hover:text-red-400 opacity-0 hover:opacity-100 group-hover:opacity-100 transition-opacity">
                    <mat-icon style="font-size: 14px; width: 14px; height: 14px;">delete</mat-icon>
                  </button>
                </div>
              }
              @if (vfs.listFiles().length === 0) {
                <div class="text-xs text-gray-500 font-mono p-2 italic">No files in VFS.</div>
              }
            </div>
          </div>

          <!-- Main: Editor -->
          <div class="flex-1 flex flex-col bg-black/60">
            @if (selectedFile(); as file) {
              <div class="p-2 border-b border-[var(--color-eden-border)] flex items-center justify-between bg-black/40">
                <input type="text" [ngModel]="file.path" (ngModelChange)="updateFilePath($event)" class="bg-transparent border-none outline-none text-sm font-mono text-white w-full" />
                <span class="text-[10px] text-gray-500 font-mono shrink-0 ml-4">Last modified: {{ file.updatedAt | date:'short' }}</span>
              </div>
              <textarea 
                [ngModel]="file.content" 
                (ngModelChange)="updateFileContent($event)"
                class="flex-1 w-full bg-transparent border-none outline-none p-4 text-gray-300 font-mono text-sm resize-none focus:ring-0"
                spellcheck="false"
              ></textarea>
            } @else {
              <div class="flex-1 flex items-center justify-center text-gray-500 font-mono text-sm">
                Select a file to edit or create a new one.
              </div>
            }
          </div>
        </div>
      </div>
    </div>
  `
})
export class FileExplorerPanel {
  public ui = inject(AppUiService);
  public vfs = inject(VfsService);

  selectedFile = signal<VirtualFile | null>(null);

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
}
