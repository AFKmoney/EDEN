/**
 * Webhook Controller
 * REST API endpoints for webhook management
 */

import { Request, Response } from 'express';
import WebhookModel, { IWebhook, WebhookEventType, WebhookSource } from '../models/Webhook';
import WebhookEventModel from '../models/WebhookEvent';
import { asyncHandler } from '../middleware/errorHandler';
import { authenticate, authorize, adminOnly } from '../middleware/auth';
import { apiLimiter, webhookLimiter } from '../middleware/rateLimit';
import crypto from 'crypto';

// Configuration
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'default-webhook-secret';

/**
 * Create a new webhook
 */
export const createWebhook = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;
  const { name, description, url, secret, events, source, method, headers, payloadTemplate, rateLimit, retryConfig } = req.body;

  if (!name || !url || !events || !Array.isArray(events) || events.length === 0) {
    return res.status(400).json({
      error: 'Name, URL, and at least one event are required',
      code: 'VALIDATION_ERROR',
    });
  }

  // Generate secret if not provided
  const webhookSecret = secret || crypto.randomBytes(32).toString('hex');

  const webhook = new WebhookModel({
    name,
    description,
    author: user.sub,
    url,
    secret: webhookSecret,
    events,
    source: source || 'custom',
    method: method || 'POST',
    headers: headers || {},
    payloadTemplate: payloadTemplate || {},
    rateLimit: rateLimit || { maxRequests: 100, windowMs: 60000 },
    retryConfig: retryConfig || { maxRetries: 3, retryDelay: 1000, backoffMultiplier: 2 },
  });

  await webhook.save();

  res.status(201).json({
    webhook: webhook.publicData,
    secret: webhookSecret, // Return secret only on creation
  });
});

/**
 * Get all webhooks for current user
 */
export const getMyWebhooks = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;
  const { page, limit, source, isActive } = req.query;

  const filter: any = { author: user.sub };

  if (source) {
    filter.source = source;
  }

  if (isActive !== undefined) {
    filter.isActive = isActive === 'true';
  }

  const pageNum = page ? parseInt(page as string) : 1;
  const limitNum = limit ? Math.min(parseInt(limit as string), 100) : 20;
  const skip = (pageNum - 1) * limitNum;

  const [webhooks, total] = await Promise.all([
    WebhookModel.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum),
    WebhookModel.countDocuments(filter),
  ]);

  const pages = Math.ceil(total / limitNum);

  res.json({
    webhooks: webhooks.map(w => w.publicData),
    total,
    page: pageNum,
    pages,
  });
});

/**
 * Get all webhooks (admin only)
 */
export const getAllWebhooks = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;

  if (user.role !== 'admin') {
    return res.status(403).json({
      error: 'Admin access required',
      code: 'ADMIN_REQUIRED',
    });
  }

  const { page, limit, source, isActive, author } = req.query;

  const filter: any = {};

  if (source) {
    filter.source = source;
  }

  if (isActive !== undefined) {
    filter.isActive = isActive === 'true';
  }

  if (author) {
    filter.author = author;
  }

  const pageNum = page ? parseInt(page as string) : 1;
  const limitNum = limit ? Math.min(parseInt(limit as string), 100) : 20;
  const skip = (pageNum - 1) * limitNum;

  const [webhooks, total] = await Promise.all([
    WebhookModel.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum),
    WebhookModel.countDocuments(filter),
  ]);

  const pages = Math.ceil(total / limitNum);

  res.json({
    webhooks: webhooks.map(w => w.publicData),
    total,
    page: pageNum,
    pages,
  });
});

/**
 * Get webhook by ID
 */
export const getWebhookById = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = (req as any).user;

  const webhook = await WebhookModel.findById(id);
  if (!webhook) {
    return res.status(404).json({
      error: 'Webhook not found',
      code: 'NOT_FOUND',
    });
  }

  // Check if user has access to this webhook
  if (webhook.author.toString() !== user.sub && user.role !== 'admin') {
    return res.status(403).json({
      error: 'Not authorized to access this webhook',
      code: 'UNAUTHORIZED',
    });
  }

  res.json({
    webhook: webhook.publicData,
  });
});

/**
 * Update webhook
 */
export const updateWebhook = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = (req as any).user;

  const webhook = await WebhookModel.findById(id);
  if (!webhook) {
    return res.status(404).json({
      error: 'Webhook not found',
      code: 'NOT_FOUND',
    });
  }

  // Check if user has access to this webhook
  if (webhook.author.toString() !== user.sub && user.role !== 'admin') {
    return res.status(403).json({
      error: 'Not authorized to update this webhook',
      code: 'UNAUTHORIZED',
    });
  }

  // Prevent updating certain fields
  const safeData = { ...req.body };
  delete safeData.author;
  delete safeData.createdAt;

  const updatedWebhook = await WebhookModel.findByIdAndUpdate(
    id,
    { $set: safeData },
    { new: true, runValidators: true }
  );

  if (!updatedWebhook) {
    return res.status(404).json({
      error: 'Webhook not found',
      code: 'NOT_FOUND',
    });
  }

  res.json({
    webhook: updatedWebhook.publicData,
  });
});

