import { Injectable, signal } from '@angular/core';
import { TernaryValue } from '../types/node';

@Injectable({ providedIn: 'root' })
export class TernaryAudioService {
  public isEnabled = signal<boolean>(false);
  public isAudioActive = this.isEnabled.asReadonly();
  public volume = signal<number>(0.15); // subtle ambient level

  private audioCtx: AudioContext | null = null;

  private initAudio() {
    if (!this.audioCtx && typeof window !== 'undefined') {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  public toggleAudio(): boolean {
    const next = !this.isEnabled();
    this.isEnabled.set(next);
    if (next) {
      this.initAudio();
      this.playClockTick(true);
    }
    return next;
  }

  public playTritPulse(trit: TernaryValue) {
    if (!this.isEnabled()) return;
    this.initAudio();
    if (!this.audioCtx) return;

    try {
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      const now = this.audioCtx.currentTime;
      let freq = 330; // UNKNOWN (0) - neutral E4
      let type: OscillatorType = 'sine';

      if (trit === 'TRUE') {
        freq = 659.25; // TRUE (+1) - crystal high E5
        type = 'triangle';
      } else if (trit === 'FALSE') {
        freq = 130.81; // FALSE (-1) - deep sub C3
        type = 'sawtooth';
      }

      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);

      const vol = this.volume();
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.exponentialRampToValueAtTime(vol * (trit === 'FALSE' ? 0.8 : 0.6), now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start(now);
      osc.stop(now + 0.13);
    } catch {
      // AudioContext interrupted or not permitted yet
    }
  }

  public playClockTick(isAccent = false) {
    if (!this.isEnabled()) return;
    this.initAudio();
    if (!this.audioCtx) return;

    try {
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      const now = this.audioCtx.currentTime;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(isAccent ? 880 : 440, now);
      osc.frequency.exponentialRampToValueAtTime(110, now + 0.04);

      gain.gain.setValueAtTime(this.volume() * 0.4, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.04);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start(now);
      osc.stop(now + 0.05);
    } catch {}
  }

  public playSynthesisSuccess() {
    if (!this.isEnabled()) return;
    this.initAudio();
    if (!this.audioCtx) return;

    try {
      const notes = [440, 554.37, 659.25, 880];
      const now = this.audioCtx.currentTime;
      notes.forEach((freq, idx) => {
        const osc = this.audioCtx!.createOscillator();
        const gain = this.audioCtx!.createGain();
        const time = now + idx * 0.06;

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, time);

        gain.gain.setValueAtTime(0.001, time);
        gain.gain.exponentialRampToValueAtTime(this.volume() * 0.5, time + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.2);

        osc.connect(gain);
        gain.connect(this.audioCtx!.destination);

        osc.start(time);
        osc.stop(time + 0.22);
      });
    } catch {}
  }
}
