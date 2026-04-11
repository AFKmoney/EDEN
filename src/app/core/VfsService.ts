import { Injectable, signal } from '@angular/core';

export interface VirtualFile {
  path: string;
  content: string;
  updatedAt: number;
}

@Injectable({ providedIn: 'root' })
export class VfsService {
  private filesState = signal<Record<string, VirtualFile>>({});
  public readonly files = this.filesState.asReadonly();

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
      delete newFiles[path];
      return newFiles;
    });
    this.saveToLocalStorage();
  }

  listFiles(): VirtualFile[] {
    return Object.values(this.filesState()).sort((a, b) => a.path.localeCompare(b.path));
  }

  private saveToLocalStorage() {
    try {
      localStorage.setItem('eden_vfs_save', JSON.stringify(this.filesState()));
    } catch (e) {}
  }

  public loadFromLocalStorage() {
    try {
      const saved = localStorage.getItem('eden_vfs_save');
      if (saved) {
        this.filesState.set(JSON.parse(saved));
      } else {
        // Default files
        this.writeFile('/readme.md', '# EDEN Virtual File System\\nWelcome to the VM space. The AI can read and write files here.');
      }
    } catch (e) {}
  }
}
