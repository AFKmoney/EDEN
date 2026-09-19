import { Component, inject, computed, signal, HostListener } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { CoreEngine, CANVAS_BOUNDS, getNodeDimensions } from '../core/CoreEngine';
import { AppUiService } from '../core/AppUiService';
import { CliUiService } from '../core/CliUiService';
import { NodeRenderer } from './NodeRenderer';
import { ContextMenu, ContextMenuData } from './ContextMenu';
import { EdenNode } from '../types/node';
import { EdenEdge } from '../types/edge';

@Component({
  selector: 'eden-surface',
  standalone: true,
  imports: [NodeRenderer, DecimalPipe, MatIconModule, ContextMenu],
  template: `
    <div class="relative w-full h-full overflow-hidden bg-transparent cursor-grab active:cursor-grabbing select-none"
         (pointerdown)="onBackgroundMouseDown($event)"
         (contextmenu)="onContextMenu($event)"
         (wheel)="onWheel($event)">
         
      <!-- EDEN Watermark Logo -->
      <div class="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
        <h1 class="text-[25vw] font-black tracking-[0.2em] text-[var(--color-eden-neon)] opacity-[0.03] select-none" style="filter: blur(2px);">
          EDEN
        </h1>
      </div>

      <!-- World Transform Container -->
      <div class="absolute inset-0 origin-top-left z-10 will-change-transform"
           [style.transform]="'translate(' + panX() + 'px, ' + panY() + 'px) scale(' + zoom() + ')'">
        
        <!-- Background Grid (Sober) -->
        <div class="absolute inset-[-10000px] opacity-10 pointer-events-none" 
             style="background-image: radial-gradient(var(--color-eden-neon) 1px, transparent 1px); background-size: 40px 40px;">
        </div>

        <!-- Matrix Canvas Boundary Frame (Strict Containment Barrier) -->
        <div class="absolute pointer-events-none rounded-2xl transition-all duration-300 z-0"
             [style.left.px]="bounds.minX"
             [style.top.px]="bounds.minY"
             [style.width.px]="bounds.maxX - bounds.minX"
             [style.height.px]="bounds.maxY - bounds.minY"
             style="border: 2px dashed rgba(0, 255, 170, 0.35); box-shadow: inset 0 0 60px rgba(0, 255, 170, 0.03), 0 0 30px rgba(0, 255, 170, 0.08);">
          
          <!-- Outer Dimming Mask to visually emphasize the bounded workspace -->
          <div class="absolute inset-0 border border-[var(--color-eden-neon)]/20 rounded-2xl pointer-events-none"></div>

          <!-- Technical Corner Target Brackets -->
          <div class="absolute -top-3 -left-3 w-7 h-7 border-t-2 border-l-2 border-[var(--color-eden-neon)] opacity-80"></div>
          <div class="absolute -top-3 -right-3 w-7 h-7 border-t-2 border-r-2 border-[var(--color-eden-neon)] opacity-80"></div>
          <div class="absolute -bottom-3 -left-3 w-7 h-7 border-b-2 border-l-2 border-[var(--color-eden-neon)] opacity-80"></div>
          <div class="absolute -bottom-3 -right-3 w-7 h-7 border-b-2 border-r-2 border-[var(--color-eden-neon)] opacity-80"></div>

          <!-- Boundary Coordinate Badges -->
          <div class="absolute top-3 left-4 text-[10px] font-mono tracking-widest text-[var(--color-eden-neon)] bg-[var(--color-eden-bg)]/90 px-3 py-1 rounded-md border border-[var(--color-eden-neon)]/30 shadow-md flex items-center gap-2">
            <span class="w-2 h-2 rounded-full bg-[var(--color-eden-neon)] animate-ping"></span>
            MATRIX BOUNDARY &bull; [{{ bounds.minX }}, {{ bounds.minY }}] &rarr; [{{ bounds.maxX }}, {{ bounds.maxY }}]
          </div>

          <div class="absolute bottom-3 right-4 text-[10px] font-mono text-emerald-400 bg-[var(--color-eden-bg)]/90 px-3 py-1 rounded-md border border-emerald-500/30 shadow-md flex items-center gap-2">
            <mat-icon style="font-size: 13px; width: 13px; height: 13px;">lock</mat-icon>
            ZERO-OVERFLOW CONTAINMENT SHIELD ACTIVE
          </div>

          <!-- Subtle Cross Center Marker -->
          <div class="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 border-t border-b border-l border-r border-[var(--color-eden-neon)]/20 rounded-full flex items-center justify-center pointer-events-none">
            <div class="w-1.5 h-1.5 rounded-full bg-[var(--color-eden-neon)]/40"></div>
          </div>
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
          @for (edge of edgeList(); track edge.id) {
            @if (getNode(edge.sourceId) && getNode(edge.targetId)) {
              <g class="eden-edge pointer-events-auto cursor-pointer group" 
                 [attr.data-edge-id]="edge.id"
                 [attr.data-source-id]="edge.sourceId" 
                 [attr.data-target-id]="edge.targetId"
                 (click)="deleteEdge(edge.id)">
                <!-- Invisible wider path for easier clicking -->
                <path 
                  [attr.d]="generateEdgePath(getPortX(edge.sourceId, 'output'), getNode(edge.sourceId).position.y, getPortX(edge.targetId, 'input'), getNode(edge.targetId).position.y)"
                  fill="none"
                  stroke="transparent" 
                  stroke-width="20"
                />
                <!-- Visible Path with Energy Flow Animation -->
                <path 
                  [attr.d]="generateEdgePath(getPortX(edge.sourceId, 'output'), getNode(edge.sourceId).position.y, getPortX(edge.targetId, 'input'), getNode(edge.targetId).position.y)"
                  fill="none"
                  [attr.stroke]="getEdgeColor(edge.sourceId)" 
                  stroke-width="2"
                  stroke-opacity="0.6"
                  stroke-dasharray="8 8"
                  class="transition-all duration-300 group-hover:stroke-red-500 group-hover:stroke-opacity-100 group-hover:stroke-[3px]"
                  style="animation: eden-flow 1s linear infinite;"
                />
                <!-- Edge animated flow indicator with glow -->
                <circle r="4" [attr.fill]="getEdgeColor(edge.sourceId)" filter="url(#neon-glow)" class="group-hover:hidden">
                  <animateMotion 
                    dur="1.5s" 
                    repeatCount="indefinite"
                    [attr.path]="generateEdgePath(getPortX(edge.sourceId, 'output'), getNode(edge.sourceId).position.y, getPortX(edge.targetId, 'input'), getNode(edge.targetId).position.y)"
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
              (nodeResizeStart)="startNodeResize($event)"
              (portDragStart)="startPortDrag($event)"
              (portDrop)="handlePortDrop($event)"
              (portHoverEnter)="hoveredInputPortId.set($event)"
              (portHoverLeave)="hoveredInputPortId.set(null)"
            />
          }
        </div>
      </div>
      
      <!-- Top Left Overlay (Coordinates & Fluidity Status) -->
      <div class="absolute top-4 left-20 flex items-center gap-3 text-xs font-mono text-[var(--color-eden-neon)] opacity-80 pointer-events-none select-none z-20">
        <div class="bg-[var(--color-eden-surface)]/90 backdrop-blur-md px-3 py-1.5 rounded-lg border border-[var(--color-eden-border)] flex items-center gap-2">
          <span class="w-2 h-2 rounded-full bg-[var(--color-eden-neon)] animate-pulse"></span>
          <span>X: {{ panX() | number:'1.0-0' }} Y: {{ panY() | number:'1.0-0' }}</span>
          <span class="text-zinc-500">&bull;</span>
          <span>Zoom: {{ zoom() | number:'1.2-2' }}x</span>
        </div>
      </div>

      <!-- Quick Canvas Navigation Dock (Fluidity & Anti-Collision Controls at top-right) -->
      <div class="absolute top-4 right-4 flex items-center gap-1.5 bg-[var(--color-eden-surface)]/95 backdrop-blur-md p-1.5 rounded-xl border border-[var(--color-eden-border)] shadow-xl z-20"
           (pointerdown)="$event.stopPropagation()">
        
        <!-- Auto Layout Side-by-Side (Zero Overlap) -->
        <button (click)="engine.autoLayout()" 
                id="btn-canvas-autolayout"
                title="Arrange nodes side by side without overlapping"
                class="px-2.5 h-8 rounded-lg flex items-center gap-1.5 text-[11px] font-mono font-bold text-emerald-300 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 transition-colors cursor-pointer">
          <mat-icon style="font-size: 16px; width: 16px; height: 16px;">view_column</mat-icon>
          <span>Side-by-Side</span>
        </button>

        <!-- Add Component Palette -->
        <button (click)="appUi.toggleComponentPalette()" 
                id="btn-canvas-add-node"
                title="Add a Ternary Component"
                class="px-2.5 h-8 rounded-lg flex items-center gap-1.5 text-[11px] font-mono font-medium text-cyan-300 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 transition-colors cursor-pointer">
          <mat-icon style="font-size: 16px; width: 16px; height: 16px;">add_box</mat-icon>
          <span>Component</span>
        </button>

        <!-- Oscilloscope / Logic Analyzer -->
        <button (click)="appUi.toggleLogicAnalyzer()" 
                id="btn-canvas-oscilloscope"
                title="Open Oscilloscope & Logic Analyzer"
                class="px-2.5 h-8 rounded-lg flex items-center gap-1.5 text-[11px] font-mono font-medium text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 transition-colors cursor-pointer">
          <mat-icon style="font-size: 16px; width: 16px; height: 16px;">show_chart</mat-icon>
          <span>Oscilloscope</span>
        </button>

        <!-- Prebuilt Circuits -->
        <button (click)="appUi.toggleCircuitLibrary()" 
                id="btn-canvas-circuits"
                title="Library of Prebuilt Real Circuits"
                class="px-2.5 h-8 rounded-lg flex items-center gap-1.5 text-[11px] font-mono font-medium text-purple-300 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 transition-colors cursor-pointer">
          <mat-icon style="font-size: 16px; width: 16px; height: 16px;">developer_board</mat-icon>
          <span>Circuits</span>
        </button>

        <div class="w-[1px] h-5 bg-white/10 my-auto"></div>

        <button (click)="zoomIn()" 
                title="Zoom In"
                class="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer">
          <mat-icon style="font-size: 18px; width: 18px; height: 18px;">zoom_in</mat-icon>
        </button>
        <button (click)="zoomOut()" 
                title="Zoom Out"
                class="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer">
          <mat-icon style="font-size: 18px; width: 18px; height: 18px;">zoom_out</mat-icon>
        </button>
        <button (click)="resetZoom()" 
                title="Reset Zoom (100%)"
                class="px-2 h-8 rounded-lg flex items-center justify-center text-[11px] font-mono font-semibold text-zinc-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer">
          1:1
        </button>
        <button (click)="recenterView()" 
                title="Recenter Matrix"
                class="px-2.5 h-8 rounded-lg flex items-center gap-1 text-[11px] font-mono font-medium text-[var(--color-eden-neon)] hover:bg-[var(--color-eden-neon)]/10 transition-colors cursor-pointer">
          <mat-icon style="font-size: 16px; width: 16px; height: 16px;">center_focus_strong</mat-icon>
          <span>Center</span>
        </button>
      </div>

      <!-- Context-Adaptive Right Click Menu -->
      @if (contextMenuData(); as cmd) {
        <eden-context-menu [data]="cmd" (close)="contextMenuData.set(null)" />
      }
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
  public engine = inject(CoreEngine);
  public appUi = inject(AppUiService);
  public cliUi = inject(CliUiService);
  readonly bounds = CANVAS_BOUNDS;
  
  nodeList = computed<EdenNode[]>(() => Object.values(this.engine.genome().nodes) as EdenNode[]);
  edgeList = computed<EdenEdge[]>(() => Object.values(this.engine.genome().edges) as EdenEdge[]);

  draftEdge = signal<{sourceId: string, x: number, y: number} | null>(null);
  draggingNode = signal<{id: string, offsetX: number, offsetY: number} | null>(null);
  resizingNode = signal<{ id: string; startScreenX: number; startScreenY: number; initialWidth: number; initialHeight: number } | null>(null);
  hoveredInputPortId = signal<string | null>(null);
  contextMenuData = signal<ContextMenuData | null>(null);
  
  // Pan & Zoom State
  panX = signal(60);
  panY = signal(60);
  zoom = signal(1);
  isPanning = signal(false);

  // rAF throttling state for silky-smooth 60fps tracking
  private pendingPointerEvent: MouseEvent | null = null;
  private rafScheduled = false;

  getNode(id: string): EdenNode {
    return (this.engine.genome().nodes as Record<string, EdenNode>)[id];
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
    
    const dims = getNodeDimensions(node);
    const offset = dims.halfWidth + 8;
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
    // If context menu is open, dismiss it
    if (this.contextMenuData()) {
      this.contextMenuData.set(null);
    }

    // Only pan on left-click (0) or middle-click (1)
    if (e.button !== 0 && e.button !== 1) return;

    // CRITICAL: NEVER pan if clicking inside an interactive node element or control!
    const target = e.target as HTMLElement;
    if (
      target.closest('.eden-node-container') ||
      target.closest('.eden-port') ||
      target.closest('.eden-resize-handle') ||
      target.closest('.eden-edge') ||
      target.closest('button') ||
      target.closest('input') ||
      target.closest('textarea') ||
      target.closest('#eden-adaptive-context-menu')
    ) {
      return;
    }

    this.isPanning.set(true);
  }

  onContextMenu(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    const target = e.target as HTMLElement;
    const nodeEl = target.closest('[data-node-id]');
    const edgeEl = target.closest('[data-edge-id]');
    const worldPos = this.screenToWorld(e.clientX, e.clientY);

    if (nodeEl) {
      const nodeId = nodeEl.getAttribute('data-node-id') || '';
      this.contextMenuData.set({
        type: 'NODE',
        screenX: e.clientX,
        screenY: e.clientY,
        worldX: worldPos.x,
        worldY: worldPos.y,
        targetId: nodeId
      });
      return;
    }

    if (edgeEl) {
      const edgeId = edgeEl.getAttribute('data-edge-id') || '';
      this.contextMenuData.set({
        type: 'EDGE',
        screenX: e.clientX,
        screenY: e.clientY,
        worldX: worldPos.x,
        worldY: worldPos.y,
        targetId: edgeId
      });
      return;
    }

    // Default: Canvas Context Menu
    this.contextMenuData.set({
      type: 'CANVAS',
      screenX: e.clientX,
      screenY: e.clientY,
      worldX: worldPos.x,
      worldY: worldPos.y
    });
  }

  onWheel(e: WheelEvent) {
    e.preventDefault();
    const zoomSensitivity = 0.001;
    const delta = -e.deltaY * zoomSensitivity;
    const newZoom = Math.min(Math.max(0.2, this.zoom() * (1 + delta)), 2.5);

    // Zoom towards mouse cursor
    const zoomRatio = newZoom / this.zoom();
    this.panX.set(e.clientX - (e.clientX - this.panX()) * zoomRatio);
    this.panY.set(e.clientY - (e.clientY - this.panY()) * zoomRatio);
    this.zoom.set(newZoom);
  }

  zoomIn() {
    this.zoom.update(z => Math.min(2.5, z * 1.2));
  }

  zoomOut() {
    this.zoom.update(z => Math.max(0.2, z / 1.2));
  }

  resetZoom() {
    this.zoom.set(1.0);
  }

  recenterView() {
    this.panX.set(80);
    this.panY.set(80);
    this.zoom.set(0.85);
  }

  @HostListener('window:pointermove', ['$event'])
  onMouseMove(e: MouseEvent) {
    if (!this.isPanning() && !this.draftEdge() && !this.draggingNode() && !this.resizingNode()) return;

    this.pendingPointerEvent = e;
    if (!this.rafScheduled) {
      this.rafScheduled = true;
      requestAnimationFrame(() => {
        this.rafScheduled = false;
        const ev = this.pendingPointerEvent;
        if (!ev) return;

        // HIGHEST PRIORITY: Resizing and Dragging node takes absolute precedence over canvas pan
        if (this.resizingNode()) {
          const res = this.resizingNode()!;
          const deltaX = (ev.clientX - res.startScreenX) / this.zoom();
          const deltaY = (ev.clientY - res.startScreenY) / this.zoom();
          const newW = Math.max(200, Math.min(650, Math.round(res.initialWidth + deltaX)));
          const newH = Math.max(120, Math.min(480, Math.round(res.initialHeight + deltaY)));
          this.engine.resizeNode(res.id, newW, newH);
        } else if (this.draggingNode()) {
          const drag = this.draggingNode()!;
          const worldPos = this.screenToWorld(ev.clientX, ev.clientY);
          this.engine.moveNode(drag.id, worldPos.x - drag.offsetX, worldPos.y - drag.offsetY);
        } else if (this.draftEdge()) {
          const worldPos = this.screenToWorld(ev.clientX, ev.clientY);
          this.draftEdge.update(draft => draft ? { ...draft, x: worldPos.x, y: worldPos.y } : null);
        } else if (this.isPanning()) {
          this.panX.update(x => x + ev.movementX);
          this.panY.update(y => y + ev.movementY);
        }
      });
    }
  }

  @HostListener('window:pointerup', ['$event'])
  onMouseUp(e: MouseEvent) {
    const draft = this.draftEdge();
    const targetId = this.hoveredInputPortId();
    
    if (draft && targetId && draft.sourceId !== targetId) {
      this.engine.addEdge(draft.sourceId, targetId);
    }
    
    const drag = this.draggingNode();
    if (drag) {
      this.engine.ensureNodeDoesNotOverlap(drag.id);
    }

    const resizing = this.resizingNode();
    if (resizing) {
      this.engine.ensureNodeDoesNotOverlap(resizing.id);
    }
    
    this.draftEdge.set(null);
    this.draggingNode.set(null);
    this.resizingNode.set(null);
    this.isPanning.set(false);
  }

  @HostListener('window:keydown', ['$event'])
  onKeyDown(e: KeyboardEvent) {
    // If typing inside an input/textarea, do not capture single-letter hotkeys
    const target = e.target as HTMLElement | null;
    const isInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);

    // Ctrl+K or Cmd+K: Toggle AI Copilot
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      this.cliUi.toggle();
      return;
    }

    // Escape: close context menu, cancel draft edge
    if (e.key === 'Escape') {
      if (this.contextMenuData()) {
        this.contextMenuData.set(null);
        return;
      }
      if (this.draftEdge()) {
        this.draftEdge.set(null);
        return;
      }
    }

    if (isInput) return;

    // Spacebar: Toggle VM run/pause
    if (e.code === 'Space') {
      e.preventDefault();
      this.engine.toggleVM();
      return;
    }

    // 'T' / 't': Truth Table modal toggle
    if (e.key === 't' || e.key === 'T') {
      if (!e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        this.appUi.toggleTruthTable();
        return;
      }
    }

    // 'O' / 'o': Oscilloscope modal toggle
    if (e.key === 'o' || e.key === 'O') {
      if (!e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        this.appUi.toggleLogicAnalyzer();
        return;
      }
    }

    // 'L' / 'l': Auto Layout
    if (e.key === 'l' || e.key === 'L') {
      if (!e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        this.engine.autoLayout();
        return;
      }
    }

    // '0': Recenter canvas
    if (e.key === '0' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      this.recenterView();
      return;
    }
  }

  startNodeDrag(data: {nodeId: string, event: MouseEvent}) {
    // Explicitly prevent canvas pan from starting
    this.isPanning.set(false);
    this.contextMenuData.set(null);
    this.engine.saveMoveSnapshot();
    const node = this.getNode(data.nodeId);
    if (!node) return;
    const worldPos = this.screenToWorld(data.event.clientX, data.event.clientY);
    this.draggingNode.set({
      id: data.nodeId,
      offsetX: worldPos.x - node.position.x,
      offsetY: worldPos.y - node.position.y
    });
  }

  startNodeResize(data: { nodeId: string; event: MouseEvent; initialWidth: number; initialHeight: number }) {
    this.isPanning.set(false);
    this.contextMenuData.set(null);
    this.resizingNode.set({
      id: data.nodeId,
      startScreenX: data.event.clientX,
      startScreenY: data.event.clientY,
      initialWidth: data.initialWidth,
      initialHeight: data.initialHeight
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


