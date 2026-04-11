import { Component, input, output, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { EdenNode, TernaryValue } from '../types/node';
import { CoreEngine } from '../core/CoreEngine';
import { NgClass, NgComponentOutlet } from '@angular/common';
import { NodeFactory } from './NodeFactory';

@Component({
  selector: 'eden-node-renderer',
  standalone: true,
  imports: [MatIconModule, NgClass, NgComponentOutlet],
  template: `
    <div class="group absolute transform -translate-x-1/2 -translate-y-1/2 cursor-grab active:cursor-grabbing" 
         [style.left.px]="node().position.x" 
         [style.top.px]="node().position.y"
         (pointerdown)="onNodeMouseDown($event)">
      
      <!-- Ternary State Glow & Border -->
      <div class="absolute -inset-1 rounded-xl opacity-50 blur-md transition-colors duration-500 pointer-events-none"
           [ngClass]="{
             'bg-emerald-500': node().ternaryState === 'TRUE',
             'bg-red-500': node().ternaryState === 'FALSE',
             'bg-yellow-500': node().ternaryState === 'UNKNOWN'
           }"></div>

      <!-- Node Content Wrapper -->
      <div class="relative rounded-xl border-2 transition-colors duration-500"
           [ngClass]="{
             'border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.5)]': node().ternaryState === 'TRUE',
             'border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.5)]': node().ternaryState === 'FALSE',
             'border-yellow-500/50 shadow-[0_0_15px_rgba(234,179,8,0.2)]': node().ternaryState === 'UNKNOWN'
           }">
        
        <!-- Ternary Controls (Top Bar) -->
        <div class="absolute -top-8 left-0 right-0 flex justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-20">
          <div class="bg-[var(--color-eden-surface)] border border-[var(--color-eden-border)] rounded-full flex items-center p-1 gap-1 shadow-lg" (pointerdown)="$event.stopPropagation()">
            <button (click)="setTernary('TRUE')" class="w-6 h-6 rounded-full text-[10px] font-bold transition-colors" [ngClass]="node().ternaryState === 'TRUE' ? 'bg-emerald-500 text-white' : 'text-gray-500 hover:bg-emerald-500/20'">T</button>
            <button (click)="setTernary('UNKNOWN')" class="w-6 h-6 rounded-full text-[10px] font-bold transition-colors" [ngClass]="node().ternaryState === 'UNKNOWN' ? 'bg-yellow-500 text-white' : 'text-gray-500 hover:bg-yellow-500/20'">U</button>
            <button (click)="setTernary('FALSE')" class="w-6 h-6 rounded-full text-[10px] font-bold transition-colors" [ngClass]="node().ternaryState === 'FALSE' ? 'bg-red-500 text-white' : 'text-gray-500 hover:bg-red-500/20'">F</button>
          </div>
        </div>

        <!-- Delete Button (Visible on hover) -->
        <button 
          (click)="deleteNode($event)" 
          (pointerdown)="$event.stopPropagation()"
          class="absolute -top-3 -right-3 w-6 h-6 bg-red-500/10 text-red-500 border border-red-500/30 rounded-full opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center hover:bg-red-500 hover:text-white hover:scale-110 z-30 shadow-lg">
          <mat-icon style="font-size: 14px; width: 14px; height: 14px;">close</mat-icon>
        </button>

        <!-- Input Port (Left) - Only accepts drops -->
        <div class="eden-port input-port absolute left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 w-5 h-5 rounded-full border-2 cursor-crosshair hover:scale-150 transition-transform z-20 shadow-[0_0_10px_var(--color-eden-neon)] flex items-center justify-center group/port"
             style="background-color: var(--color-eden-bg); border-color: var(--color-eden-neon);"
             data-port-type="input"
             [attr.data-node-id]="node().id"
             (pointerup)="onInputPortMouseUp($event)"
             (pointerenter)="onInputPortEnter()"
             (pointerleave)="onInputPortLeave()">
             <div class="w-2 h-2 rounded-full bg-[var(--color-eden-neon)] opacity-0 group-hover/port:opacity-100 transition-opacity pointer-events-none"></div>
        </div>

        <ng-container *ngComponentOutlet="getComponentClass(); inputs: { node: node() }"></ng-container>

        <!-- Output Port (Right) - Only starts drags -->
        <div class="eden-port output-port absolute right-0 top-1/2 translate-x-1/2 -translate-y-1/2 w-5 h-5 rounded-full border-2 cursor-crosshair hover:scale-150 transition-transform z-20 shadow-[0_0_10px_var(--color-eden-neon)] flex items-center justify-center group/port"
             style="background-color: var(--color-eden-bg); border-color: var(--color-eden-neon);"
             data-port-type="output"
             [attr.data-node-id]="node().id"
             (pointerdown)="onOutputPortMouseDown($event)">
             <div class="w-2 h-2 rounded-full bg-[var(--color-eden-neon)] animate-pulse pointer-events-none"></div>
        </div>
      </div>
    </div>
  `
})
export class NodeRenderer {
  node = input.required<EdenNode>();
  private engine = inject(CoreEngine);
  
  portDragStart = output<{nodeId: string, event: MouseEvent}>();
  portDrop = output<string>();
  portHoverEnter = output<string>();
  portHoverLeave = output<string>();
  nodeDragStart = output<{nodeId: string, event: MouseEvent}>();

  getComponentClass() {
    return NodeFactory.getComponent(this.node().type);
  }

  onNodeMouseDown(e: MouseEvent) {
    // Prevent node drag if clicking on a port
    if ((e.target as HTMLElement).classList.contains('eden-port')) return;
    // Prevent node drag if clicking on an input or textarea
    if ((e.target as HTMLElement).tagName.toLowerCase() === 'input' || 
        (e.target as HTMLElement).tagName.toLowerCase() === 'textarea') return;
    
    e.preventDefault();
    this.nodeDragStart.emit({ nodeId: this.node().id, event: e });
  }

  onOutputPortMouseDown(e: MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    this.portDragStart.emit({ nodeId: this.node().id, event: e });
  }

  onInputPortMouseUp(e: MouseEvent) {
    e.stopPropagation();
    this.portDrop.emit(this.node().id);
  }

  onInputPortEnter() {
    this.portHoverEnter.emit(this.node().id);
  }

  onInputPortLeave() {
    this.portHoverLeave.emit(this.node().id);
  }

  deleteNode(e: MouseEvent) {
    e.stopPropagation();
    this.engine.deleteNode(this.node().id);
  }

  setTernary(state: TernaryValue) {
    this.engine.setNodeTernaryState(this.node().id, state);
  }
}
