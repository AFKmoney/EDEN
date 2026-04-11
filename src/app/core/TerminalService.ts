import { Injectable, signal } from '@angular/core';

export interface LogEntry {
  timestamp: number;
  level: 'INFO' | 'WARN' | 'ERROR' | 'SYSTEM' | 'TERNARY';
  message: string;
}

@Injectable({ providedIn: 'root' })
export class TerminalService {
  public logs = signal<LogEntry[]>([]);

  log(message: string, level: 'INFO' | 'WARN' | 'ERROR' | 'SYSTEM' | 'TERNARY' = 'INFO') {
    this.logs.update(current => {
      const newLogs = [...current, { timestamp: Date.now(), level, message }];
      // Keep only the last 100 logs to maintain performance
      return newLogs.slice(-100);
    });
  }

  clear() {
    this.logs.set([]);
    this.log('Terminal cleared.', 'SYSTEM');
  }
}
