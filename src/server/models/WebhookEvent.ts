/**
 * Webhook Event Model
 * MongoDB schema for webhook event history
 */

import mongoose, { Document, Schema, Model, Types } from 'mongoose';

// Webhook event status type
export type WebhookEventStatus = 'pending' | 'processed' | 'failed' | 'retrying';

// Webhook event interface
export interface IWebhookEvent extends Document {
  webhook: Types.ObjectId;
  source: string;
  type: string;
  payload: any;
  status: WebhookEventStatus;
  attempts: number;
  maxAttempts: number;
  response?: any;
  error?: string;
  errorStack?: string;
  responseTime?: number; // in ms
  responseStatus?: number;
  processedAt?: Date;
  scheduledFor?: Date;
  metadata: {
    ipAddress?: string;
    userAgent?: string;
    requestId?: string;
    correlationId?: string;
  };
  createdAt: Date;
  updatedAt: Date;

  // Methods
  markAsProcessed(response: any, responseTime: number, responseStatus: number): Promise<IWebhookEvent>;
  markAsFailed(error: string, errorStack?: string): Promise<IWebhookEvent>;
  retry(): Promise<IWebhookEvent>;
  getAttempts(): number;
}

// Webhook event schema
const WebhookEventSchema = new Schema<IWebhookEvent>(
  {
    webhook: {
      type: Schema.Types.ObjectId,
      ref: 'Webhook',
      required: [true, 'Webhook reference is required'],
    },
    source: {
      type: String,
      required: [true, 'Source is required'],
      trim: true,
      maxlength: [100, 'Source cannot exceed 100 characters'],
    },
    type: {
      type: String,
      required: [true, 'Event type is required'],
      trim: true,
      maxlength: [100, 'Event type cannot exceed 100 characters'],
    },
    payload: {
      type: Schema.Types.Mixed,
      required: [true, 'Payload is required'],
    },
    status: {
      type: String,
      enum: ['pending', 'processed', 'failed', 'retrying'] as WebhookEventStatus[],
      default: 'pending',
    },
    attempts: {
      type: Number,
      default: 0,
    },
    maxAttempts: {
      type: Number,
      default: 3,
    },
    response: {
      type: Schema.Types.Mixed,
    },
    error: {
      type: String,
      trim: true,
    },
    errorStack: {
      type: String,
      trim: true,
    },
    responseTime: {
      type: Number,
    },
    responseStatus: {
      type: Number,
    },
    processedAt: {
      type: Date,
    },
    scheduledFor: {
      type: Date,
    },
    metadata: {
      type: {
        ipAddress: {
          type: String,
          trim: true,
        },
        userAgent: {
          type: String,
          trim: true,
        },
        requestId: {
          type: String,
          trim: true,
        },
        correlationId: {
          type: String,
          trim: true,
        },
      },
      default: () => ({}),
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
    },
    toObject: {
      virtuals: true,
    },
  }
);

// Method to mark event as processed
WebhookEventSchema.methods.markAsProcessed = async function (
  this: IWebhookEvent,
  response: any,
  responseTime: number,
  responseStatus: number
): Promise<IWebhookEvent> {
  this.status = 'processed';
  this.response = response;
  this.responseTime = responseTime;
  this.responseStatus = responseStatus;
  this.processedAt = new Date();
  this.attempts += 1;
  this.updatedAt = new Date();

  await this.save();
  return this;
};

// Method to mark event as failed
WebhookEventSchema.methods.markAsFailed = async function (
  this: IWebhookEvent,
  error: string,
  errorStack?: string
): Promise<IWebhookEvent> {
  this.status = this.attempts >= this.maxAttempts ? 'failed' : 'retrying';
  this.error = error;
  this.errorStack = errorStack;
  this.attempts += 1;
  this.updatedAt = new Date();

  // Schedule retry if not maxed out
  if (this.attempts < this.maxAttempts) {
    const delay = Math.pow(2, this.attempts) * 1000; // Exponential backoff
    this.scheduledFor = new Date(Date.now() + delay);
  }

  await this.save();
  return this;
};

// Method to retry the event
WebhookEventSchema.methods.retry = async function (this: IWebhookEvent): Promise<IWebhookEvent> {
  this.status = 'pending';
  this.scheduledFor = undefined;
  this.updatedAt = new Date();

  await this.save();
  return this;
};

// Method to get attempt count
WebhookEventSchema.methods.getAttempts = function (this: IWebhookEvent): number {
  return this.attempts;
};

// Indexes
WebhookEventSchema.index({ webhook: 1, createdAt: -1 });
WebhookEventSchema.index({ source: 1, createdAt: -1 });
WebhookEventSchema.index({ type: 1, createdAt: -1 });
WebhookEventSchema.index({ status: 1, createdAt: -1 });
WebhookEventSchema.index({ scheduledFor: 1 });
WebhookEventSchema.index({ createdAt: -1 });
WebhookEventSchema.index({ updatedAt: -1 });

// Virtual for processing time
WebhookEventSchema.virtual('processingTime').get(function (this: IWebhookEvent): number | undefined {
  if (this.processedAt && this.createdAt) {
    return this.processedAt.getTime() - this.createdAt.getTime();
  }
  return undefined;
});

// Virtual for is retryable
WebhookEventSchema.virtual('isRetryable').get(function (this: IWebhookEvent): boolean {
  return this.status === 'retrying' && this.attempts < this.maxAttempts;
});

// Virtual for next attempt time
WebhookEventSchema.virtual('nextAttemptIn').get(function (this: IWebhookEvent): number | undefined {
  if (this.scheduledFor) {
    const now = Date.now();
    const scheduled = this.scheduledFor.getTime();
    return scheduled > now ? scheduled - now : undefined;
  }
  return undefined;
});

// Create and export model
const WebhookEventModel: Model<IWebhookEvent> = mongoose.models.WebhookEvent || 
  mongoose.model<IWebhookEvent>('WebhookEvent', WebhookEventSchema);

export default WebhookEventModel;
