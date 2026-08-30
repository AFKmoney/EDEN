/**
 * Webhook Model
 * MongoDB schema for webhook configurations
 */

import mongoose, { Document, Schema, Model, Types } from 'mongoose';

// Webhook event types
export type WebhookEventType = 
  | 'agent_created'
  | 'agent_updated'
  | 'agent_deleted'
  | 'agent_executed'
  | 'template_created'
  | 'template_updated'
  | 'template_deleted'
  | 'user_registered'
  | 'user_logged_in'
  | 'github_push'
  | 'github_pull_request'
  | 'github_issue'
  | 'discord_message'
  | 'zmsfa_agent_created'
  | 'zmsfa_agent_completed'
  | 'zmsfa_task_created'
  | 'zmsfa_system_alert'
  | 'custom';

// Webhook source types
export type WebhookSource = 
  | 'github'
  | 'discord'
  | 'zmsfa'
  | 'slack'
  | 'twitter'
  | 'custom'
  | 'internal';

// Webhook interface
export interface IWebhook extends Document {
  name: string;
  description?: string;
  author: Types.ObjectId;
  url: string;
  secret?: string;
  events: WebhookEventType[];
  source: WebhookSource;
  isActive: boolean;
  isVerified: boolean;
  verificationToken?: string;
  lastTriggered?: Date;
  triggerCount: number;
  successCount: number;
  failureCount: number;
  lastSuccess?: Date;
  lastFailure?: Date;
  lastFailureReason?: string;
  headers?: Record<string, string>;
  method: 'POST' | 'PUT' | 'GET' | 'DELETE';
  payloadTemplate?: Record<string, any>;
  rateLimit: {
    maxRequests: number;
    windowMs: number;
  };
  retryConfig: {
    maxRetries: number;
    retryDelay: number;
    backoffMultiplier: number;
  };
  createdAt: Date;
  updatedAt: Date;

  // Methods
  verifyUrl(): Promise<boolean>;
  trigger(event: WebhookEventType, payload: any): Promise<{ success: boolean; response?: any; error?: string }>;
  generateVerificationToken(): string;
  getStats(): { total: number; successRate: number };
}