/**
 * Delete webhook
 */
export const deleteWebhook = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = (req as any).user;

  const webhook = await WebhookModel.findById(id);
  if (!webhook) {
    return res.status(404).json({
      error: 'Webhook not found',
      code: 'NOT_FOUND',
    });
  }

  // Check if user has access to this webhook
  if (webhook.author.toString() !== user.sub && user.role !== 'admin') {
    return res.status(403).json({
      error: 'Not authorized to delete this webhook',
      code: 'UNAUTHORIZED',
    });
  }

  await WebhookModel.findByIdAndDelete(id);

  res.json({
    success: true,
    message: 'Webhook deleted successfully',
  });
});

/**
 * Toggle webhook active status
 */
export const toggleWebhook = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = (req as any).user;

  const webhook = await WebhookModel.findById(id);
  if (!webhook) {
    return res.status(404).json({
      error: 'Webhook not found',
      code: 'NOT_FOUND',
    });
  }

  // Check if user has access to this webhook
  if (webhook.author.toString() !== user.sub && user.role !== 'admin') {
    return res.status(403).json({
      error: 'Not authorized to update this webhook',
      code: 'UNAUTHORIZED',
    });
  }

  webhook.isActive = !webhook.isActive;
  await webhook.save();

  res.json({
    webhook: webhook.publicData,
  });
});

/**
 * Verify webhook URL
 */
export const verifyWebhook = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = (req as any).user;

  const webhook = await WebhookModel.findById(id);
  if (!webhook) {
    return res.status(404).json({
      error: 'Webhook not found',
      code: 'NOT_FOUND',
    });
  }

  // Check if user has access to this webhook
  if (webhook.author.toString() !== user.sub && user.role !== 'admin') {
    return res.status(403).json({
      error: 'Not authorized to verify this webhook',
      code: 'UNAUTHORIZED',
    });
  }

  const isVerified = await webhook.verifyUrl();

  res.json({
    success: isVerified,
    webhook: webhook.publicData,
  });
});

/**
 * Get webhook stats
 */
export const getWebhookStats = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = (req as any).user;

  const webhook = await WebhookModel.findById(id);
  if (!webhook) {
    return res.status(404).json({
      error: 'Webhook not found',
      code: 'NOT_FOUND',
    });
  }

  // Check if user has access to this webhook
  if (webhook.author.toString() !== user.sub && user.role !== 'admin') {
    return res.status(403).json({
      error: 'Not authorized to access these stats',
      code: 'UNAUTHORIZED',
    });
  }

  res.json({
    stats: webhook.getStats(),
    webhook: webhook.publicData,
  });
});

/**
 * Get webhook events
 */
export const getWebhookEvents = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;
  const { page, limit, webhook, source, type, status } = req.query;

  const filter: any = {};

  if (webhook) {
    filter.webhook = webhook;
  }

  if (source) {
    filter.source = source;
  }

  if (type) {
    filter.type = type;
  }

  if (status) {
    filter.status = status;
  }

  // If not admin, only show events for user's webhooks
  if (user.role !== 'admin') {
    const userWebhooks = await WebhookModel.find({ author: user.sub }).select('_id');
    const webhookIds = userWebhooks.map(w => w._id);
    filter.webhook = { $in: webhookIds };
  }

  const pageNum = page ? parseInt(page as string) : 1;
  const limitNum = limit ? Math.min(parseInt(limit as string), 100) : 20;
  const skip = (pageNum - 1) * limitNum;

  const [events, total] = await Promise.all([
    WebhookEventModel.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum),
    WebhookEventModel.countDocuments(filter),
  ]);

  const pages = Math.ceil(total / limitNum);

  res.json({
    events,
    total,
    page: pageNum,
    pages,
  });
});

/**
 * Get webhook event by ID
 */
export const getWebhookEventById = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = (req as any).user;

  const event = await WebhookEventModel.findById(id);
  if (!event) {
    return res.status(404).json({
      error: 'Webhook event not found',
      code: 'NOT_FOUND',
    });
  }

  // Check if user has access to this event
  const webhook = await WebhookModel.findById(event.webhook);
  if (!webhook || (webhook.author.toString() !== user.sub && user.role !== 'admin')) {
    return res.status(403).json({
      error: 'Not authorized to access this event',
      code: 'UNAUTHORIZED',
    });
  }

  res.json({
    event,
  });
});

/**
 * Retry webhook event
 */
export const retryWebhookEvent = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = (req as any).user;

  const event = await WebhookEventModel.findById(id);
  if (!event) {
    return res.status(404).json({
      error: 'Webhook event not found',
      code: 'NOT_FOUND',
    });
  }

  // Check if user has access to this event
  const webhook = await WebhookModel.findById(event.webhook);
  if (!webhook || (webhook.author.toString() !== user.sub && user.role !== 'admin')) {
    return res.status(403).json({
      error: 'Not authorized to retry this event',
      code: 'UNAUTHORIZED',
    });
  }

  // Check if event can be retried
  if (!event.isRetryable) {
    return res.status(400).json({
      error: 'This event cannot be retried',
      code: 'VALIDATION_ERROR',
    });
  }

  // Retry the event
  await event.retry();

  res.json({
    success: true,
    message: 'Webhook event scheduled for retry',
    event,
  });
});

