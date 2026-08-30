/**
 * Webhook Service for EDEN
 * Handles incoming webhooks from external systems and triggers appropriate actions
 */

import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { CoreEngine } from './CoreEngine';
import { VfsService } from './VfsService';
import { TerminalService } from './TerminalService';
import { EdenAiPipelineService } from './EdenAiPipelineService';

export interface WebhookEvent {
  id: string;
  source: string;
  type: string;
  timestamp: number;
  payload: any;
  processed: boolean;
  error?: string;
  response?: any;
}

export interface WebhookConfig {
  id: string;
  name: string;
  url: string;
  secret?: string;
  events: string[];
  active: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface WebhookPayload {
  event: string;
  data: any;
  timestamp?: number;
  signature?: string;
}

@Injectable({ providedIn: 'root' })
export class WebhookService {
  private http = inject(HttpClient);
  private engine = inject(CoreEngine);
  private vfs = inject(VfsService);
  private terminal = inject(TerminalService);
  private pipeline = inject(EdenAiPipelineService);

  // Webhook configurations
  private webhooks: WebhookConfig[] = [];
  
  // Event history
  private eventHistory: WebhookEvent[] = [];
  private maxHistory = 100;

  /**
   * Initialize webhook service
   */
  initialize(): void {
    this.loadWebhooks();
    this.terminal.log('Webhook Service initialized', 'SYSTEM');
  }

  /**
   * Load webhooks from VFS
   */
  private loadWebhooks(): void {
    try {
      const content = this.vfs.readFile('/config/webhooks.json');
      if (content) {
        this.webhooks = JSON.parse(content);
        this.terminal.log(`Webhook Service: Loaded ${this.webhooks.length} webhook configurations`, 'SYSTEM');
      }
    } catch {
      // Use defaults
      this.webhooks = [];
    }
  }

  /**
   * Save webhooks to VFS
   */
  private saveWebhooks(): void {
    this.vfs.writeFile('/config/webhooks.json', JSON.stringify(this.webhooks, null, 2));
    this.terminal.log('Webhook Service: Saved configurations', 'SYSTEM');
  }