// Webhook schema
const WebhookSchema = new Schema<IWebhook>(
  {
    name: {
      type: String,
      required: [true, 'Webhook name is required'],
      trim: true,
      maxlength: [200, 'Webhook name cannot exceed 200 characters'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [2000, 'Description cannot exceed 2000 characters'],
    },
    author: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Author is required'],
    },
    url: {
      type: String,
      required: [true, 'URL is required'],
      trim: true,
      match: [
        /^https?:\/\/(?:www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_\+.~#?&\/=]*)$/
        , 'Please provide a valid URL'],
    },
    secret: {
      type: String,
      trim: true,
    },
    events: {
      type: [
        {
          type: String,
          enum: [
            'agent_created',
            'agent_updated',
            'agent_deleted',
            'agent_executed',
            'template_created',
            'template_updated',
            'template_deleted',
            'user_registered',
            'user_logged_in',
            'github_push',
            'github_pull_request',
            'github_issue',
            'discord_message',
            'zmsfa_agent_created',
            'zmsfa_agent_completed',
            'zmsfa_task_created',
            'zmsfa_system_alert',
            'custom',
          ] as WebhookEventType[],
        },
      ],
      required: [true, 'Events are required'],
      default: [],
    },
    source: {
      type: String,
      enum: ['github', 'discord', 'zmsfa', 'slack', 'twitter', 'custom', 'internal'] as WebhookSource[],
      default: 'custom',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    verificationToken: {
      type: String,
      select: false,
    },
    lastTriggered: {
      type: Date,
    },
    triggerCount: {
      type: Number,
      default: 0,
    },
    successCount: {
      type: Number,
      default: 0,
    },
    failureCount: {
      type: Number,
      default: 0,
    },
    lastSuccess: {
      type: Date,
    },
    lastFailure: {
      type: Date,
    },
    lastFailureReason: {
      type: String,
      trim: true,
    },
    headers: {
      type: Map,
      of: String,
      default: new Map(),
    },
    method: {
      type: String,
      enum: ['POST', 'PUT', 'GET', 'DELETE'] as IWebhook['method'][],
      default: 'POST',
    },
    payloadTemplate: {
      type: Map,
      of: Schema.Types.Mixed,
      default: new Map(),
    },
    rateLimit: {
      type: {
        maxRequests: {
          type: Number,
          default: 100,
        },
        windowMs: {
          type: Number,
          default: 60000, // 1 minute
        },
      },
      default: () => ({}),
    },
    retryConfig: {
      type: {
        maxRetries: {
          type: Number,
          default: 3,
        },
        retryDelay: {
          type: Number,
          default: 1000, // 1 second
        },
        backoffMultiplier: {
          type: Number,
          default: 2,
        },
      },
      default: () => ({}),
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (doc, ret) => {
        // Convert Maps to plain objects
        if (ret.headers && ret.headers instanceof Map) {
          ret.headers = Object.fromEntries(ret.headers);
        }
        if (ret.payloadTemplate && ret.payloadTemplate instanceof Map) {
          ret.payloadTemplate = Object.fromEntries(ret.payloadTemplate);
        }
        return ret;
      },
    },
    toObject: {
      virtuals: true,
      transform: (doc, ret) => {
        if (ret.headers && ret.headers instanceof Map) {
          ret.headers = Object.fromEntries(ret.headers);
        }
        if (ret.payloadTemplate && ret.payloadTemplate instanceof Map) {
          ret.payloadTemplate = Object.fromEntries(ret.payloadTemplate);
        }
        return ret;
      },
    },
  }
);

// Method to verify webhook URL
WebhookSchema.methods.verifyUrl = async function (this: IWebhook): Promise<boolean> {
  // In a real implementation, this would make a test request to verify the URL
  // For now, we'll just mark it as verified
  this.isVerified = true;
  await this.save();
  return true;
};

// Method to trigger webhook
WebhookSchema.methods.trigger = async function (
  this: IWebhook,
  event: WebhookEventType,
  payload: any
): Promise<{ success: boolean; response?: any; error?: string }> {
  // Check if this webhook should handle this event
  if (!this.events.includes(event)) {
    return { success: false, error: 'Webhook not configured for this event' };
  }

  if (!this.isActive) {
    return { success: false, error: 'Webhook is not active' };
  }

  // In a real implementation, this would make an HTTP request
  // For now, we'll simulate it
  try {
    // Update stats
    this.triggerCount += 1;
    this.lastTriggered = new Date();
    this.successCount += 1;
    this.lastSuccess = new Date();
    this.markModified('triggerCount');
    this.markModified('lastTriggered');
    this.markModified('successCount');
    this.markModified('lastSuccess');
    await this.save();

    return {
      success: true,
      response: { message: 'Webhook triggered successfully' },
    };
  } catch (error: any) {
    this.failureCount += 1;
    this.lastFailure = new Date();
    this.lastFailureReason = error.message;
    this.markModified('failureCount');
    this.markModified('lastFailure');
    this.markModified('lastFailureReason');
    await this.save();

    return { success: false, error: error.message };
  }
};

// Method to generate verification token
WebhookSchema.methods.generateVerificationToken = function (this: IWebhook): string {
  const token = Math.random().toString(36).substring(2, 15) + 
               Math.random().toString(36).substring(2, 15);
  this.verificationToken = token;
  this.markModified('verificationToken');
  this.save();
  return token;
};

// Method to get webhook statistics
WebhookSchema.methods.getStats = function (this: IWebhook): { total: number; successRate: number } {
  const total = this.triggerCount;
  const success = this.successCount;
  const successRate = total > 0 ? (success / total) * 100 : 0;

  return {
    total,
    successRate,
  };
};

// Indexes
WebhookSchema.index({ author: 1, createdAt: -1 });
WebhookSchema.index({ author: 1, name: 1 });
WebhookSchema.index({ url: 1 }, { unique: true, sparse: true });
WebhookSchema.index({ source: 1 });
WebhookSchema.index({ events: 1 });
WebhookSchema.index({ isActive: 1 });
WebhookSchema.index({ isVerified: 1 });
WebhookSchema.index({ createdAt: -1 });
WebhookSchema.index({ updatedAt: -1 });

// Virtual for public webhook data
WebhookSchema.virtual('publicData').get(function (this: IWebhook) {
  const headers = this.headers as any;
  const payloadTemplate = this.payloadTemplate as any;

  return {
    id: this._id.toString(),
    name: this.name,
    description: this.description,
    author: this.author.toString(),
    url: this.url,
    source: this.source,
    events: this.events,
    isActive: this.isActive,
    isVerified: this.isVerified,
    headers: headers ? Object.fromEntries(headers) : {},
    method: this.method,
    payloadTemplate: payloadTemplate ? Object.fromEntries(payloadTemplate) : {},
    createdAt: this.createdAt,
    ...this.getStats(),
  };
});

// Create and export model
const WebhookModel: Model<IWebhook> = mongoose.models.Webhook || mongoose.model<IWebhook>('Webhook', WebhookSchema);

export default WebhookModel;
