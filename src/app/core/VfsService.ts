import { Injectable, signal } from '@angular/core';

export interface VirtualFile {
  path: string;
  content: string;
  updatedAt: number;
}

/**
 * VfsService — Virtual File System for EDEN.
 * 
 * Provides an in-memory file system backed by localStorage.
 * Supports file upload from the user's machine and download to disk.
 * AI CLIs can read/write files through this service.
 */
@Injectable({ providedIn: 'root' })
export class VfsService {
  private filesState = signal<Record<string, VirtualFile>>({});
  public readonly files = this.filesState.asReadonly() as any as any;

  constructor() {
    this.loadFromLocalStorage();
  }

  writeFile(path: string, content: string) {
    this.filesState.update(current => ({
      ...current,
      [path]: { path, content, updatedAt: Date.now() }
    }));
    this.saveToLocalStorage();
  }

  readFile(path: string): string | null {
    return this.filesState()[path]?.content || null;
  }

  deleteFile(path: string) {
    this.filesState.update(current => {
      const newFiles = { ...current };
      delete (newFiles as any)[path];
      return newFiles;
    });
    this.saveToLocalStorage();
  }

  listFiles(): VirtualFile[] {
    return Object.values(this.filesState()).sort((a, b) => a.path.localeCompare(b.path));
  }

  /**
   * Upload files from the user's machine into the VFS.
   * Uses the File API to read file contents as text.
   */
  async uploadFiles(fileList: FileList): Promise<string[]> {
    const uploaded: string[] = [];

    for (const file of Array.from(fileList)) {
      try {
        const content = await this.readFileAsText(file);
        const path = '/' + file.name;
        this.writeFile(path, content);
        uploaded.push(path);
      } catch (e) {
        console.warn(`Failed to upload file: ${file.name}`, e);
      }
    }

    return uploaded;
  }

  /**
   * Upload a single file from a File object.
   */
  async uploadSingleFile(file: File, targetPath?: string): Promise<string> {
    const content = await this.readFileAsText(file);
    const path = targetPath || '/' + file.name;
    this.writeFile(path, content);
    return path;
  }

  /**
   * Download a file from the VFS to the user's machine.
   * Creates a Blob and triggers a browser download.
   */
  downloadFile(path: string): boolean {
    const file = this.filesState()[path];
    if (!file) return false;

    const blob = new Blob([file.content], { type: this.getMimeType(path) });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = this.getFileName(path);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return true;
  }

  /**
   * Export the entire VFS as a single ZIP-like JSON bundle.
   */
  exportAll(): void {
    const allFiles = this.filesState();
    const bundle = JSON.stringify(allFiles, null, 2);
    const blob = new Blob([bundle], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'eden_vfs_export_' + new Date().toISOString().replace(/[:.]/g, '-') + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Import an entire VFS bundle from a JSON file.
   */
  async importBundle(file: File): Promise<number> {
    const content = await this.readFileAsText(file);
    const parsed = JSON.parse(content) as Record<string, VirtualFile>;
    let count = 0;

    for (const [path, vFile] of Object.entries(parsed)) {
      if (vFile.path && vFile.content !== undefined) {
        this.writeFile(vFile.path, vFile.content);
        count++;
      }
    }

    return count;
  }

  // --- Private Helpers ---

  private readFileAsText(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file);
    });
  }

  private getFileName(path: string): string {
    const parts = path.split('/');
    return parts[parts.length - 1] || 'file';
  }

  private getMimeType(path: string): string {
    const ext = path.split('.').pop()?.toLowerCase();
    const mimeMap: Record<string, string> = {
      'ts': 'text/typescript',
      'js': 'text/javascript',
      'json': 'application/json',
      'html': 'text/html',
      'css': 'text/css',
      'md': 'text/markdown',
      'txt': 'text/plain',
      'xml': 'application/xml',
      'yaml': 'text/yaml',
      'yml': 'text/yaml',
      'py': 'text/x-python',
      'rs': 'text/x-rust',
      'go': 'text/x-go',
      'sh': 'text/x-shellscript',
      'bat': 'text/x-batch',
      'ps1': 'text/x-powershell',
      'svg': 'image/svg+xml',
      'csv': 'text/csv',
    };
    return mimeMap[ext || ''] || 'text/plain';
  }

  private saveToLocalStorage() {
    try {
      localStorage.setItem('eden_vfs_save', JSON.stringify(this.filesState()));
    } catch (e) {
      console.warn('VFS: Failed to save to localStorage', e);
    }
  }

  public loadFromLocalStorage() {
    try {
      const saved = localStorage.getItem('eden_vfs_save');
      if (saved) {
        this.filesState.set(JSON.parse(saved));
      } else {
        // Default files
        this.writeFile('/readme.md', '# EDEN Virtual File System\n\nWelcome to the VM space. The AI can read and write files here.\nYou can upload files from your machine and download files to your disk.');
      }
    } catch (e) {
      console.warn('VFS: Failed to load from localStorage', e);
    }
  }
}
