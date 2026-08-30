/**
 * Agent Persistence Service
 * Handles saving and restoring agents and their state
 */

import { Injectable, inject } from '@angular/core';
import { VfsService } from './VfsService';
import { CoreEngine } from './CoreEngine';
import { TerminalService } from './TerminalService';

export interface AgentSnapshot {
  id: string;
  name: string;
  description?: string;
  nodes: Record<string, any>;
  connections: any[];
  metadata: {
    createdAt: number;
    updatedAt: number;
    version: string;
    author?: string;
    tags?: string[];
  };
}

export interface AgentTemplate {
  id: string;
  name: string;
  description: string;
  author: string;
  authorId: string;
  nodes: Record<string, any>;
  connections: any[];
  metadata: {
    createdAt: number;
    updatedAt: number;
    version: string;
    tags: string[];
    category: string;
    isPublic: boolean;
    downloadCount: number;
    rating: number;
    likeCount: number;
  };
}

@Injectable({ providedIn: 'root' })
export class AgentPersistenceService {
  private vfs = inject(VfsService);
  private engine = inject(CoreEngine);
  private terminal = inject(TerminalService);

  private readonly AGENTS_DIR = '/agents';
  private readonly TEMPLATES_DIR = '/templates';
  private readonly SNAPSHOTS_DIR = '/snapshots';

  constructor() {
    this.initialize();
  }

  private initialize(): void {
    // Create directories if they don't exist
    [this.AGENTS_DIR, this.TEMPLATES_DIR, this.SNAPSHOTS_DIR].forEach(dir => {
      if (!this.vfs.exists(dir)) {
        this.vfs.createDirectory(dir);
      }
    });
    
    this.terminal.log('Agent Persistence Service initialized', 'SYSTEM');
  }

  // ============================================
  // Agent Saving & Restoring
  // ============================================

  /**
   * Save current agent state as a snapshot
   */
  saveAgent(agent: {
    id?: string;
    name: string;
    description?: string;
    tags?: string[];
  }): AgentSnapshot {
    const state = this.engine.getState();
    const snapshot: AgentSnapshot = {
      id: agent.id || `agent_${Date.now()}`,
      name: agent.name,
      description: agent.description,
      nodes: { ...state.nodes },
      connections: [...state.connections],
      metadata: {
        createdAt: agent.id ? this.getAgent(agent.id)?.metadata.createdAt || Date.now() : Date.now(),
        updatedAt: Date.now(),
        version: '1.0.0',
        author: this.getCurrentUser(),
        tags: agent.tags || []
      }
    };

    const path = `${this.AGENTS_DIR}/${snapshot.id}.json`;
    this.vfs.writeFile(path, JSON.stringify(snapshot, null, 2));

    this.terminal.log(`Agent: Saved - ${snapshot.name} (${snapshot.id})`, 'SYSTEM');
    return snapshot;
  }

  /**
   * Update an existing agent
   */
  updateAgent(agentId: string, updates: Partial<Omit<AgentSnapshot, 'id' | 'nodes' | 'connections'>>): AgentSnapshot | null {
    const snapshot = this.getAgent(agentId);
    
    if (!snapshot) {
      this.terminal.log(`Agent: Not found - ${agentId}`, 'ERROR');
      return null;
    }

    const updated: AgentSnapshot = {
      ...snapshot,
      ...updates,
      metadata: {
        ...snapshot.metadata,
        ...updates.metadata,
        updatedAt: Date.now()
      }
    };

    const path = `${this.AGENTS_DIR}/${agentId}.json`;
    this.vfs.writeFile(path, JSON.stringify(updated, null, 2));

    this.terminal.log(`Agent: Updated - ${updated.name} (${agentId})`, 'SYSTEM');
    return updated;
  }

  /**
   * Restore an agent from snapshot
   */
  restoreAgent(agentId: string): boolean {
    const snapshot = this.getAgent(agentId);
    
    if (!snapshot) {
      this.terminal.log(`Agent: Cannot restore - not found: ${agentId}`, 'ERROR');
      return false;
    }

    // Clear current state
    this.engine.mutate({
      nodes: {},
      connections: []
    });

    // Restore nodes and connections
    this.engine.mutate({
      nodes: snapshot.nodes,
      connections: snapshot.connections
    });

    this.terminal.log(`Agent: Restored - ${snapshot.name} (${agentId})`, 'SYSTEM');
    return true;
  }

