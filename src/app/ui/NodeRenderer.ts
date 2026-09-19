import { Component, input, output, inject, computed } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { EdenNode, TernaryValue } from '../types/node';
import { CoreEngine, CANVAS_BOUNDS, getNodeDimensions, getNodeHalfDimensions } from '../core/CoreEngine';
import { NgClass, NgComponentOutlet } from '@angular/common';
import { NodeFactory } from './NodeFactory';

@Component({
  selector: 'eden-node-renderer',
  standalone: true,
  imports: [MatIconModule, NgClass, NgComponentOutlet],
  template: `
    <div class="eden-node-container group absolute transform -translate-x-1/2 -translate-y-1/2 cursor-grab active:cursor-grabbing will-change-transform select-none" 
         [attr.data-node-id]="node().id"
         [style.left.px]="node().position.x" 
         [style.top.px]="node().position.y"
         (pointerdown)="onNodeMouseDown($event)">
      
      <!-- Ternary State Glow & Border -->
      <div class="absolute -inset-1 rounded-xl opacity-50 blur-md transition-colors duration-300 pointer-events-none"
           [ngClass]="{
             'bg-emerald-500': node().ternaryState === 'TRUE',
             'bg-red-500': node().ternaryState === 'FALSE',
             'bg-yellow-500': node().ternaryState === 'UNKNOWN'
           }"></div>

      <!-- Border Snap / Touch Indicator -->
      @if (touchesBorder().any) {
        <div class="absolute -inset-1.5 rounded-xl border-2 border-cyan-400/80 shadow-[0_0_12px_rgba(34,211,238,0.7)] animate-pulse pointer-events-none z-30">
          <div class="absolute -top-3.5 left-1/2 -translate-x-1/2 text-[9px] font-mono font-bold tracking-wider text-cyan-300 bg-slate-950/90 px-1.5 py-0.2 rounded border border-cyan-400/50 uppercase whitespace-nowrap">
            Boundary Contact [0px]
          </div>
        </div>
      }

      <!-- Node Content Wrapper with dynamic resizable width & height -->
      <div class="eden-node-card relative rounded-xl border-2 transition-colors duration-300 backdrop-blur-sm flex flex-col justify-between overflow-hidden"
           [style.width.px]="nodeWidth()"
           [style.min-height.px]="nodeHeight()"
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

        <!-- Quick Dimension Pill (Visible on hover when custom sized) -->
        @if (node().dimensions) {
          <div class="absolute top-1.5 right-6 pointer-events-none opacity-0 group-hover:opacity-80 transition-opacity z-20">
            <span class="text-[9px] font-mono bg-black/60 text-zinc-400 px-1 py-0.5 rounded border border-white/5">
              {{ nodeWidth() }}x{{ nodeHeight() }}
            </span>
          </div>
        }

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

        <div class="w-full flex-1 flex flex-col justify-between">
          <ng-container *ngComponentOutlet="getComponentClass(); inputs: { node: node() }"></ng-container>
        </div>

        <!-- Output Port (Right) - Only starts drags -->
        <div class="eden-port output-port absolute right-0 top-1/2 translate-x-1/2 -translate-y-1/2 w-5 h-5 rounded-full border-2 cursor-crosshair hover:scale-150 transition-transform z-20 shadow-[0_0_10px_var(--color-eden-neon)] flex items-center justify-center group/port"
             style="background-color: var(--color-eden-bg); border-color: var(--color-eden-neon);"
             data-port-type="output"
             [attr.data-node-id]="node().id"
             (pointerdown)="onOutputPortMouseDown($event)">
             <div class="w-2 h-2 rounded-full bg-[var(--color-eden-neon)] animate-pulse pointer-events-none"></div>
        </div>

        <!-- Resize Grip Handle (Bottom-Right Corner) -->
        <div class="eden-resize-handle absolute bottom-0 right-0 w-6 h-6 cursor-se-resize flex items-end justify-end p-1 z-30 opacity-60 hover:opacity-100 transition-opacity bg-gradient-to-tl from-zinc-800/80 to-transparent rounded-br-lg"
             title="Drag to resize node"
             (pointerdown)="onResizeMouseDown($event)">
          <svg class="w-3 h-3 text-zinc-400 hover:text-[var(--color-eden-neon)] pointer-events-none" viewBox="0 0 10 10" fill="currentColor">
            <circle cx="8" cy="8" r="1.2" />
            <circle cx="8" cy="4" r="1.2" />
            <circle cx="4" cy="8" r="1.2" />
          </svg>
        </div>

        <!-- Node Label (Bottom) -->
        <div class="absolute -bottom-7 left-0 right-0 flex justify-center pointer-events-none">
          <span class="text-[10px] font-mono text-gray-400 bg-[var(--color-eden-bg)]/90 px-2 py-0.5 rounded border border-white/5 opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap">
            {{ node().id }}
          </span>
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
  nodeResizeStart = output<{nodeId: string, event: MouseEvent, initialWidth: number, initialHeight: number}>();

  nodeDimensions = computed(() => getNodeDimensions(this.node()));
  nodeWidth = computed(() => this.node().dimensions?.width || this.nodeDimensions().width);
  nodeHeight = computed(() => this.node().dimensions?.height || this.nodeDimensions().height);

  touchesBorder = computed(() => {
    const pos = this.node().position;
    const { halfWidth, halfHeight } = getNodeHalfDimensions(this.node());
    const minAllowedX = CANVAS_BOUNDS.minX + halfWidth;
    const maxAllowedX = CANVAS_BOUNDS.maxX - halfWidth;
    const minAllowedY = CANVAS_BOUNDS.minY + halfHeight;
    const maxAllowedY = CANVAS_BOUNDS.maxY - halfHeight;

    const left = Math.abs(pos.x - minAllowedX) <= 2;
    const right = Math.abs(pos.x - maxAllowedX) <= 2;
    const top = Math.abs(pos.y - minAllowedY) <= 2;
    const bottom = Math.abs(pos.y - maxAllowedY) <= 2;

    return {
      left,
      right,
      top,
      bottom,
      any: left || right || top || bottom
    };
  });

  getComponentClass() {
    return NodeFactory.getComponent(this.node().type);
  }

  onNodeMouseDown(e: MouseEvent) {
    if (e.button !== 0) return; // Only left click drags node
    // Prevent node drag if clicking on a port
    if ((e.target as HTMLElement).closest('.eden-port')) return;
    // Prevent node drag if clicking on resize handle
    if ((e.target as HTMLElement).closest('.eden-resize-handle')) return;
    // Prevent node drag if clicking on an interactive control
    const targetTag = (e.target as HTMLElement).tagName.toLowerCase();
    if (targetTag === 'input' || targetTag === 'textarea' || targetTag === 'button') return;
    
    // CRITICAL: Stop propagation so canvas background does NOT start panning!
    e.stopPropagation();
    e.preventDefault();
    this.nodeDragStart.emit({ nodeId: this.node().id, event: e });
  }

  onResizeMouseDown(e: MouseEvent) {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    this.nodeResizeStart.emit({
      nodeId: this.node().id,
      event: e,
      initialWidth: this.nodeWidth(),
      initialHeight: this.nodeHeight()
    });
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
