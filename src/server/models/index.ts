/**
 * Models Index
 * Export all MongoDB models
 */

export { default as UserModel, IUser, UserRole } from './User';
export { default as AgentModel, IAgent, INode, IConnection, NodeType, GateType, TernaryState } from './Agent';
export { default as TemplateModel, ITemplate, TemplateCategory } from './Template';
export { default as WebhookModel, IWebhook, WebhookEventType, WebhookSource } from './Webhook';
export { default as WebhookEventModel, IWebhookEvent, WebhookEventStatus } from './WebhookEvent';

// Re-export types for convenience
export type {
  Position,
  AgentMetadata,
} from './Agent';