  /**
   * Get an agent by ID
   */
  getAgent(agentId: string): AgentSnapshot | null {
    const path = `${this.AGENTS_DIR}/${agentId}.json`;
    
    if (!this.vfs.exists(path)) {
      return null;
    }

    try {
      const content = this.vfs.readFile(path);
      return JSON.parse(content) as AgentSnapshot;
    } catch (error) {
      this.terminal.log(`Agent: Error reading - ${agentId}: ${error}`, 'ERROR');
      return null;
    }
  }

  /**
   * Get all saved agents
   */
  getAllAgents(): AgentSnapshot[] {
    const agents: AgentSnapshot[] = [];
    const files = this.vfs.listFiles(this.AGENTS_DIR);

    for (const file of files) {
      if (file.endsWith('.json')) {
        try {
          const content = this.vfs.readFile(`${this.AGENTS_DIR}/${file}`);
          agents.push(JSON.parse(content) as AgentSnapshot);
        } catch {
          // Skip invalid files
        }
      }
    }

    // Sort by updatedAt (newest first)
    agents.sort((a, b) => b.metadata.updatedAt - a.metadata.updatedAt);
    return agents;
  }

  /**
   * Delete an agent
   */
  deleteAgent(agentId: string): boolean {
    const path = `${this.AGENTS_DIR}/${agentId}.json`;
    
    if (!this.vfs.exists(path)) {
      return false;
    }

    this.vfs.deleteFile(path);
    this.terminal.log(`Agent: Deleted - ${agentId}`, 'SYSTEM');
    return true;
  }

  /**
   * Export agent as JSON string
   */
  exportAgent(agentId: string): string | null {
    const snapshot = this.getAgent(agentId);
    return snapshot ? JSON.stringify(snapshot, null, 2) : null;
  }

  /**
   * Import agent from JSON string
   */
  importAgent(jsonString: string): AgentSnapshot | null {
    try {
      const snapshot = JSON.parse(jsonString) as AgentSnapshot;
      
      // Validate required fields
      if (!snapshot.id || !snapshot.name || !snapshot.nodes) {
        this.terminal.log('Agent: Invalid import - missing required fields', 'ERROR');
        return null;
      }

      // Save to VFS
      const path = `${this.AGENTS_DIR}/${snapshot.id}.json`;
      this.vfs.writeFile(path, JSON.stringify(snapshot, null, 2));

      this.terminal.log(`Agent: Imported - ${snapshot.name} (${snapshot.id})`, 'SYSTEM');
      return snapshot;
      
    } catch (error) {
      this.terminal.log(`Agent: Import error - ${error}`, 'ERROR');
      return null;
    }
  }

  // ============================================
  // Snapshot Management
  // ============================================

  /**
   * Create a snapshot of current state
   */
  createSnapshot(name: string, description?: string): AgentSnapshot {
    const state = this.engine.getState();
    const snapshot: AgentSnapshot = {
      id: `snapshot_${Date.now()}`,
      name,
      description,
      nodes: { ...state.nodes },
      connections: [...state.connections],
      metadata: {
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: '1.0.0',
        author: this.getCurrentUser(),
        tags: ['snapshot']
      }
    };

    const path = `${this.SNAPSHOTS_DIR}/${snapshot.id}.json`;
    this.vfs.writeFile(path, JSON.stringify(snapshot, null, 2));

    this.terminal.log(`Snapshot: Created - ${name} (${snapshot.id})`, 'SYSTEM');
    return snapshot;
  }

