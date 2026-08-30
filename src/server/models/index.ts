/**
 * Models Index
 * Export all MongoDB models
 */

export { default as UserModel } from './User';
export type { IUser, UserRole } from './User';

export { default as AgentModel } from './Agent';
export type { IAgent, INode, IConnection, NodeType, GateType, TernaryState } from './Agent';

export { default as TemplateModel } from './Template';
export type { ITemplate, TemplateCategory } from './Template';

export { default as WebhookModel } from './Webhook';
export type { IWebhook, WebhookEventType, WebhookSource } from './Webhook';

export { default as WebhookEventModel } from './WebhookEvent';
export type { IWebhookEvent, WebhookEventStatus } from './WebhookEvent';

// Re-export types for convenience
export type { Position, AgentMetadata } from './Agent';
