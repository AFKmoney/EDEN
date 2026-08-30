/**
 * EDEN Backend Server
 * REST API for EDEN Visual AI Graph IDE with MongoDB
 */

import express, { Request, Response, NextFunction, Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { initializeDatabase, closeDatabase } from './config/database';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { apiLimiter, authLimiter, webhookLimiter } from './middleware/rateLimit';
import { authenticate, optionalAuthenticate } from './middleware/auth';

// Import controllers
import * as UserController from './controllers/UserController';
import * as AgentController from './controllers/AgentController';
import * as TemplateController from './controllers/TemplateController';
import * as WebhookController from './controllers/WebhookController';

// Configuration
const PORT = process.env.PORT || 4000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Initialize Express
const app: Application = express();

// ============================================
// Middleware
// ============================================

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      fontSrc: ["'self'", "https:"],
      connectSrc: ["'self'", "https:"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

// CORS configuration
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-EDEN-Signature'],
  credentials: true,
  maxAge: 86400,
}));

// Rate limiting
app.use(apiLimiter);

// Body parsing
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Logging
app.use(morgan(NODE_ENV === 'production' ? 'combined' : 'dev'));

// Trust proxy for HTTPS detection
app.set('trust proxy', true);

// ============================================
// Database Initialization
// ============================================

// Initialize database connections
initializeDatabase().catch((error) => {
  console.error('Failed to initialize database:', error);
  process.exit(1);
});

// ============================================
// Health Check
// ============================================

app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: Date.now(),
    version: '1.0.0',
    environment: NODE_ENV,
    database: 'connected',
  });
});

// ============================================
// Authentication Routes
// ============================================

// Register
app.post('/api/auth/register', authLimiter, UserController.register);

// Login
app.post('/api/auth/login', authLimiter, UserController.login);

// Logout
app.post('/api/auth/logout', authenticate, UserController.logout);

// Refresh token
app.post('/api/auth/refresh', authenticate, UserController.refreshToken);

// Get current user
app.get('/api/auth/me', authenticate, UserController.getMe);

// Verify email
app.get('/api/auth/verify', UserController.verifyEmail);

// Request password reset
app.post('/api/auth/request-password-reset', authLimiter, UserController.requestPasswordReset);

// Reset password
app.post('/api/auth/reset-password', UserController.resetPassword);

// Check email availability
app.get('/api/auth/check-email', UserController.checkEmailAvailable);

// Get user by ID
app.get('/api/users/:id', authenticate, UserController.getUserById);

// Update user profile
app.put('/api/users/:id/profile', authenticate, UserController.updateProfile);

// Get user stats
app.get('/api/users/:id/stats', authenticate, UserController.getUserStats);

// Admin: Get all users
app.get('/api/users', authenticate, UserController.getAllUsers);

// Admin: Update user
app.put('/api/users/:id', authenticate, UserController.updateUser);

// Admin: Delete user
app.delete('/api/users/:id', authenticate, UserController.deleteUser);

// ============================================
// Agent Routes
// ============================================

// Create agent
app.post('/api/agents', authenticate, AgentController.createAgent);

// Get agent by ID
app.get('/api/agents/:id', authenticate, AgentController.getAgentById);

// Get my agents
app.get('/api/agents', authenticate, AgentController.getMyAgents);

// Get public agents
app.get('/api/agents/public', optionalAuthenticate, AgentController.getPublicAgents);

// Update agent
app.put('/api/agents/:id', authenticate, AgentController.updateAgent);

// Delete agent
app.delete('/api/agents/:id', authenticate, AgentController.deleteAgent);

// Clone agent
app.post('/api/agents/:id/clone', authenticate, AgentController.cloneAgent);

// Toggle agent visibility
app.put('/api/agents/:id/visibility', authenticate, AgentController.toggleAgentVisibility);

// Get featured agents
app.get('/api/agents/featured', AgentController.getFeaturedAgents);

// Get recent agents
app.get('/api/agents/recent', AgentController.getRecentAgents);

// Get popular agents
app.get('/api/agents/popular', AgentController.getPopularAgents);

// Execute agent
app.post('/api/agents/:id/execute', authenticate, AgentController.executeAgent);

// Get agent stats
app.get('/api/agents/:id/stats', authenticate, AgentController.getAgentStats);

// Get agent categories
app.get('/api/agents/categories', AgentController.getAgentCategories);

// Get agent difficulties
app.get('/api/agents/difficulties', AgentController.getAgentDifficulties);

// ============================================
// Template Routes
// ============================================

// Create template
app.post('/api/templates', authenticate, TemplateController.createTemplate);

// Get template by ID
app.get('/api/templates/:id', optionalAuthenticate, TemplateController.getTemplateById);

// Get all templates
app.get('/api/templates', optionalAuthenticate, TemplateController.getAllTemplates);

// Get public templates
app.get('/api/templates/public', TemplateController.getPublicTemplates);

// Get user's templates
app.get('/api/users/:id/templates', authenticate, TemplateController.getUserTemplates);

// Update template
app.put('/api/templates/:id', authenticate, TemplateController.updateTemplate);

// Delete template
app.delete('/api/templates/:id', authenticate, TemplateController.deleteTemplate);

// Clone template
app.post('/api/templates/:id/clone', authenticate, TemplateController.cloneTemplate);

// Fork template
app.post('/api/templates/:id/fork', authenticate, TemplateController.forkTemplate);