  /**
   * Restore from snapshot
   */
  restoreSnapshot(snapshotId: string): boolean {
    const path = `${this.SNAPSHOTS_DIR}/${snapshotId}.json`;
    
    if (!this.vfs.exists(path)) {
      return false;
    }

    try {
      const content = this.vfs.readFile(path);
      const snapshot = JSON.parse(content) as AgentSnapshot;
      
      // Restore state
      this.engine.mutate({
        nodes: snapshot.nodes,
        connections: snapshot.connections
      });

      this.terminal.log(`Snapshot: Restored - ${snapshot.name} (${snapshotId})`, 'SYSTEM');
      return true;
      
    } catch (error) {
      this.terminal.log(`Snapshot: Restore error - ${error}`, 'ERROR');
      return false;
    }
  }

  /**
   * Get all snapshots
   */
  getAllSnapshots(): AgentSnapshot[] {
    const snapshots: AgentSnapshot[] = [];
    const files = this.vfs.listFiles(this.SNAPSHOTS_DIR);

    for (const file of files) {
      if (file.endsWith('.json')) {
        try {
          const content = this.vfs.readFile(`${this.SNAPSHOTS_DIR}/${file}`);
          snapshots.push(JSON.parse(content) as AgentSnapshot);
        } catch {
          // Skip invalid files
        }
      }
    }

    snapshots.sort((a, b) => b.metadata.updatedAt - a.metadata.updatedAt);
    return snapshots;
  }

  /**
   * Delete a snapshot
   */
  deleteSnapshot(snapshotId: string): boolean {
    const path = `${this.SNAPSHOTS_DIR}/${snapshotId}.json`;
    
    if (!this.vfs.exists(path)) {
      return false;
    }

    this.vfs.deleteFile(path);
    this.terminal.log(`Snapshot: Deleted - ${snapshotId}`, 'SYSTEM');
    return true;
  }

  // ============================================
  // Template Management
  // ============================================

  /**
   * Create a template from current state
   */
  createTemplate(template: {
    name: string;
    description: string;
    category: string;
    tags?: string[];
    isPublic?: boolean;
  }): AgentTemplate {
    const state = this.engine.getState();
    const currentUser = this.getCurrentUser();
    
    const newTemplate: AgentTemplate = {
      id: `template_${Date.now()}`,
      name: template.name,
      description: template.description,
      author: currentUser || 'Anonymous',
      authorId: this.getCurrentUserId(),
      nodes: { ...state.nodes },
      connections: [...state.connections],
      metadata: {
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: '1.0.0',
        tags: template.tags || [],
        category: template.category,
        isPublic: template.isPublic || false,
        downloadCount: 0,
        rating: 0,
        likeCount: 0
      }
    };

    const path = `${this.TEMPLATES_DIR}/${newTemplate.id}.json`;
    this.vfs.writeFile(path, JSON.stringify(newTemplate, null, 2));

    this.terminal.log(`Template: Created - ${template.name} (${newTemplate.id})`, 'SYSTEM');
    return newTemplate;
  }

  /**
   * Update a template
   */
  updateTemplate(templateId: string, updates: Partial<Omit<AgentTemplate, 'id' | 'nodes' | 'connections'>>): AgentTemplate | null {
    const template = this.getTemplate(templateId);
    
    if (!template) {
      return null;
    }

    const updated: AgentTemplate = {
      ...template,
      ...updates,
      metadata: {
        ...template.metadata,
        ...updates.metadata,
        updatedAt: Date.now()
      }
    };

    const path = `${this.TEMPLATES_DIR}/${templateId}.json`;
    this.vfs.writeFile(path, JSON.stringify(updated, null, 2));

    this.terminal.log(`Template: Updated - ${updated.name} (${templateId})`, 'SYSTEM');
    return updated;
  }

  /**
   * Get a template by ID
   */
  getTemplate(templateId: string): AgentTemplate | null {
    const path = `${this.TEMPLATES_DIR}/${templateId}.json`;
    
    if (!this.vfs.exists(path)) {
      return null;
    }

    try {
      const content = this.vfs.readFile(path);
      return JSON.parse(content) as AgentTemplate;
    } catch {
      return null;
    }
  }

