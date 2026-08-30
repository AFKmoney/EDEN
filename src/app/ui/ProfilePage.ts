import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService, User } from '../core/AuthService';
import { TerminalService } from '../core/TerminalService';
import { AgentPersistenceService } from '../core/AgentPersistenceService';

export interface UserStats {
  agentsCreated: number;
  templatesShared: number;
  templatesDownloaded: number;
  totalNodesCreated: number;
  joinDate: number;
}

@Component({
  selector: 'app-profile-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-6">
      <!-- Header -->
      <div class="max-w-6xl mx-auto mb-8">
        <div class="flex items-center justify-between">
          <div>
            <h1 class="text-3xl font-bold text-white mb-2">Profile</h1>
            <p class="text-slate-400">Manage your account and view your activity</p>
          </div>
          <a
            [routerLink]="['/']"
            class="px-4 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white hover:bg-slate-600/50 transition-colors flex items-center gap-2"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
            </svg>
            Back to EDEN
          </a>
        </div>
      </div>

      <div class="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- Profile Card -->
        <div class="lg:col-span-1">
          <div class="bg-slate-800/50 backdrop-blur-xl rounded-2xl p-6 border border-slate-700/50 shadow-xl">
            <!-- Avatar -->
            <div class="text-center mb-6">
              <div class="w-24 h-24 rounded-full bg-gradient-to-br from-cyan-500 to-purple-600 mx-auto mb-4 flex items-center justify-center">
                <span class="text-4xl font-bold text-white">
                  {{ user()?.name?.charAt(0).toUpperCase() || 'U' }}
                </span>
              </div>
              <h2 class="text-xl font-bold text-white">{{ user()?.name || 'Anonymous' }}</h2>
              <p class="text-slate-400">{{ user()?.email || 'No email' }}</p>
              <div class="flex gap-2 justify-center mt-2">
                <span class="px-3 py-1 bg-cyan-500/20 text-cyan-400 rounded-full text-xs font-medium">
                  {{ user()?.role || 'user' }}
                </span>
              </div>
            </div>

            <!-- Quick Stats -->
            <div class="grid grid-cols-2 gap-4 mb-6">
              <div class="bg-slate-700/50 rounded-xl p-4 text-center">
                <div class="text-2xl font-bold text-cyan-400">{{ stats().agentsCreated }}</div>
                <div class="text-sm text-slate-400">Agents Created</div>
              </div>
              <div class="bg-slate-700/50 rounded-xl p-4 text-center">
                <div class="text-2xl font-bold text-purple-400">{{ stats().templatesShared }}</div>
                <div class="text-sm text-slate-400">Templates Shared</div>
              </div>
              <div class="bg-slate-700/50 rounded-xl p-4 text-center">
                <div class="text-2xl font-bold text-emerald-400">{{ stats().templatesDownloaded }}</div>
                <div class="text-sm text-slate-400">Downloaded</div>
              </div>
              <div class="bg-slate-700/50 rounded-xl p-4 text-center">
                <div class="text-2xl font-bold text-white">{{ stats().totalNodesCreated }}</div>
                <div class="text-sm text-slate-400">Nodes Created</div>
              </div>
            </div>

            <!-- Actions -->
            <div class="space-y-3">
              <button
                (click)="logout()"
                class="w-full py-3 bg-gradient-to-r from-red-500 to-orange-500 text-white font-bold rounded-xl hover:from-red-600 hover:to-orange-600 transition-all flex items-center justify-center gap-2"
              >
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
                </svg>
                Sign Out
              </button>
              <button
                class="w-full py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white font-medium hover:bg-slate-600/50 transition-colors flex items-center justify-center gap-2"
              >
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                </svg>
                Delete Account
              </button>
            </div>
          </div>
        </div>

        <!-- My Agents -->
        <div class="lg:col-span-2">
          <div class="bg-slate-800/50 backdrop-blur-xl rounded-2xl p-6 border border-slate-700/50 shadow-xl">
            <div class="flex items-center justify-between mb-6">
              <div>
                <h2 class="text-xl font-bold text-white">My Agents</h2>
                <p class="text-slate-400 text-sm">Your saved agents and workflows</p>
              </div>
              <button
                [routerLink]="['/']"
                class="px-4 py-2 bg-cyan-500/20 border border-cyan-500/50 rounded-lg text-cyan-400 hover:bg-cyan-500/30 transition-colors flex items-center gap-2"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/>
                </svg>
                Create New
              </button>
            </div>

            <!-- Search & Filter -->
            <div class="mb-6 flex gap-4">
              <div class="relative flex-1">
                <svg class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                </svg>
                <input
                  type="text"
                  [(ngModel)]="agentSearch"
                  placeholder="Search agents..."
                  class="w-full pl-12 pr-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>
              <select
                [(ngModel)]="agentSort"
                class="px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
              >
                <option value="recent">Most Recent</option>
                <option value="name">Name (A-Z)</option>
                <option value="updated">Last Updated</option>
              </select>
            </div>

            <!-- Agents Grid -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              @for (agent of filteredAgents(); track agent.id) {
                <div class="bg-slate-700/50 rounded-xl p-4 border border-slate-600/50 hover:bg-slate-600/50 transition-colors">
                  <div class="flex items-start justify-between mb-3">
                    <div>
                      <h3 class="text-white font-bold">{{ agent.name }}</h3>
                      <p class="text-slate-400 text-xs mt-1">{{ formatDate(agent.metadata.updatedAt) }}</p>
                    </div>
                    <div class="flex gap-2">
                      <button
                        (click)="loadAgent(agent.id)"
                        class="p-2 text-cyan-400 hover:bg-cyan-500/20 rounded-lg transition-colors"
                        title="Load Agent"
                      >
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
                        </svg>
                      </button>
                      <button
                        (click)="deleteAgent(agent.id)"
                        class="p-2 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                        </svg>
                      </button>
                    </div>
                  </div>
                  @if (agent.description) {
                    <p class="text-slate-400 text-sm mb-3 line-clamp-2">{{ agent.description }}</p>
                  }
                  <div class="flex flex-wrap gap-2">
                    @for (tag of agent.metadata.tags; track tag) {
                      <span class="px-2 py-1 bg-slate-600/50 text-slate-300 rounded text-xs">{{ tag }}</span>
                    }
                  </div>
                  <div class="mt-3 flex items-center justify-between text-xs text-slate-500">
                    <span>{{ Object.keys(agent.nodes).length }} nodes</span>
                    <span>{{ agent.connections.length }} connections</span>
                  </div>
                </div>
              }
              @empty {
                <div class="text-center py-12 text-slate-500">
                  <svg class="w-16 h-16 mx-auto mb-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
                  </svg>
                  <p>No agents found. Create your first agent!</p>
                </div>
              }
            </div>
          </div>
        </div>

        <!-- My Templates -->
        <div class="lg:col-span-3">
          <div class="bg-slate-800/50 backdrop-blur-xl rounded-2xl p-6 border border-slate-700/50 shadow-xl">
            <div class="flex items-center justify-between mb-6">
              <div>
                <h2 class="text-xl font-bold text-white">My Templates</h2>
                <p class="text-slate-400 text-sm">Templates you've created and shared</p>
              </div>
              <button
                [routerLink]="['/']"
                class="px-4 py-2 bg-purple-500/20 border border-purple-500/50 rounded-lg text-purple-400 hover:bg-purple-500/30 transition-colors flex items-center gap-2"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/>
                </svg>
                Create Template
              </button>
            </div>

            <!-- Templates Grid -->
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              @for (template of myTemplates(); track template.id) {
                <div class="bg-slate-700/50 rounded-xl p-4 border border-slate-600/50 hover:bg-slate-600/50 transition-colors">
                  <div class="flex items-start justify-between mb-3">
                    <div>
                      <h3 class="text-white font-bold">{{ template.name }}</h3>
                      <p class="text-slate-400 text-xs mt-1">{{ formatDate(template.metadata.updatedAt) }}</p>
                    </div>
                    @if (template.metadata.isPublic) {
                      <span class="px-2 py-1 bg-emerald-500/20 text-emerald-400 rounded-full text-xs font-medium">
                        Public
                      </span>
                    } @else {
                      <span class="px-2 py-1 bg-slate-600/50 text-slate-400 rounded-full text-xs font-medium">
                        Private
                      </span>
                    }
                  </div>
                  <p class="text-slate-400 text-sm mb-3 line-clamp-2">{{ template.description }}</p>
                  <div class="flex flex-wrap gap-2 mb-3">
                    @for (tag of template.metadata.tags; track tag) {
                      <span class="px-2 py-1 bg-slate-600/50 text-slate-300 rounded text-xs">{{ tag }}</span>
                    }
                  </div>
                  <div class="flex items-center justify-between">
                    <div class="flex gap-3 text-xs text-slate-500">
                      <span class="flex items-center gap-1">
                        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"/>
                        </svg>
                        {{ template.metadata.downloadCount }}
                      </span>
                      <span class="flex items-center gap-1">
                        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.085a2 2 0 00-1.736.97l-1.9 3.8z"/>
                        </svg>
                        {{ template.metadata.likeCount }}
                      </span>
                      <span class="flex items-center gap-1">
                        <svg class="w-3 h-3 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
                        </svg>
                        {{ template.metadata.rating.toFixed(1) }}
                      </span>
                    </div>
                    <div class="flex gap-2">
                      <button
                        (click)="loadTemplate(template.id)"
                        class="p-2 text-purple-400 hover:bg-purple-500/20 rounded-lg transition-colors"
                        title="Load Template"
                      >
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
                        </svg>
                      </button>
                      @if (!template.metadata.isPublic) {
                        <button
                          (click)="shareTemplate(template.id)"
                          class="p-2 text-emerald-400 hover:bg-emerald-500/20 rounded-lg transition-colors"
                          title="Share Template"
                        >
                          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.368a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z"/>
                          </svg>
                        </button>
                      }
                      <button
                        (click)="deleteTemplate(template.id)"
                        class="p-2 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              }
              @empty {
                <div class="text-center py-12 text-slate-500">
                  <svg class="w-16 h-16 mx-auto mb-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                  </svg>
                  <p>No templates found. Create your first template!</p>
                </div>
              }
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .line-clamp-2 {
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
  `],
  animations: []
})
export class ProfilePage implements OnInit {
  auth = inject(AuthService);
  router = inject(Router);
  terminal = inject(TerminalService);
  persistence = inject(AgentPersistenceService);

  user = this.auth.state.asReadonly();

  // Agents
  allAgents = this.persistence.getAllAgents();
  agentSearch = '';
  agentSort = 'recent';

  // Templates
  allTemplates = this.persistence.getAllTemplates();

  stats = signal<UserStats>({
    agentsCreated: 0,
    templatesShared: 0,
    templatesDownloaded: 0,
    totalNodesCreated: 0,
    joinDate: Date.now()
  });

  constructor() {
    // Redirect if not authenticated
    if (!this.auth.isAuth()) {
      this.router.navigate(['/login']);
    }
  }

  ngOnInit(): void {
    this.calculateStats();
  }

  private calculateStats(): void {
    const userId = this.auth.getUser()?.id || '';
    
    this.stats.set({
      agentsCreated: this.allAgents.filter(a => a.metadata.author === userId).length,
      templatesShared: this.allTemplates.filter(t => t.authorId === userId && t.metadata.isPublic).length,
      templatesDownloaded: 0, // Would need tracking
      totalNodesCreated: this.allAgents
        .filter(a => a.metadata.author === userId)
        .reduce((sum, a) => sum + Object.keys(a.nodes).length, 0),
      joinDate: this.auth.getUser()?.createdAt || Date.now()
    });
  }

  filteredAgents() {
    let agents = [...this.allAgents];
    const userId = this.auth.getUser()?.id || '';
    
    // Filter by current user
    agents = agents.filter(a => a.metadata.author === userId);

    // Search
    if (this.agentSearch) {
      const search = this.agentSearch.toLowerCase();
      agents = agents.filter(a => 
        a.name.toLowerCase().includes(search) ||
        a.description?.toLowerCase().includes(search) ||
        a.metadata.tags.some(tag => tag.toLowerCase().includes(search))
      );
    }

    // Sort
    switch (this.agentSort) {
      case 'name':
        agents.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'updated':
        agents.sort((a, b) => b.metadata.updatedAt - a.metadata.updatedAt);
        break;
      default: // recent
        agents.sort((a, b) => b.metadata.createdAt - a.metadata.createdAt);
    }

    return agents;
  }

  myTemplates() {
    const userId = this.auth.getUser()?.id || '';
    return this.allTemplates.filter(t => t.authorId === userId);
  }

  formatDate(timestamp: number): string {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  }

  loadAgent(agentId: string): void {
    this.persistence.restoreAgent(agentId);
    this.terminal.log(`Profile: Loaded agent - ${agentId}`, 'SYSTEM');
    this.router.navigate(['/']);
  }

  deleteAgent(agentId: string): void {
    if (confirm('Are you sure you want to delete this agent?')) {
      this.persistence.deleteAgent(agentId);
      this.allAgents = this.persistence.getAllAgents();
      this.calculateStats();
      this.terminal.log(`Profile: Deleted agent - ${agentId}`, 'SYSTEM');
    }
  }

  loadTemplate(templateId: string): void {
    this.persistence.loadTemplate(templateId);
    this.terminal.log(`Profile: Loaded template - ${templateId}`, 'SYSTEM');
    this.router.navigate(['/']);
  }

  shareTemplate(templateId: string): void {
    this.persistence.shareTemplate(templateId);
    this.allTemplates = this.persistence.getAllTemplates();
    this.calculateStats();
    this.terminal.log(`Profile: Shared template - ${templateId}`, 'SYSTEM');
  }

  deleteTemplate(templateId: string): void {
    if (confirm('Are you sure you want to delete this template?')) {
      this.persistence.deleteTemplate(templateId);
      this.allTemplates = this.persistence.getAllTemplates();
      this.calculateStats();
      this.terminal.log(`Profile: Deleted template - ${templateId}`, 'SYSTEM');
    }
  }

  logout(): void {
    this.auth.logout();
  }
}
