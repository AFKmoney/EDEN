import { signal } from '@angular/core';

export interface WindowResizerOptions {
  storageKey?: string;
  defaultWidth?: number;
  defaultHeight?: number;
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
}

/**
 * WindowResizer
 * Manages reactive dimensions, edge/corner resizing, maximize/restore,
 * and localStorage persistence for EDEN floating and modal windows.
 */
export class WindowResizer {
  public width = signal<number>(850);
  public height = signal<number>(620);
  public isMaximized = signal<boolean>(false);
  public isResizing = signal<boolean>(false);

  private defaultWidth: number;
  private defaultHeight: number;
  private minWidth: number;
  private minHeight: number;
  private maxWidth: number;
  private maxHeight: number;
  private storageKey?: string;

  private preMaxWidth: number = 850;
  private preMaxHeight: number = 620;

  constructor(options: WindowResizerOptions = {}) {
    this.defaultWidth = options.defaultWidth ?? 850;
    this.defaultHeight = options.defaultHeight ?? 620;
    this.minWidth = options.minWidth ?? 420;
    this.minHeight = options.minHeight ?? 300;
    this.maxWidth = options.maxWidth ?? 1920;
    this.maxHeight = options.maxHeight ?? 1200;
    this.storageKey = options.storageKey;

    this.initSize();
  }

  private initSize() {
    let w = this.defaultWidth;
    let h = this.defaultHeight;

    if (typeof window !== 'undefined') {
      const maxAvailableW = Math.max(this.minWidth, window.innerWidth - 40);
      const maxAvailableH = Math.max(this.minHeight, window.innerHeight - 40);

      w = Math.min(w, maxAvailableW);
      h = Math.min(h, maxAvailableH);

      if (this.storageKey && typeof localStorage !== 'undefined') {
        try {
          const saved = localStorage.getItem(`eden_win_${this.storageKey}`);
          if (saved) {
            const parsed = JSON.parse(saved);
            if (typeof parsed.w === 'number' && parsed.w >= this.minWidth) {
              w = Math.min(parsed.w, maxAvailableW);
            }
            if (typeof parsed.h === 'number' && parsed.h >= this.minHeight) {
              h = Math.min(parsed.h, maxAvailableH);
            }
          }
        } catch {}
      }
    }

    this.width.set(w);
    this.height.set(h);
    this.preMaxWidth = w;
    this.preMaxHeight = h;
  }

  public toggleMaximize() {
    if (typeof window === 'undefined') return;

    if (this.isMaximized()) {
      // Restore
      this.isMaximized.set(false);
      this.width.set(this.preMaxWidth);
      this.height.set(this.preMaxHeight);
    } else {
      // Maximize
      this.preMaxWidth = this.width();
      this.preMaxHeight = this.height();
      this.isMaximized.set(true);

      const maxW = Math.max(this.minWidth, window.innerWidth - 32);
      const maxH = Math.max(this.minHeight, window.innerHeight - 32);
      this.width.set(maxW);
      this.height.set(maxH);
    }
  }

  public onResizeStart(event: PointerEvent, direction: 'corner' | 'right' | 'bottom') {
    if (this.isMaximized()) return;
    event.preventDefault();
    event.stopPropagation();

    const startX = event.clientX;
    const startY = event.clientY;
    const startW = this.width();
    const startH = this.height();

    const targetEl = event.target as HTMLElement;
    if (targetEl && targetEl.setPointerCapture) {
      try {
        targetEl.setPointerCapture(event.pointerId);
      } catch {}
    }

    this.isResizing.set(true);

    const onPointerMove = (moveEvent: PointerEvent) => {
      moveEvent.preventDefault();
      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;

      const maxAvailableW = typeof window !== 'undefined' ? Math.max(this.minWidth, window.innerWidth - 32) : this.maxWidth;
      const maxAvailableH = typeof window !== 'undefined' ? Math.max(this.minHeight, window.innerHeight - 32) : this.maxHeight;

      if (direction === 'corner' || direction === 'right') {
        const newW = Math.min(maxAvailableW, Math.max(this.minWidth, startW + deltaX));
        this.width.set(newW);
      }

      if (direction === 'corner' || direction === 'bottom') {
        const newH = Math.min(maxAvailableH, Math.max(this.minHeight, startH + deltaY));
        this.height.set(newH);
      }
    };

    const onPointerUp = (upEvent: PointerEvent) => {
      this.isResizing.set(false);

      if (targetEl && targetEl.releasePointerCapture) {
        try {
          targetEl.releasePointerCapture(upEvent.pointerId);
        } catch {}
      }

      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);

      // Save to localStorage
      if (this.storageKey && typeof localStorage !== 'undefined') {
        try {
          localStorage.setItem(
            `eden_win_${this.storageKey}`,
            JSON.stringify({ w: this.width(), h: this.height() })
          );
        } catch {}
      }
    };

    window.addEventListener('pointermove', onPointerMove, { passive: false });
    window.addEventListener('pointerup', onPointerUp);
  }
}