  /**
   * Get all templates
   */
  getAllTemplates(filter?: { category?: string; author?: string; isPublic?: boolean; tags?: string[] }): AgentTemplate[] {
    const templates: AgentTemplate[] = [];
    const files = this.vfs.listFiles(this.TEMPLATES_DIR);

    for (const file of files) {
      if (file.endsWith('.json')) {
        try {
          const content = this.vfs.readFile(`${this.TEMPLATES_DIR}/${file}`);
          const template = JSON.parse(content) as AgentTemplate;
          
          // Apply filters
          if (filter) {
            if (filter.category && template.metadata.category !== filter.category) continue;
            if (filter.author && template.author !== filter.author) continue;
            if (filter.isPublic !== undefined && template.metadata.isPublic !== filter.isPublic) continue;
            if (filter.tags && filter.tags.length > 0 && 
                !filter.tags.some(tag => template.metadata.tags.includes(tag))) continue;
          }
          
          templates.push(template);
        } catch {
          // Skip invalid files
        }
      }
    }

    templates.sort((a, b) => b.metadata.updatedAt - a.metadata.updatedAt);
    return templates;
  }

  /**
   * Delete a template
   */
  deleteTemplate(templateId: string): boolean {
    const path = `${this.TEMPLATES_DIR}/${templateId}.json`;
    
    if (!this.vfs.exists(path)) {
      return false;
    }

    this.vfs.deleteFile(path);
    this.terminal.log(`Template: Deleted - ${templateId}`, 'SYSTEM');
    return true;
  }

  /**
   * Load a template into the engine
   */
  loadTemplate(templateId: string): boolean {
    const template = this.getTemplate(templateId);
    
    if (!template) {
      return false;
    }

    // Clear current state
    this.engine.mutate({
      nodes: {},
      connections: []
    });

    // Load template
    this.engine.mutate({
      nodes: template.nodes,
      connections: template.connections
    });

    this.terminal.log(`Template: Loaded - ${template.name} (${templateId})`, 'SYSTEM');
    return true;
  }

  /**
   * Share a template (mark as public)
   */
  shareTemplate(templateId: string): AgentTemplate | null {
    return this.updateTemplate(templateId, {
      metadata: { isPublic: true }
    });
  }

  /**
   * Unshare a template (mark as private)
   */
  unshareTemplate(templateId: string): AgentTemplate | null {
    return this.updateTemplate(templateId, {
      metadata: { isPublic: false }
    });
  }

  /**
   * Rate a template
   */
  rateTemplate(templateId: string, rating: number): AgentTemplate | null {
    const template = this.getTemplate(templateId);
    
    if (!template) {
      return null;
    }

    // Update rating (simple average)
    const currentRating = template.metadata.rating || 0;
    const newRating = (currentRating + rating) / 2;

    return this.updateTemplate(templateId, {
      metadata: { rating: newRating }
    });
  }

  /**
   * Like a template
   */
  likeTemplate(templateId: string): AgentTemplate | null {
    const template = this.getTemplate(templateId);
    
    if (!template) {
      return null;
    }

    return this.updateTemplate(templateId, {
      metadata: { likeCount: (template.metadata.likeCount || 0) + 1 }
    });
  }

  /**
   * Download a template (increment download count)
   */
  downloadTemplate(templateId: string): AgentTemplate | null {
    const template = this.getTemplate(templateId);
    
    if (!template) {
      return null;
    }

    return this.updateTemplate(templateId, {
      metadata: { downloadCount: (template.metadata.downloadCount || 0) + 1 }
    });
  }

  // ============================================
  // Template Marketplace
  // ============================================

  /**
   * Get featured templates for marketplace
   */
  getFeaturedTemplates(limit: number = 10): AgentTemplate[] {
    const templates = this.getAllTemplates({ isPublic: true });
    
    // Sort by download count and rating
    templates.sort((a, b) => {
      const bScore = (b.metadata.downloadCount || 0) * 0.7 + (b.metadata.rating || 0) * 0.3;
      const aScore = (a.metadata.downloadCount || 0) * 0.7 + (a.metadata.rating || 0) * 0.3;
      return bScore - aScore;
    });

    return templates.slice(0, limit);
  }