/**
 * Handle incoming webhook
 */
export const handleIncomingWebhook = asyncHandler(async (req: Request, res: Response) => {
  const { source } = req.params;
  const payload = req.body;
  const signature = req.headers['x-eden-signature'] as string | undefined;

  // Find webhook by URL or source
  const webhook = await WebhookModel.findOne({
    $or: [
      { url: { $regex: source, $options: 'i' } },
      { source: source as WebhookSource },
    ],
  });

  if (!webhook) {
    return res.status(404).json({
      error: 'No webhook configured for this source',
      code: 'NOT_FOUND',
    });
  }

  // Verify signature if provided
  if (webhook.secret && signature) {
    const expectedSignature = crypto
      .createHmac('sha256', webhook.secret)
      .update(JSON.stringify(payload))
      .digest('hex');

    if (signature !== expectedSignature) {
      return res.status(401).json({
        error: 'Invalid signature',
        code: 'UNAUTHORIZED',
      });
    }
  }

  // Check if webhook accepts this event type
  const eventType = payload.event || payload.type || 'custom';
  if (!webhook.events.includes(eventType as WebhookEventType)) {
    return res.status(400).json({
      error: 'Webhook not configured for this event type',
      code: 'VALIDATION_ERROR',
    });
  }

  // Create event record
  const event = new WebhookEventModel({
    webhook: webhook._id,
    source,
    type: eventType,
    payload: payload,
    status: 'pending',
    maxAttempts: webhook.retryConfig?.maxRetries || 3,
    metadata: {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      requestId: req.headers['x-request-id'] as string | undefined,
    },
  });

  await event.save();

  // Trigger webhook (in a real implementation, this would be async)
  // For now, just mark as processed
  await event.markAsProcessed(
    { message: 'Webhook received and queued' },
    0,
    200
  );

  res.json({
    success: true,
    message: 'Webhook received',
    eventId: event._id.toString(),
  });
});

/**
 * Trigger webhook manually
 */
export const triggerWebhook = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { event, payload } = req.body;
  const user = (req as any).user;

  if (!event) {
    return res.status(400).json({
      error: 'Event is required',
      code: 'VALIDATION_ERROR',
    });
  }

  const webhook = await WebhookModel.findById(id);
  if (!webhook) {
    return res.status(404).json({
      error: 'Webhook not found',
      code: 'NOT_FOUND',
    });
  }

  // Check if user has access to this webhook
  if (webhook.author.toString() !== user.sub && user.role !== 'admin') {
    return res.status(403).json({
      error: 'Not authorized to trigger this webhook',
      code: 'UNAUTHORIZED',
    });
  }

  // Check if webhook accepts this event type
  if (!webhook.events.includes(event as WebhookEventType)) {
    return res.status(400).json({
      error: 'Webhook not configured for this event type',
      code: 'VALIDATION_ERROR',
    });
  }

  // Trigger webhook
  const result = await webhook.trigger(event as WebhookEventType, payload || {});

  // Create event record
  const eventRecord = new WebhookEventModel({
    webhook: webhook._id,
    source: webhook.source,
    type: event,
    payload: payload || {},
    status: result.success ? 'processed' : 'failed',
    response: result.response,
    error: result.error,
    responseTime: 0,
    responseStatus: result.success ? 200 : 500,
    processedAt: new Date(),
    metadata: {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    },
  });

  await eventRecord.save();

  res.json({
    success: result.success,
    message: result.success ? 'Webhook triggered successfully' : 'Webhook trigger failed',
    eventId: eventRecord._id.toString(),
    response: result.response,
    error: result.error,
  });
});

/**
 * Get webhook sources
 */
export const getWebhookSources = asyncHandler(async (req: Request, res: Response) => {
  const sources: WebhookSource[] = ['github', 'discord', 'zmsfa', 'slack', 'twitter', 'custom', 'internal'];

  res.json({
    sources,
  });
});

/**
 * Get webhook event types
 */
export const getWebhookEventTypes = asyncHandler(async (req: Request, res: Response) => {
  const eventTypes: WebhookEventType[] = [
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
  ];

  res.json({
    eventTypes,
  });
});

export default {
  createWebhook,
  getMyWebhooks,
  getAllWebhooks,
  getWebhookById,
  updateWebhook,
  deleteWebhook,
  toggleWebhook,
  verifyWebhook,
  getWebhookStats,
  getWebhookEvents,
  getWebhookEventById,
  retryWebhookEvent,
  handleIncomingWebhook,
  triggerWebhook,
  getWebhookSources,
  getWebhookEventTypes,
};
