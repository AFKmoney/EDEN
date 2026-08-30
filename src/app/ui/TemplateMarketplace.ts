import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../core/AuthService';
import { TerminalService } from '../core/TerminalService';
import { AgentPersistenceService } from '../core/AgentPersistenceService';

export type Category = 'all' | 'automation' | 'data-processing' | 'ai-assistants' | 'web-scraping' | 'chatbots' | 'analysis' | 'creative' | 'productivity';

export interface MarketplaceFilter {
  category: Category;
  sort: 'popular' | 'recent' | 'rating' | 'downloads';
  search: string;
  minRating: number;
}

@Component({
  selector: 'app-template-marketplace',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-6">
      <!-- Header -->
      <div class="max-w-7xl mx-auto mb-8">
        <div class="flex items-center justify-between">
          <div>
            <h1 class="text-3xl font-bold text-white mb-2">Template Marketplace</h1>
            <p class="text-slate-400">Discover and share AI agent templates</p>
          </div>
          @if (auth.isAuth()) {
            <a
              [routerLink]="['/']"
              class="px-4 py-2 bg-purple-500/20 border border-purple-500/50 rounded-lg text-purple-400 hover:bg-purple-500/30 transition-colors flex items-center gap-2"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/>
              </svg>
              Create Template
            </a>
          }
        </div>
      </div>

      <div class="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-4 gap-6">
        <!-- Sidebar Filters -->
        <div class="lg:col-span-1">
          <div class="bg-slate-800/50 backdrop-blur-xl rounded-2xl p-6 border border-slate-700/50 shadow-xl sticky top-6">
            <h3 class="text-lg font-bold text-white mb-4">Filters</h3>

            <!-- Search -->
            <div class="mb-6">
              <label class="text-sm font-medium text-slate-300 mb-2 block" for="marketplace-search">Search</label>
              <div class="relative">
                <svg class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                </svg>
                <input
                  id="marketplace-search"
                  type="text"
                  [(ngModel)]="filters().search"
                  placeholder="Search templates..."
                  class="w-full pl-12 pr-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>
            </div>

            <!-- Categories -->
            <div class="mb-6">
              <label class="text-sm font-medium text-slate-300 mb-2 block" for="marketplace-categories">Categories</label>
              <div class="space-y-2" id="marketplace-categories">
                @for (category of categories; track category.value) {
                  <button
                    (click)="setCategory(category.value)"
                    [class.bg-cyan-500/20]="filters().category === category.value"
                    [class.border-cyan-500]="filters().category === category.value"
                    [class.text-cyan-400]="filters().category === category.value"
                    class="w-full text-left px-4 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-slate-300 hover:bg-slate-600/50 transition-colors flex items-center gap-2"
                  >
                    <span class="text-lg">{{ category.icon }}</span>
                    <span>{{ category.label }}</span>
                    <span class="ml-auto text-xs bg-slate-600/50 px-2 py-1 rounded">{{ getCategoryCount(category.value) }}</span>
                  </button>
                }
              </div>
            </div>

            <!-- Sort -->
            <div class="mb-6">
              <label class="text-sm font-medium text-slate-300 mb-2 block" for="marketplace-sort">Sort By</label>
              <div class="space-y-2" id="marketplace-sort">
                @for (sort of sortOptions; track sort.value) {
                  <button
                    (click)="setSort(sort.value)"
                    [class.bg-purple-500/20]="filters().sort === sort.value"
                    [class.border-purple-500]="filters().sort === sort.value"
                    [class.text-purple-400]="filters().sort === sort.value"
                    class="w-full text-left px-4 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-slate-300 hover:bg-slate-600/50 transition-colors"
                  >
                    {{ sort.label }}
                  </button>
                }
              </div>
            </div>

            <!-- Minimum Rating -->
            <div class="mb-6">
              <label class="text-sm font-medium text-slate-300 mb-2 block" for="marketplace-rating">Minimum Rating</label>
              <div class="space-y-2" id="marketplace-rating">
                @for (rating of [0, 1, 2, 3, 4, 5]; track rating) {
                  <button
                    (click)="setMinRating(rating)"
                    [class.bg-emerald-500/20]="filters().minRating === rating"
                    [class.border-emerald-500]="filters().minRating === rating"
                    [class.text-emerald-400]="filters().minRating === rating"
                    class="w-full text-left px-4 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-slate-300 hover:bg-slate-600/50 transition-colors flex items-center gap-2"
                  >
                    @for (i of [1,2,3,4,5]; track i) {
                      <svg
                        [class.text-emerald-400]="i <= rating"
                        [class.text-slate-500]="i > rating"
                        class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"
                      >
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
                      </svg>
                    }
                    @if (rating === 0) {
                      <span class="ml-2">Any</span>
                    } @else {
                      <span class="ml-2">& Up</span>
                    }
                  </button>
                }
              </div>
            </div>

            <!-- Featured Templates -->
            <div class="border-t border-slate-600/50 pt-6">
              <h3 class="text-lg font-bold text-white mb-4">Featured</h3>
              <div class="space-y-3">
                @for (template of featuredTemplates(); track template.id) {
                  <a
                    [routerLink]="['/marketplace', template.id]"
                    class="block p-3 bg-slate-700/50 rounded-lg border border-slate-600/50 hover:bg-slate-600/50 transition-colors"
                  >
                    <div class="flex items-center gap-3">
                      <div class="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center">
                        <span class="text-white font-bold text-sm">{{ template.name.charAt(0).toUpperCase() }}</span>
                      </div>
                      <div class="flex-1 min-w-0">
                        <h4 class="text-white font-medium truncate">{{ template.name }}</h4>
                        <p class="text-slate-400 text-xs">{{ template.author }}</p>
                      </div>
                      <span class="text-xs bg-slate-600/50 px-2 py-1 rounded">{{ template.metadata.downloadCount }}k</span>
                    </div>
                  </a>
                }
              </div>
            </div>
          </div>
        </div>

        <!-- Main Content -->
        <div class="lg:col-span-3">
          <!-- Header -->
          <div class="flex items-center justify-between mb-6">
            <div>
              <h2 class="text-2xl font-bold text-white">
                @if (filters().category !== 'all') {
                  {{ getCategoryLabel(filters().category) }}
                } @else {
                  All Templates
                }
              </h2>
              <p class="text-slate-400 mt-1">{{ filteredTemplates().length }} templates found</p>
            </div>
            <div class="flex gap-2">
              <button class="px-4 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white hover:bg-slate-600/50 transition-colors flex items-center gap-2">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
                </svg>
                Import
              </button>
              @if (auth.isAuth()) {
                <button
                  [routerLink]="['/']"
                  class="px-4 py-2 bg-purple-500/20 border border-purple-500/50 rounded-lg text-purple-400 hover:bg-purple-500/30 transition-colors flex items-center gap-2"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/>
                  </svg>
                  Create Template
                </button>
              }
            </div>
          </div>

          <!-- Templates Grid -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            @for (template of filteredTemplates(); track template.id) {
              <div class="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700/50 shadow-lg hover:shadow-xl hover:shadow-purple-500/5 transition-all group">
                <div class="flex items-start justify-between mb-4">
                  <div class="flex items-center gap-3">
                    <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center shadow-lg">
                      <span class="text-white font-bold text-xl">{{ template.name.charAt(0).toUpperCase() }}</span>
                    </div>
                    <div>
                      <h3 class="text-white font-bold group-hover:text-cyan-400 transition-colors">{{ template.name }}</h3>
                      <p class="text-slate-400 text-sm">{{ template.author }}</p>
                    </div>
                  </div>
                  @if (auth.getUser()?.id === template.authorId) {
                    <span class="px-2 py-1 bg-purple-500/20 text-purple-400 rounded-full text-xs font-medium">
                      Yours
                    </span>
                  }
                </div>

                <p class="text-slate-400 mb-4 line-clamp-3">{{ template.description }}</p>

                <div class="flex flex-wrap gap-2 mb-4">
                  <span class="px-3 py-1 bg-slate-700/50 text-slate-300 rounded-full text-xs">
                    {{ template.metadata.category }}
                  </span>
                  @for (tag of template.metadata.tags; track tag) {
                    <span class="px-2 py-1 bg-slate-600/50 text-slate-400 rounded text-xs">{{ tag }}</span>
                  }
                </div>

                <div class="flex items-center justify-between border-t border-slate-600/50 pt-4">
                  <div class="flex gap-4 text-sm text-slate-400">
                    <div class="flex items-center gap-1">
                      <svg class="w-4 h-4 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
                      </svg>
                      <span>{{ template.metadata.rating.toFixed(1) }}</span>
                    </div>
                    <div class="flex items-center gap-1">
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"/>
                      </svg>
                      <span>{{ template.metadata.downloadCount }}k</span>
                    </div>
                    <div class="flex items-center gap-1">
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.085a2 2 0 00-1.736.97l-1.9 3.8z"/>
                      </svg>
                      <span>{{ template.metadata.likeCount }}</span>
                    </div>
                  </div>

                  <div class="flex gap-2">
                    <button
                      (click)="loadTemplate(template)"
                      class="px-4 py-2 bg-cyan-500/20 border border-cyan-500/50 rounded-lg text-cyan-400 hover:bg-cyan-500/30 transition-colors flex items-center gap-2"
                    >
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
                      </svg>
                      Load
                    </button>
                    @if (auth.isAuth() && auth.getUser()?.id !== template.authorId) {
                      <button
                        (click)="likeTemplate(template)"
                        [class.bg-emerald-500/30]="isLiked(template.id)"
                        [class.border-emerald-500]="isLiked(template.id)"
                        [class.text-emerald-400]="isLiked(template.id)"
                        class="px-4 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-slate-300 hover:bg-slate-600/50 transition-colors flex items-center gap-2"
                      >
                        <svg
                          [class.text-emerald-400]="isLiked(template.id)"
                          class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"
                        >
                          <path d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z"/>
                        </svg>
                        <span>{{ isLiked(template.id) ? 'Liked' : 'Like' }}</span>
                      </button>
                    }
                  </div>
                </div>
              </div>
            }
            @empty {
              <div class="text-center py-16 text-slate-500">
                <svg class="w-24 h-24 mx-auto mb-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                </svg>
                <h3 class="text-xl font-bold text-white mb-2">No templates found</h3>
                <p>Try adjusting your filters or create a new template</p>
              </div>
            }
          </div>

          <!-- Pagination -->
          @if (filteredTemplates().length >= 12) {
            <div class="flex justify-center mt-8">
              <div class="flex gap-2">
                <button class="px-4 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white hover:bg-slate-600/50 transition-colors">
                  Previous
                </button>
                <button class="px-4 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white hover:bg-slate-600/50 transition-colors">
                  1
                </button>
                <button class="px-4 py-2 bg-cyan-500/20 border border-cyan-500 rounded-lg text-cyan-400">
                  2
                </button>
                <button class="px-4 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white hover:bg-slate-600/50 transition-colors">
                  3
                </button>
                <button class="px-4 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white hover:bg-slate-600/50 transition-colors">
                  Next
                </button>
              </div>
            </div>
          }
        </div>
      </div>
    </div>
  `,
  styles: [`
    .line-clamp-3 {
      display: -webkit-box;
      -webkit-line-clamp: 3;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
  `],
  animations: []
})
export class TemplateMarketplace {
  auth = inject(AuthService);
  router = inject(Router);
  terminal = inject(TerminalService);
  persistence = inject(AgentPersistenceService);

  // Filters
  filters = signal<MarketplaceFilter>({
    category: 'all',
    sort: 'popular',
    search: '',
    minRating: 0
  });

  // All templates
  allTemplates = this.persistence.getAllTemplates({ isPublic: true });

  // Categories
  categories: { value: Category; label: string; icon: string }[] = [
    { value: 'all', label: 'All Categories', icon: '🌐' },
    { value: 'automation', label: 'Automation', icon: '⚡' },
    { value: 'data-processing', label: 'Data Processing', icon: '📊' },
    { value: 'ai-assistants', label: 'AI Assistants', icon: '🤖' },
    { value: 'web-scraping', label: 'Web Scraping', icon: '🕸️' },
    { value: 'chatbots', label: 'Chatbots', icon: '💬' },
    { value: 'analysis', label: 'Analysis', icon: '📈' },
    { value: 'creative', label: 'Creative', icon: '✨' },
    { value: 'productivity', label: 'Productivity', icon: '🚀' }
  ];

  sortOptions = [
    { value: 'popular' as const, label: 'Most Popular' },
    { value: 'recent' as const, label: 'Most Recent' },
    { value: 'rating' as const, label: 'Top Rated' },
    { value: 'downloads' as const, label: 'Most Downloaded' }
  ];

  // Track liked templates
  likedTemplates = new Set<string>();

  constructor() {
    // Load liked templates from localStorage
    const liked = localStorage.getItem('eden_liked_templates');
    if (liked) {
      this.likedTemplates = new Set(JSON.parse(liked));
    }
  }

  setCategory(category: Category): void {
    this.filters.update(f => ({ ...f, category }));
  }

  setSort(sort: 'popular' | 'recent' | 'rating' | 'downloads'): void {
    this.filters.update(f => ({ ...f, sort }));
  }

  setMinRating(rating: number): void {
    this.filters.update(f => ({ ...f, minRating: rating }));
  }

  getCategoryLabel(category: Category): string {
    const found = this.categories.find(c => c.value === category);
    return found ? found.label : category;
  }

  getCategoryCount(category: Category): number {
    if (category === 'all') return this.allTemplates.length;
    return this.allTemplates.filter(t => t.metadata.category === category).length;
  }

  filteredTemplates() {
    let templates = [...this.allTemplates];
    const { category, search, minRating } = this.filters();

    // Filter by category
    if (category !== 'all') {
      templates = templates.filter(t => t.metadata.category === category);
    }

    // Filter by search
    if (search) {
      const lowerSearch = search.toLowerCase();
      templates = templates.filter(t =>
        t.name.toLowerCase().includes(lowerSearch) ||
        t.description.toLowerCase().includes(lowerSearch) ||
        t.author.toLowerCase().includes(lowerSearch) ||
        t.metadata.tags.some(tag => tag.toLowerCase().includes(lowerSearch))
      );
    }

    // Filter by rating
    templates = templates.filter(t => t.metadata.rating >= minRating);

    // Sort
    const { sort } = this.filters();
    switch (sort) {
      case 'recent':
        templates.sort((a, b) => b.metadata.createdAt - a.metadata.createdAt);
        break;
      case 'rating':
        templates.sort((a, b) => b.metadata.rating - a.metadata.rating);
        break;
      case 'downloads':
        templates.sort((a, b) => b.metadata.downloadCount - a.metadata.downloadCount);
        break;
      default: // popular
        templates.sort((a, b) => {
          const bScore = b.metadata.downloadCount * 2 + b.metadata.likeCount + b.metadata.rating * 10;
          const aScore = a.metadata.downloadCount * 2 + a.metadata.likeCount + a.metadata.rating * 10;
          return bScore - aScore;
        });
    }

    return templates;
  }

  featuredTemplates() {
    return this.persistence.getFeaturedTemplates(5);
  }

  loadTemplate(template: any): void {
    this.persistence.loadTemplate(template.id);
    this.persistence.downloadTemplate(template.id);
    this.terminal.log(`Marketplace: Loaded template - ${template.name}`, 'SYSTEM');
    this.router.navigate(['/']);
  }

  likeTemplate(template: any): void {
    const templateId = template.id;
    
    if (this.isLiked(templateId)) {
      // Unlike
      this.likedTemplates.delete(templateId);
      this.persistence.updateTemplate(templateId, {
        metadata: { likeCount: (template.metadata.likeCount || 0) - 1 }
      });
    } else {
      // Like
      this.likedTemplates.add(templateId);
      this.persistence.updateTemplate(templateId, {
        metadata: { likeCount: (template.metadata.likeCount || 0) + 1 }
      });
    }

    // Save to localStorage
    localStorage.setItem('eden_liked_templates', JSON.stringify([...this.likedTemplates]));
    
    // Refresh templates
    this.allTemplates = this.persistence.getAllTemplates({ isPublic: true });
    
    this.terminal.log(`Marketplace: ${this.isLiked(templateId) ? 'Liked' : 'Unliked'} template - ${template.name}`, 'SYSTEM');
  }

  isLiked(templateId: string): boolean {
    return this.likedTemplates.has(templateId);
  }
}