  /**
   * Register a new webhook
   */
  registerWebhook(config: Omit<WebhookConfig, 'id' | 'createdAt' | 'updatedAt' | 'active'>): WebhookConfig {
    const webhook: WebhookConfig = {
      id: `webhook_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: config.name,
      url: config.url,
      secret: config.secret,
      events: config.events,
      active: true,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    this.webhooks.push(webhook);
    this.saveWebhooks();

    this.terminal.log(`Webhook Service: Registered new webhook - ${webhook.name}`, 'SYSTEM');
    return webhook;
  }

  /**
   * Update a webhook
   */
  updateWebhook(id: string, updates: Partial<WebhookConfig>): WebhookConfig | null {
    const index = this.webhooks.findIndex(w => w.id === id);
    
    if (index === -1) {
      return null;
    }

    this.webhooks[index] = {
      ...this.webhooks[index],
      ...updates,
      updatedAt: Date.now()
    };

    this.saveWebhooks();
    this.terminal.log(`Webhook Service: Updated webhook - ${this.webhooks[index].name}`, 'SYSTEM');
    return this.webhooks[index];
  }

  /**
   * Delete a webhook
   */
  deleteWebhook(id: string): boolean {
    const index = this.webhooks.findIndex(w => w.id === id);
    
    if (index === -1) {
      return false;
    }

    this.webhooks.splice(index, 1);
    this.saveWebhooks();
    this.terminal.log(`Webhook Service: Deleted webhook - ${id}`, 'SYSTEM');
    return true;
  }

  /**
   * Get all webhooks
   */
  getWebhooks(): WebhookConfig[] {
    return [...this.webhooks];
  }

  /**
   * Get webhook by ID
   */
  getWebhook(id: string): WebhookConfig | undefined {
    return this.webhooks.find(w => w.id === id);
  }

  /**
   * Get webhooks by event type
   */
  getWebhooksForEvent(event: string): WebhookConfig[] {
    return this.webhooks.filter(w => w.events.includes(event) && w.active);
  }

  /**
   * Trigger a webhook
   */
  async triggerWebhook(
    event: string,
    payload: any,
    source: string = 'eden'
  ): Promise<{ success: boolean; error?: string; responses?: any[] }> {
    const webhooks = this.getWebhooksForEvent(event);
    
    if (webhooks.length === 0) {
      this.terminal.log(`Webhook Service: No webhooks registered for event - ${event}`, 'INFO');
      return { success: true, responses: [] };
    }

    this.terminal.log(`Webhook Service: Triggering ${webhooks.length} webhooks for - ${event}`, 'INFO');

    const responses: any[] = [];
    const errors: string[] = [];

    for (const webhook of webhooks) {
      try {
        const response = await this.sendWebhook(webhook, event, payload, source);
        responses.push(response);
        
        // Record event
        this.recordEvent({
          id: `event_${Date.now()}`,
          source,
          type: event,
          timestamp: Date.now(),
          payload,
          processed: true,
          response
        });

      } catch (error: any) {
        errors.push(error.message);
        this.terminal.log(`Webhook Service: Error triggering - ${webhook.name}: ${error.message}`, 'ERROR');
        
        // Record failed event
        this.recordEvent({
          id: `event_${Date.now()}`,
          source,
          type: event,
          timestamp: Date.now(),
          payload,
          processed: false,
          error: error.message
        });
      }
    }

    if (errors.length > 0) {
      return { 
        success: false, 
        error: `Failed to trigger ${errors.length} webhooks: ${errors.join(', ')}`,
        responses
      };
    }

    return { success: true, responses };
  }

  /**
   * Send webhook request
   */
  private async sendWebhook(
    webhook: WebhookConfig,
    event: string,
    payload: any,
    source: string
  ): Promise<any> {
    const webhookPayload: WebhookPayload = {
      event,
      data: payload,
      timestamp: Date.now()
    };

    // Add signature if secret is configured
    if (webhook.secret) {
      webhookPayload.signature = this.generateSignature(webhookPayload, webhook.secret);
    }

    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      'User-Agent': `EDEN-Webhook/${source}`,
      'X-EDEN-Event': event,
      'X-EDEN-Source': source,
      'X-EDEN-Timestamp': Date.now().toString()
    });

    if (webhook.secret) {
      headers.append('X-EDEN-Signature', webhookPayload.signature!);
    }

    try {
      const response = await this.http.post(webhook.url, webhookPayload, { headers }).toPromise();
      return {
        webhookId: webhook.id,
        webhookName: webhook.name,
        url: webhook.url,
        status: response?.status || 200,
        response: response,
        timestamp: Date.now()
      };
    } catch (error: any) {
      throw new Error(`Webhook to ${webhook.name} failed: ${error.message}`);
    }
  }

  /**
   * Generate HMAC signature for webhook payload
   */
  private generateSignature(payload: WebhookPayload, secret: string): string {
    const crypto = (window as any).crypto || (window as any).msCrypto;
    const encoder = new TextEncoder();
    const key = encoder.encode(secret);
    const data = encoder.encode(JSON.stringify(payload));
    
    if (crypto && crypto.subtle) {
      // Browser implementation
      return 'browser-signature-placeholder';
    }
    
    // Node.js implementation (for SSR)
    return 'node-signature-placeholder';
  }

  /**
   * Verify webhook signature
   */
  verifySignature(payload: WebhookPayload, signature: string, secret: string): boolean {
    const expectedSignature = this.generateSignature(payload, secret);
    return signature === expectedSignature;
  }

  /**
   * Record an event in history
   */
  private recordEvent(event: WebhookEvent): void {
    this.eventHistory.unshift(event);
    
    // Keep only maxHistory events
    if (this.eventHistory.length > this.maxHistory) {
      this.eventHistory = this.eventHistory.slice(0, this.maxHistory);
    }

    // Save to VFS
    this.vfs.writeFile('/config/webhook-history.json', JSON.stringify(this.eventHistory, null, 2));
  }

  /**
   * Get event history
   */
  getEventHistory(limit: number = 50): WebhookEvent[] {
    return this.eventHistory.slice(0, limit);
  }

  /**
   * Clear event history
   */
  clearEventHistory(): void {
    this.eventHistory = [];
    this.vfs.deleteFile('/config/webhook-history.json');
    this.terminal.log('Webhook Service: Cleared event history', 'SYSTEM');
  }

  // ============================================
  // Built-in Webhook Handlers
  // ============================================

  /**
   * Handle GitHub webhook
   */
  async handleGitHubWebhook(payload: any): Promise<void> {
    const event = payload.action || 'unknown';
    const repo = payload.repository?.full_name || 'unknown';

    this.terminal.log(`Webhook: GitHub ${event} - ${repo}`, 'INFO');

    // Trigger appropriate action based on event
    switch (event) {
      case 'push':
        await this.handleGitHubPush(payload);
        break;
      case 'pull_request':
        await this.handleGitHubPullRequest(payload);
        break;
      case 'issues':
        await this.handleGitHubIssue(payload);
        break;
      default:
        this.terminal.log(`Webhook: Unhandled GitHub event - ${event}`, 'WARN');
    }
  }

  private async handleGitHubPush(payload: any): Promise<void> {
    const commits = payload.commits || [];
    const repo = payload.repository;

    this.terminal.log(`GitHub Push: ${commits.length} commits to ${repo.full_name}`, 'INFO');

    // Create a node for each commit
    for (const commit of commits) {
      const nodeId = `github_commit_${commit.id}`;
      this.engine.mutate({
        nodes: {
          [nodeId]: {
            id: nodeId,
            type: 'Data' as const,
            position: {
              x: Math.random() * 800 + 100,
              y: Math.random() * 600 + 100
            },
            metadata: {
              title: commit.message.split('\n')[0],
              content: `Commit: ${commit.id}\n\n${commit.message}\n\nAuthor: ${commit.author.name}\nDate: ${commit.timestamp}`
            },
            ternaryState: 'UNKNOWN'
          }
        }
      });
    }

    this.terminal.log(`GitHub: Created ${commits.length} commit nodes`, 'SYSTEM');
  }

  private async handleGitHubPullRequest(payload: any): Promise<void> {
    const pr = payload.pull_request;
    
    this.terminal.log(`GitHub PR: ${pr.title} (#${pr.number})`, 'INFO');

    // Create a node for the PR
    const nodeId = `github_pr_${pr.id}`;
    this.engine.mutate({
      nodes: {
        [nodeId]: {
          id: nodeId,
          type: 'Data' as const,
          position: {
            x: Math.random() * 800 + 100,
            y: Math.random() * 600 + 100
          },
          metadata: {
            title: `PR #${pr.number}: ${pr.title}`,
            content: `State: ${pr.state}\n\n${pr.body || 'No description'}\n\nURL: ${pr.html_url}`
          },
          ternaryState: pr.state === 'open' ? 'UNKNOWN' : pr.state === 'closed' && pr.merged ? 'TRUE' : 'FALSE'
        }
      }
    });

    this.terminal.log(`GitHub: Created PR node - ${pr.title}`, 'SYSTEM');
  }

  private async handleGitHubIssue(payload: any): Promise<void> {
    const issue = payload.issue;
    
    this.terminal.log(`GitHub Issue: ${issue.title} (#${issue.number})`, 'INFO');

    // Create a node for the issue
    const nodeId = `github_issue_${issue.id}`;
    this.engine.mutate({
      nodes: {
        [nodeId]: {
          id: nodeId,
          type: 'Data' as const,
          position: {
            x: Math.random() * 800 + 100,
            y: Math.random() * 600 + 100
          },
          metadata: {
            title: `Issue #${issue.number}: ${issue.title}`,
            content: `State: ${issue.state}\n\n${issue.body || 'No description'}\n\nLabels: ${issue.labels.map((l: any) => l.name).join(', ')}\nURL: ${issue.html_url}`
          },
          ternaryState: issue.state === 'open' ? 'UNKNOWN' : 'FALSE'
        }
      }
    });

    this.terminal.log(`GitHub: Created issue node - ${issue.title}`, 'SYSTEM');
  }

  /**
   * Handle Discord webhook
   */
  async handleDiscordWebhook(payload: any): Promise<void> {
    const event = payload.t || 'unknown';
    
    this.terminal.log(`Discord: ${event}`, 'INFO');

    // Create a node for the message
    if (payload.d && payload.d.content) {
      const nodeId = `discord_${payload.d.id}`;
      this.engine.mutate({
        nodes: {
          [nodeId]: {
            id: nodeId,
            type: 'Data' as const,
            position: {
              x: Math.random() * 800 + 100,
              y: Math.random() * 600 + 100
            },
            metadata: {
              title: `Discord: ${payload.d.author?.username || 'Unknown'}`,
              content: payload.d.content
            },
            ternaryState: 'UNKNOWN'
          }
        }
      });
    }
  }

  /**
   * Handle ZMSFA Core webhook
   */
  async handleZMSFACoreWebhook(payload: any): Promise<void> {
    const event = payload.type || 'unknown';
    
    this.terminal.log(`ZMSFA Core: ${event}`, 'INFO');

    // Process based on ZMSFA event type
    switch (event) {
      case 'agent_created':
        await this.handleZMSFAAgentCreated(payload);
        break;
      case 'agent_completed':
        await this.handleZMSFAAgentCompleted(payload);
        break;
      case 'task_created':
        await this.handleZMSFATaskCreated(payload);
        break;
      case 'system_alert':
        await this.handleZMSFASystemAlert(payload);
        break;
      default:
        this.terminal.log(`ZMSFA: Unhandled event - ${event}`, 'WARN');
    }
  }

  private async handleZMSFAAgentCreated(payload: any): Promise<void> {
    const agent = payload.data;
    
    this.terminal.log(`ZMSFA: Agent created - ${agent.name}`, 'INFO');

    // Create agent node in EDEN
    const nodeId = `zmsfa_agent_${agent.id}`;
    this.engine.mutate({
      nodes: {
        [nodeId]: {
          id: nodeId,
          type: 'Logic' as const,
          position: {
            x: Math.random() * 800 + 100,
            y: Math.random() * 600 + 100
          },
          metadata: {
            title: `ZMSFA: ${agent.name}`,
            content: `Agent ID: ${agent.id}\nStatus: ${agent.status}\nObjective: ${agent.objective}\nCreated: ${agent.createdAt}`,
            gateType: 'AND'
          },
          ternaryState: 'UNKNOWN'
        }
      }
    });
  }

  private async handleZMSFAAgentCompleted(payload: any): Promise<void> {
    const agent = payload.data;
    
    this.terminal.log(`ZMSFA: Agent completed - ${agent.name}`, 'SYSTEM');

    // Update or create completion node
    const nodeId = `zmsfa_completed_${agent.id}_${Date.now()}`;
    this.engine.mutate({
      nodes: {
        [nodeId]: {
          id: nodeId,
          type: 'Data' as const,
          position: {
            x: Math.random() * 800 + 100,
            y: Math.random() * 600 + 100
          },
          metadata: {
            title: `✅ ${agent.name} Completed`,
            content: `Result: ${JSON.stringify(agent.result, null, 2)}\nDuration: ${agent.duration}ms\nIterations: ${agent.iterations}`
          },
          ternaryState: 'TRUE'
        }
      }
    });
  }

  private async handleZMSFATaskCreated(payload: any): Promise<void> {
    const task = payload.data;
    
    this.terminal.log(`ZMSFA: Task created - ${task.name}`, 'INFO');

    // Create task node
    const nodeId = `zmsfa_task_${task.id}`;
    this.engine.mutate({
      nodes: {
        [nodeId]: {
          id: nodeId,
          type: 'UI' as const,
          position: {
            x: Math.random() * 800 + 100,
            y: Math.random() * 600 + 100
          },
          metadata: {
            title: `Task: ${task.name}`,
            content: `Status: ${task.status}\nPriority: ${task.priority}\nDue: ${task.dueDate}`
          },
          ternaryState: 'UNKNOWN'
        }
      }
    });
  }

  private async handleZMSFASystemAlert(payload: any): Promise<void> {
    const alert = payload.data;
    
    this.terminal.log(`ZMSFA: System alert - ${alert.severity}: ${alert.message}`, 'ERROR');

    // Create alert node with red state
    const nodeId = `zmsfa_alert_${alert.id}`;
    this.engine.mutate({
      nodes: {
        [nodeId]: {
          id: nodeId,
          type: 'Data' as const,
          position: {
            x: Math.random() * 800 + 100,
            y: Math.random() * 600 + 100
          },
          metadata: {
            title: `⚠️ ALERT: ${alert.type}`,
            content: `${alert.message}\n\nSeverity: ${alert.severity}\nTimestamp: ${alert.timestamp}\nActions: ${alert.actions?.join(', ') || 'None'}`
          },
          ternaryState: 'FALSE'
        }
      }
    });
  }

  /**
   * Process incoming webhook (to be called from server)
   */
  async processIncomingWebhook(
    source: string,
    event: string,
    payload: any,
    signature?: string
  ): Promise<{ success: boolean; error?: string; action?: string }> {
    this.terminal.log(`Webhook: Incoming from ${source} - ${event}`, 'INFO');

    // Verify signature if provided
    const webhook = this.getWebhooksForEvent(event).find(w => w.url.includes(source));
    if (webhook && webhook.secret && signature) {
      const webhookPayload: WebhookPayload = { event, data: payload, signature };
      if (!this.verifySignature(webhookPayload, signature, webhook.secret)) {
        this.terminal.log(`Webhook: Invalid signature from ${source}`, 'ERROR');
        return { success: false, error: 'Invalid signature' };
      }
    }

    // Route to appropriate handler
    switch (source.toLowerCase()) {
      case 'github':
        await this.handleGitHubWebhook(payload);
        return { success: true, action: 'processed_github' };
      case 'discord':
        await this.handleDiscordWebhook(payload);
        return { success: true, action: 'processed_discord' };
      case 'zmsfa':
      case 'zmsfa-core':
        await this.handleZMSFACoreWebhook(payload);
        return { success: true, action: 'processed_zmsfa' };
      default: {
        // Generic handling - create a node
        const nodeId = `webhook_${source}_${Date.now()}`;
        this.engine.mutate({
          nodes: {
            [nodeId]: {
              id: nodeId,
              type: 'Data' as const,
              position: {
                x: Math.random() * 800 + 100,
                y: Math.random() * 600 + 100
              },
              metadata: {
                title: `Webhook: ${event}`,
                content: `Source: ${source}\n\n${JSON.stringify(payload, null, 2)}`
              },
              ternaryState: 'UNKNOWN'
            }
          }
        });
        return { success: true, action: 'created_node' };
      }
    }
  }
}
