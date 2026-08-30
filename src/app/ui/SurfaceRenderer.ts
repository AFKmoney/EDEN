import { Component, inject, computed, signal, HostListener } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { CoreEngine } from '../core/CoreEngine';
import { NodeRenderer } from './NodeRenderer';
n// Fix TypeScript strict mode
const { Object } = globalThis;

@Component({
  selector: 'eden-surface',
  standalone: true,
  imports: [NodeRenderer, DecimalPipe],
  template: `
    <div class="relative w-full h-full overflow-hidden bg-transparent cursor-grab active:cursor-grabbing"
         (pointerdown)="onBackgroundMouseDown($event)"
         (wheel)="onWheel($event)">
         
      <!-- EDEN Watermark Logo -->
      <div class="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
        <h1 class="text-[25vw] font-black tracking-[0.2em] text-[var(--color-eden-neon)] opacity-[0.03] select-none" style="filter: blur(2px);">
          EDEN
        </h1>
      </div>

      <!-- World Transform Container -->
      <div class="absolute inset-0 origin-top-left z-10"
           [style.transform]="'translate(' + panX() + 'px, ' + panY() + 'px) scale(' + zoom() + ')'">
        
        <!-- Background Grid (Sober) -->
        <div class="absolute inset-[-10000px] opacity-10 pointer-events-none" 
             style="background-image: radial-gradient(var(--color-eden-neon) 1px, transparent 1px); background-size: 40px 40px;">
        </div>

        <!-- Edges Layer (SVG) -->
        <svg class="absolute inset-0 w-full h-full pointer-events-none z-0" style="overflow: visible;">
          <defs>
            <filter id="neon-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>

          <!-- Established Edges -->
          @for (edge of edgeList() as any as any; track (edge as any).id) {
            @if (getNode((edge as any).sourceId) && getNode((edge as any).targetId)) {
              <g class="eden-edge pointer-events-auto cursor-pointer group" 
                 [attr.data-edge-id]="(edge as any).id"
                 [attr.data-source-id]="(edge as any).sourceId" 
                 [attr.data-target-id]="(edge as any).targetId"
                 (click)="deleteEdge((edge as any).id)">
                <!-- Invisible wider path for easier clicking -->
                <path 
                  [attr.d]="generateEdgePath(getPortX((edge as any).sourceId, 'output'), getNode((edge as any).sourceId).position.y, getPortX((edge as any).targetId, 'input'), getNode((edge as any).targetId).position.y)"
                  fill="none"
                  stroke="transparent" 
                  stroke-width="20"
                />
                <!-- Visible Path with Energy Flow Animation -->
                <path 
                  [attr.d]="generateEdgePath(getPortX((edge as any).sourceId, 'output'), getNode((edge as any).sourceId).position.y, getPortX((edge as any).targetId, 'input'), getNode((edge as any).targetId).position.y)"
                  fill="none"
                  [attr.stroke]="getEdgeColor((edge as any).sourceId)" 
                  stroke-width="2"
                  stroke-opacity="0.6"
                  stroke-dasharray="8 8"
                  class="transition-all duration-300 group-hover:stroke-red-500 group-hover:stroke-opacity-100 group-hover:stroke-[3px]"
                  style="animation: eden-flow 1s linear infinite;"
                />
                <!-- Edge animated flow indicator with glow -->
                <circle r="4" [attr.fill]="getEdgeColor((edge as any).sourceId)" filter="url(#neon-glow)" class="group-hover:hidden">
                  <animateMotion 
                    dur="1.5s" 
                    repeatCount="indefinite"
                    [attr.path]="generateEdgePath(getPortX((edge as any).sourceId, 'output'), getNode((edge as any).sourceId).position.y, getPortX((edge as any).targetId, 'input'), getNode((edge as any).targetId).position.y)"
                  />
                </circle>
              </g>
            }
          }

          <!-- Draft Edge (Hot-linking) -->
          @if (draftEdge(); as draft) {
            @if (getNode(draft.sourceId)) {
              <path 
                [attr.d]="generateEdgePath(getPortX(draft.sourceId, 'output'), getNode(draft.sourceId).position.y, draft.x, draft.y)"
                fill="none"
                stroke="var(--color-eden-neon)" 
                stroke-width="3"
                stroke-dasharray="8 8"
                class="eden-draft-edge animate-pulse pointer-events-none"
                filter="url(#neon-glow)"
                style="animation: eden-flow 1s linear infinite;"
              />
            }
          }
        </svg>

        <!-- Nodes Layer -->
        <div class="absolute inset-0 z-10">
          @for (node of nodeList(); track node.id) {
            <eden-node-renderer 
              [node]="node" 
              (nodeDragStart)="startNodeDrag($event)"
              (portDragStart)="startPortDrag($event)"
              (portDrop)="handlePortDrop($event)"
              (portHoverEnter)="hoveredInputPortId.set($event)"
              (portHoverLeave)="hoveredInputPortId.set(null)"
            />
          }
        </div>
      </div>
      
      <!-- UI Overlay (Coordinates) -->
      <div class="absolute top-4 left-4 text-xs font-mono text-[var(--color-eden-neon)] opacity-60 pointer-events-none">
        X: {{ panX() | number:'1.0-0' }} Y: {{ panY() | number:'1.0-0' }} | Zoom: {{ zoom() | number:'1.2-2' }}x
      </div>
    </div>
  `,
  styles: [`
    @keyframes eden-flow {
      from { stroke-dashoffset: 16; }
      to { stroke-dashoffset: 0; }
    }
  `]
})
export class SurfaceRenderer {
  private engine = inject(CoreEngine);
  