  /**
   * Get templates by category
   */
  getTemplatesByCategory(category: string, limit: number = 20): AgentTemplate[] {
    const templates = this.getAllTemplates({ category, isPublic: true });
    
    // Sort by popularity
    templates.sort((a, b) => {
      const bScore = (b.metadata.downloadCount || 0) + (b.metadata.likeCount || 0);
      const aScore = (a.metadata.downloadCount || 0) + (a.metadata.likeCount || 0);
      return bScore - aScore;
    });

    return templates.slice(0, limit);
  }

  /**
   * Search templates
   */
  searchTemplates(query: string, limit: number = 20): AgentTemplate[] {
    const templates = this.getAllTemplates({ isPublic: true });
    const lowerQuery = query.toLowerCase();

    return templates
      .filter(template => 
        template.name.toLowerCase().includes(lowerQuery) ||
        template.description.toLowerCase().includes(lowerQuery) ||
        template.author.toLowerCase().includes(lowerQuery) ||
        template.metadata.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
      )
      .sort((a, b) => b.metadata.downloadCount - a.metadata.downloadCount)
      .slice(0, limit);
  }

  /**
   * Get popular templates
   */
  getPopularTemplates(limit: number = 10): AgentTemplate[] {
    const templates = this.getAllTemplates({ isPublic: true });
    
    templates.sort((a, b) => {
      const bScore = (b.metadata.downloadCount || 0) * 2 + (b.metadata.likeCount || 0);
      const aScore = (a.metadata.downloadCount || 0) * 2 + (a.metadata.likeCount || 0);
      return bScore - aScore;
    });

    return templates.slice(0, limit);
  }

  /**
   * Get recent templates
   */
  getRecentTemplates(limit: number = 10): AgentTemplate[] {
    const templates = this.getAllTemplates({ isPublic: true });
    
    templates.sort((a, b) => b.metadata.createdAt - a.metadata.createdAt);
    return templates.slice(0, limit);
  }

  // ============================================
  // Utility Methods
  // ============================================

  /**
   * Get current user from auth service or localStorage
   */
  private getCurrentUser(): string | undefined {
    // Try to get from localStorage first (for mock auth)
    const user = localStorage.getItem('eden_user');
    if (user) {
      try {
        const parsed = JSON.parse(user);
        return parsed.name || parsed.email || undefined;
      } catch {
        return undefined;
      }
    }
    return undefined;
  }

  /**
   * Get current user ID
   */
  private getCurrentUserId(): string | undefined {
    const user = localStorage.getItem('eden_user');
    if (user) {
      try {
        const parsed = JSON.parse(user);
        return parsed.id || undefined;
      } catch {
        return undefined;
      }
    }
    return undefined;
  }

  /**
   * Export all agents as a single JSON
   */
  exportAllAgents(): string {
    const agents = this.getAllAgents();
    return JSON.stringify(agents, null, 2);
  }

  /**
   * Import multiple agents from JSON
   */
  importMultipleAgents(jsonString: string): { success: number; failed: number } {
    try {
      const agents = JSON.parse(jsonString) as AgentSnapshot[];
      let success = 0;
      let failed = 0;

      for (const agent of agents) {
        try {
          const path = `${this.AGENTS_DIR}/${agent.id}.json`;
          this.vfs.writeFile(path, JSON.stringify(agent, null, 2));
          success++;
        } catch {
          failed++;
        }
      }

      this.terminal.log(`Agent: Imported ${success} agents, ${failed} failed`, 'SYSTEM');
      return { success, failed };
      
    } catch (error) {
      this.terminal.log(`Agent: Import error - ${error}`, 'ERROR');
      return { success: 0, failed: 1 };
    }
  }

  /**
   * Clean up old snapshots (keep only last N)
   */
  cleanupSnapshots(maxToKeep: number = 10): { deleted: number; kept: number } {
    const snapshots = this.getAllSnapshots();
    const toDelete = snapshots.slice(maxToKeep);

    for (const snapshot of toDelete) {
      this.deleteSnapshot(snapshot.id);
    }

    return {
      deleted: toDelete.length,
      kept: Math.min(snapshots.length, maxToKeep)
    };
  }
}