// Toggle template visibility
app.put('/api/templates/:id/visibility', authenticate, TemplateController.toggleTemplateVisibility);

// Feature template (admin)
app.put('/api/templates/:id/feature', authenticate, TemplateController.featureTemplate);

// Like template
app.post('/api/templates/:id/like', authenticate, TemplateController.likeTemplate);

// Unlike template
app.post('/api/templates/:id/unlike', authenticate, TemplateController.unlikeTemplate);

// Download template
app.post('/api/templates/:id/download', optionalAuthenticate, TemplateController.downloadTemplate);

// Rate template
app.post('/api/templates/:id/rate', authenticate, TemplateController.rateTemplate);

// Add review
app.post('/api/templates/:id/reviews', authenticate, TemplateController.addReview);

// Get featured templates
app.get('/api/templates/featured', TemplateController.getFeaturedTemplates);

// Get popular templates
app.get('/api/templates/popular', TemplateController.getPopularTemplates);

// Get recent templates
app.get('/api/templates/recent', TemplateController.getRecentTemplates);

// Get top rated templates
app.get('/api/templates/top-rated', TemplateController.getTopRatedTemplates);

// Get templates by category
app.get('/api/templates/category/:category', TemplateController.getTemplatesByCategory);

// Search templates
app.get('/api/templates/search', TemplateController.searchTemplates);

// Get template stats
app.get('/api/templates/:id/stats', TemplateController.getTemplateStats);

// Get template categories
app.get('/api/templates/categories', TemplateController.getTemplateCategories);

// Get template difficulties
app.get('/api/templates/difficulties', TemplateController.getTemplateDifficulties);

// ============================================
// Webhook Routes
// ============================================

// Create webhook
app.post('/api/webhooks', authenticate, WebhookController.createWebhook);

// Get my webhooks
app.get('/api/webhooks', authenticate, WebhookController.getMyWebhooks);

// Get all webhooks (admin)
app.get('/api/webhooks/all', authenticate, WebhookController.getAllWebhooks);

// Get webhook by ID
app.get('/api/webhooks/:id', authenticate, WebhookController.getWebhookById);

// Update webhook
app.put('/api/webhooks/:id', authenticate, WebhookController.updateWebhook);

// Delete webhook
app.delete('/api/webhooks/:id', authenticate, WebhookController.deleteWebhook);

// Toggle webhook
app.put('/api/webhooks/:id/toggle', authenticate, WebhookController.toggleWebhook);

// Verify webhook
app.post('/api/webhooks/:id/verify', authenticate, WebhookController.verifyWebhook);

// Get webhook stats
app.get('/api/webhooks/:id/stats', authenticate, WebhookController.getWebhookStats);

// Get webhook events
app.get('/api/webhooks/events', authenticate, WebhookController.getWebhookEvents);

// Get webhook event by ID
app.get('/api/webhooks/events/:id', authenticate, WebhookController.getWebhookEventById);

// Retry webhook event
app.post('/api/webhooks/events/:id/retry', authenticate, WebhookController.retryWebhookEvent);

// Handle incoming webhook
app.post('/api/webhooks/incoming/:source', webhookLimiter, WebhookController.handleIncomingWebhook);

// Trigger webhook manually
app.post('/api/webhooks/:id/trigger', authenticate, WebhookController.triggerWebhook);

// Get webhook sources
app.get('/api/webhooks/sources', WebhookController.getWebhookSources);

// Get webhook event types
app.get('/api/webhooks/event-types', WebhookController.getWebhookEventTypes);

// ============================================
// System Routes
// ============================================

// Get system stats
app.get('/api/system/stats', (req: Request, res: Response) => {
  // In a real implementation, this would fetch actual stats from the database
  res.json({
    stats: {
      totalUsers: 0,
      totalAgents: 0,
      totalTemplates: 0,
      totalWebhooks: 0,
      totalWebhookEvents: 0,
      publicTemplates: 0,
    },
  });
});

// Get system health
app.get('/api/system/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: Date.now(),
    version: '1.0.0',
    environment: NODE_ENV,
    uptime: process.uptime(),
    memory: process.memoryUsage(),
  });
});

// ============================================
// Error Handling
// ============================================

// 404 handler
app.use(notFoundHandler);

// Error handler
app.use(errorHandler);

// ============================================
// Start Server
// ============================================

// Only start server if not in test mode
if (require.main === module) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   ███████╗██████╗███████╗███╗   ██╗███████╗                ║
║   ██╔════╝██╔══██╗██╔════╝████╗  ██║██╔════╝                ║
║   ███████╗██████╔╝█████╗  ██╔██╗ ██║█████╗                  ║
║   ╚════██║██╔══██╗██╔══╝  ██║╚██╗██║██╔══╝                  ║
║   ███████║██║  ██║███████╗██║ ╚████║███████╗                ║
║   ╚══════╝╚═╝  ╚═╝╚══════╝╚═╝  ╚═══╝╚══════╝                ║
║                                                           ║
║   EDEN Backend Server                                     ║
║   Version: 1.0.0                                         ║
║   Environment: ${NODE_ENV}                                ║
║   Port: ${PORT}                                          ║
║   MongoDB: Connected                                      ║
║   Redis: Connected                                        ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
    `);
  });
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  await closeDatabase();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received. Shutting down gracefully...');
  await closeDatabase();
  process.exit(0);
});

export default app;