  nodeList = computed(() => Object.values(this.engine.genome().nodes));
  edgeList = computed(() => Object.values(this.engine.genome().edges));

  draftEdge = signal<{sourceId: string, x: number, y: number} | null>(null);
  draggingNode = signal<{id: string, offsetX: number, offsetY: number} | null>(null);
  hoveredInputPortId = signal<string | null>(null);
  
  // Pan & Zoom State
  panX = signal(0);
  panY = signal(0);
  zoom = signal(1);
  isPanning = signal(false);

  getNode(id: string) {
    return this.engine.genome().nodes[id];
  }

  getEdgeColor(sourceId: string): string {
    const node = this.getNode(sourceId);
    if (!node) return 'var(--color-eden-neon)';
    if (node.ternaryState === 'TRUE') return '#10b981'; // emerald-500
    if (node.ternaryState === 'FALSE') return '#ef4444'; // red-500
    if (node.ternaryState === 'UNKNOWN') return '#eab308'; // yellow-500
    return 'var(--color-eden-neon)';
  }

  getPortX(nodeId: string, portType: 'input' | 'output'): number {
    const node = this.getNode(nodeId);
    if (!node) return 0;
    
    // Approximate half-widths based on Tailwind classes used in node components
    // UiNode: w-80 (320px) -> half is 160
    // LogicNode: w-64 (256px) -> half is 128
    // DataNode: w-72 (288px) -> half is 144
    let halfWidth = 128;
    if (node.type === 'UI') halfWidth = 160;
    if (node.type === 'Data') halfWidth = 144;

    // Add a small offset (10px) to account for the port's own width and border
    const offset = halfWidth + 10;
    
    return portType === 'output' ? node.position.x + offset : node.position.x - offset;
  }

  deleteEdge(edgeId: string) {
    this.engine.deleteEdge(edgeId);
  }

  screenToWorld(x: number, y: number) {
    return {
      x: (x - this.panX()) / this.zoom(),
      y: (y - this.panY()) / this.zoom()
    };
  }

  generateEdgePath(x1: number, y1: number, x2: number, y2: number): string {
    const dx = Math.max(Math.abs(x2 - x1) * 0.5, 50);
    return 'M ' + x1 + ' ' + y1 + ' C ' + (x1 + dx) + ' ' + y1 + ', ' + (x2 - dx) + ' ' + y2 + ', ' + x2 + ' ' + y2;
  }

  onBackgroundMouseDown(e: MouseEvent) {
    // Only pan if clicking directly on the background container or SVG
    if ((e.target as HTMLElement).tagName.toLowerCase() === 'div' || (e.target as HTMLElement).tagName.toLowerCase() === 'svg') {
      this.isPanning.set(true);
    }
  }

  onWheel(e: WheelEvent) {
    e.preventDefault();
    const zoomSensitivity = 0.001;
    const delta = -e.deltaY * zoomSensitivity;
    const newZoom = Math.min(Math.max(0.1, this.zoom() * (1 + delta)), 3);

    // Zoom towards mouse cursor
    const zoomRatio = newZoom / this.zoom();
    this.panX.set(e.clientX - (e.clientX - this.panX()) * zoomRatio);
    this.panY.set(e.clientY - (e.clientY - this.panY()) * zoomRatio);
    this.zoom.set(newZoom);
  }

  @HostListener('window:pointermove', ['$event'])
  onMouseMove(e: MouseEvent) {
    if (this.isPanning()) {
      this.panX.update(x => x + e.movementX);
      this.panY.update(y => y + e.movementY);
    } else if (this.draftEdge()) {
      const worldPos = this.screenToWorld(e.clientX, e.clientY);
      this.draftEdge.update(draft => draft ? { ...draft, x: worldPos.x, y: worldPos.y } : null);
    } else if (this.draggingNode()) {
      const drag = this.draggingNode()!;
      const worldPos = this.screenToWorld(e.clientX, e.clientY);
      this.engine.moveNode(drag.id, worldPos.x - drag.offsetX, worldPos.y - drag.offsetY);
    }
  }

  @HostListener('window:pointerup', ['$event'])
  onMouseUp(e: MouseEvent) {
    const draft = this.draftEdge();
    const targetId = this.hoveredInputPortId();
    
    // Robust hot-linking: if we release the pointer while a draft edge exists AND we are hovering over an input port
    if (draft && targetId && draft.sourceId !== targetId) {
      this.engine.addEdge(draft.sourceId, targetId);
    }
    
    this.draftEdge.set(null);
    this.draggingNode.set(null);
    this.isPanning.set(false);
  }

  startNodeDrag(data: {nodeId: string, event: MouseEvent}) {
    this.engine.saveMoveSnapshot();
    const node = this.getNode(data.nodeId);
    const worldPos = this.screenToWorld(data.event.clientX, data.event.clientY);
    this.draggingNode.set({
      id: data.nodeId,
      offsetX: worldPos.x - node.position.x,
      offsetY: worldPos.y - node.position.y
    });
  }

  startPortDrag(data: {nodeId: string, event: MouseEvent}) {
    const worldPos = this.screenToWorld(data.event.clientX, data.event.clientY);
    this.draftEdge.set({ sourceId: data.nodeId, x: worldPos.x, y: worldPos.y });
  }

  handlePortDrop(targetId: string) {
    const draft = this.draftEdge();
    if (draft && draft.sourceId !== targetId) {
      this.engine.addEdge(draft.sourceId, targetId);
    }
    this.draftEdge.set(null);
  }
}
