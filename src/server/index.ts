/**
 * EDEN Backend Server
 * REST API for EDEN Visual AI Graph IDE
 */

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import morgan from 'morgan';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';

// Import types
import { WebhookPayload, WebhookEvent } from '../app/core/WebhookService';
import { AgentSnapshot, AgentTemplate } from '../app/core/AgentPersistenceService';

// Configuration
const PORT = process.env.PORT || 4000;
const NODE_ENV = process.env.NODE_ENV || 'development';
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');
const AI_TIMEOUT_MS = parseInt(process.env.AI_TIMEOUT_MS || '120000');

// Initialize Express
const app = express();

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
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // limit each IP to 1000 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});
app.use(limiter);

// Body parsing
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Logging
app.use(morgan(NODE_ENV === 'production' ? 'combined' : 'dev'));

// Trust proxy for HTTPS detection
app.set('trust proxy', true);

// ============================================
// Utility Functions
// ============================================

/**
 * Generate JWT token
 */
function generateToken(user: { id: string; email: string; role?: string }): string {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      role: user.role || 'user',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60), // 24 hours
    },
    JWT_SECRET
  );
}

/**
 * Verify JWT token
 */
function verifyToken(token: string): any {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

/**
 * Authentication middleware
 */
function authenticate(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const token = authHeader.substring(7);
  const decoded = verifyToken(token);
  
  if (!decoded) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  (req as any).user = decoded;
  next();
}

/**
 * Role-based authorization middleware
 */
function authorize(roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    
    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!roles.includes(user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
  };
}

/**
 * Validate webhook signature
 */
function validateWebhookSignature(
  payload: any,
  signature: string | undefined,
  secret: string | undefined
): boolean {
  if (!signature || !secret) return true; // Skip if no signature required
  
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');
  
  return expectedSignature === signature;
}

// ============================================
// Mock Database (Replace with real database in production)
// ============================================

interface User {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  role: 'user' | 'admin';
  createdAt: number;
}

interface Database {
  users: Record<string, User>;
  agents: Record<string, AgentSnapshot>;
  templates: Record<string, AgentTemplate>;
  webhooks: Record<string, any>;
  webhookEvents: WebhookEvent[];
}

const db: Database = {
  users: {},
  agents: {},
  templates: {},
  webhooks: {},
  webhookEvents: [],
};

// Initialize with some test data
function initializeDatabase() {
  // Create admin user
  const adminPassword = crypto.createHash('sha256').update('admin123').digest('hex');
  db.users['admin_1'] = {
    id: 'admin_1',
    email: 'admin@eden.dev',
    name: 'Admin User',
    passwordHash: adminPassword,
    role: 'admin',
    createdAt: Date.now(),
  };

  // Create test user
  const userPassword = crypto.createHash('sha256').update('user123').digest('hex');
  db.users['user_1'] = {
    id: 'user_1',
    email: 'user@eden.dev',
    name: 'Test User',
    passwordHash: userPassword,
    role: 'user',
    createdAt: Date.now(),
  };
}

initializeDatabase();

// ============================================
// API Routes
// ============================================

// Health check
app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: Date.now(),
    version: '1.0.0',
    environment: NODE_ENV,
  });
});

// ============================================
// Authentication Routes
// ============================================

/**
 * POST /api/auth/register
 * Register a new user
 */
app.post('/api/auth/register', async (req: Request, res: Response) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Email, password, and name are required' });
    }

    // Check if user already exists
    const existingUser = Object.values(db.users).find(u => u.email === email);
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Hash password
    const passwordHash = crypto.createHash('sha256').update(password).digest('hex');

    // Create user
    const user: User = {
      id: `user_${Date.now()}`,
      email,
      name,
      passwordHash,
      role: 'user',
      createdAt: Date.now(),
    };

    db.users[user.id] = user;

    // Generate token
    const token = generateToken(user);

    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        createdAt: user.createdAt,
      },
      token,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/auth/login
 * Login user
 */
app.post('/api/auth/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find user
    const user = Object.values(db.users).find(u => u.email === email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Verify password
    const passwordHash = crypto.createHash('sha256').update(password).digest('hex');
    if (passwordHash !== user.passwordHash) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate token
    const token = generateToken(user);

    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        createdAt: user.createdAt,
      },
      token,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/auth/refresh
 * Refresh token
 */
app.post('/api/auth/refresh', authenticate, (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const token = generateToken(user);
    
    res.json({ success: true, token });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/auth/logout
 * Logout user (invalidate token client-side)
 */
app.post('/api/auth/logout', authenticate, (req: Request, res: Response) => {
  res.json({ success: true });
});

/**
 * GET /api/auth/me
 * Get current user
 */
app.get('/api/auth/me', authenticate, (req: Request, res: Response) => {
  const user = (req as any).user;
  res.json({ user });
});

// ============================================
// Agent Routes
// ============================================

/**
 * GET /api/agents
 * Get all agents for current user
 */
app.get('/api/agents', authenticate, (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const agents = Object.values(db.agents).filter(a => a.metadata.author === user.sub);
    res.json({ agents });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/agents/:id
 * Get a specific agent
 */
app.get('/api/agents/:id', authenticate, (req: Request, res: Response) => {
  try {
    const agent = db.agents[req.params.id];
    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }
    res.json({ agent });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/agents
 * Create a new agent
 */
app.post('/api/agents', authenticate, (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { name, description, nodes, connections, tags } = req.body;

    if (!name || !nodes) {
      return res.status(400).json({ error: 'Name and nodes are required' });
    }

    const agent: AgentSnapshot = {
      id: `agent_${Date.now()}`,
      name,
      description,
      nodes,
      connections: connections || [],
      metadata: {
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: '1.0.0',
        author: user.sub,
        tags: tags || [],
      },
    };

    db.agents[agent.id] = agent;
    res.status(201).json({ agent });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/agents/:id
 * Update an agent
 */
app.put('/api/agents/:id', authenticate, (req: Request, res: Response) => {
  try {
    const agent = db.agents[req.params.id];
    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    const user = (req as any).user;
    if (agent.metadata.author !== user.sub) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const updates = req.body;
    db.agents[req.params.id] = {
      ...agent,
      ...updates,
      metadata: {
        ...agent.metadata,
        updatedAt: Date.now(),
      },
    };

    res.json({ agent: db.agents[req.params.id] });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/agents/:id
 * Delete an agent
 */
app.delete('/api/agents/:id', authenticate, (req: Request, res: Response) => {
  try {
    const agent = db.agents[req.params.id];
    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    const user = (req as any).user;
    if (agent.metadata.author !== user.sub && user.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorized' });
    }

    delete db.agents[req.params.id];
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// Template Routes
// ============================================

/**
 * GET /api/templates
 * Get all templates (public or user's)
 */
app.get('/api/templates', (req: Request, res: Response) => {
  try {
    const { category, search, sort, isPublic } = req.query;
    let templates = Object.values(db.templates);

    // Filter by public status (if not authenticated)
    const user = (req as any).user;
    if (!user) {
      templates = templates.filter(t => t.metadata.isPublic);
    } else if (isPublic !== undefined) {
      templates = templates.filter(t => t.metadata.isPublic === (isPublic === 'true'));
    }

    // Filter by category
    if (category) {
      templates = templates.filter(t => t.metadata.category === category);
    }

    // Filter by search
    if (search) {
      const lowerSearch = (search as string).toLowerCase();
      templates = templates.filter(t =>
        t.name.toLowerCase().includes(lowerSearch) ||
        t.description.toLowerCase().includes(lowerSearch) ||
        t.author.toLowerCase().includes(lowerSearch) ||
        t.metadata.tags.some(tag => tag.toLowerCase().includes(lowerSearch))
      );
    }

    // Sort
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

    res.json({ templates });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/templates/:id
 * Get a specific template
 */
app.get('/api/templates/:id', (req: Request, res: Response) => {
  try {
    const template = db.templates[req.params.id];
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    // Check if public or user has access
    const user = (req as any).user;
    if (!template.metadata.isPublic && (!user || template.authorId !== user.sub)) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    res.json({ template });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/templates
 * Create a new template
 */
app.post('/api/templates', authenticate, (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { name, description, nodes, connections, category, tags, isPublic } = req.body;

    if (!name || !nodes) {
      return res.status(400).json({ error: 'Name and nodes are required' });
    }

    const template: AgentTemplate = {
      id: `template_${Date.now()}`,
      name,
      description,
      author: user.name || user.email,
      authorId: user.sub,
      nodes,
      connections: connections || [],
      metadata: {
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: '1.0.0',
        tags: tags || [],
        category: category || 'other',
        isPublic: isPublic || false,
        downloadCount: 0,
        rating: 0,
        likeCount: 0,
      },
    };

    db.templates[template.id] = template;
    res.status(201).json({ template });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/templates/:id
 * Update a template
 */
app.put('/api/templates/:id', authenticate, (req: Request, res: Response) => {
  try {
    const template = db.templates[req.params.id];
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    const user = (req as any).user;
    if (template.authorId !== user.sub && user.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const updates = req.body;
    db.templates[req.params.id] = {
      ...template,
      ...updates,
      metadata: {
        ...template.metadata,
        updatedAt: Date.now(),
      },
    };

    res.json({ template: db.templates[req.params.id] });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/templates/:id
 * Delete a template
 */
app.delete('/api/templates/:id', authenticate, (req: Request, res: Response) => {
  try {
    const template = db.templates[req.params.id];
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    const user = (req as any).user;
    if (template.authorId !== user.sub && user.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorized' });
    }

    delete db.templates[req.params.id];
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/templates/:id/like
 * Like a template
 */
app.post('/api/templates/:id/like', authenticate, (req: Request, res: Response) => {
  try {
    const template = db.templates[req.params.id];
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    db.templates[req.params.id] = {
      ...template,
      metadata: {
        ...template.metadata,
        likeCount: template.metadata.likeCount + 1,
      },
    };

    res.json({ success: true, template: db.templates[req.params.id] });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/templates/:id/download
 * Download a template (increment counter)
 */
app.post('/api/templates/:id/download', authenticate, (req: Request, res: Response) => {
  try {
    const template = db.templates[req.params.id];
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    db.templates[req.params.id] = {
      ...template,
      metadata: {
        ...template.metadata,
        downloadCount: template.metadata.downloadCount + 1,
      },
    };

    res.json({ success: true, template: db.templates[req.params.id] });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/templates/:id/rate
 * Rate a template
 */
app.post('/api/templates/:id/rate', authenticate, (req: Request, res: Response) => {
  try {
    const { rating } = req.body;
    const template = db.templates[req.params.id];
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }

    // Simple average rating
    const currentRating = template.metadata.rating || 0;
    const newRating = (currentRating + rating) / 2;

    db.templates[req.params.id] = {
      ...template,
      metadata: {
        ...template.metadata,
        rating: newRating,
      },
    };

    res.json({ success: true, template: db.templates[req.params.id] });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// Webhook Routes
// ============================================

/**
 * GET /api/webhooks
 * Get all webhooks for current user
 */
app.get('/api/webhooks', authenticate, (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const webhooks = Object.values(db.webhooks).filter(w => w.authorId === user.sub);
    res.json({ webhooks });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/webhooks
 * Create a new webhook
 */
app.post('/api/webhooks', authenticate, (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { name, url, secret, events } = req.body;

    if (!name || !url || !events || !Array.isArray(events)) {
      return res.status(400).json({ error: 'Name, URL, and events are required' });
    }

    const webhook = {
      id: `webhook_${Date.now()}`,
      name,
      url,
      secret,
      events,
      authorId: user.sub,
      active: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    db.webhooks[webhook.id] = webhook;
    res.status(201).json({ webhook });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/webhooks/:id
 * Delete a webhook
 */
app.delete('/api/webhooks/:id', authenticate, (req: Request, res: Response) => {
  try {
    const webhook = db.webhooks[req.params.id];
    if (!webhook) {
      return res.status(404).json({ error: 'Webhook not found' });
    }

    const user = (req as any).user;
    if (webhook.authorId !== user.sub && user.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorized' });
    }

    delete db.webhooks[req.params.id];
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/webhooks/:id/trigger
 * Manually trigger a webhook
 */
app.post('/api/webhooks/:id/trigger', authenticate, async (req: Request, res: Response) => {
  try {
    const webhook = db.webhooks[req.params.id];
    if (!webhook) {
      return res.status(404).json({ error: 'Webhook not found' });
    }

    const user = (req as any).user;
    if (webhook.authorId !== user.sub && user.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const { event, payload } = req.body;
    if (!event) {
      return res.status(400).json({ error: 'Event is required' });
    }

    // In production, this would make an actual HTTP request
    // For now, just log it
    const webhookPayload: WebhookPayload = {
      event,
      data: payload,
      timestamp: Date.now(),
    };

    if (webhook.secret) {
      webhookPayload.signature = crypto
        .createHmac('sha256', webhook.secret)
        .update(JSON.stringify(webhookPayload))
        .digest('hex');
    }

    // Record the event
    const eventRecord: WebhookEvent = {
      id: `event_${Date.now()}`,
      source: 'manual',
      type: event,
      timestamp: Date.now(),
      payload,
      processed: true,
      response: { message: 'Webhook triggered manually' },
    };
    db.webhookEvents.push(eventRecord);

    res.json({ success: true, event: eventRecord });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/webhooks/incoming/:source
 * Handle incoming webhooks
 */
app.post('/api/webhooks/incoming/:source', (req: Request, res: Response) => {
  try {
    const { source } = req.params;
    const payload = req.body;
    const signature = req.headers['x-eden-signature'] as string | undefined;

    // Find webhook by URL or source
    const webhook = Object.values(db.webhooks).find(
      w => w.url.includes(source) || w.name.toLowerCase() === source.toLowerCase()
    );

    if (!webhook) {
      return res.status(404).json({ error: 'No webhook configured for this source' });
    }

    // Verify signature if provided
    if (webhook.secret && signature) {
      const expectedSignature = crypto
        .createHmac('sha256', webhook.secret)
        .update(JSON.stringify(payload))
        .digest('hex');

      if (signature !== expectedSignature) {
        return res.status(401).json({ error: 'Invalid signature' });
      }
    }

    // Record the event
    const eventRecord: WebhookEvent = {
      id: `event_${Date.now()}`,
      source,
      type: payload.event || 'unknown',
      timestamp: Date.now(),
      payload,
      processed: true,
    };
    db.webhookEvents.push(eventRecord);

    res.json({ success: true, event: eventRecord });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/webhooks/events
 * Get webhook events
 */
app.get('/api/webhooks/events', authenticate, (req: Request, res: Response) => {
  try {
    const { limit } = req.query;
    const events = db.webhookEvents.slice(0, parseInt(limit as string) || 50);
    res.json({ events });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// System Routes
// ============================================

/**
 * GET /api/system/stats
 * Get system statistics
 */
app.get('/api/system/stats', (req: Request, res: Response) => {
  try {
    const stats = {
      totalUsers: Object.keys(db.users).length,
      totalAgents: Object.keys(db.agents).length,
      totalTemplates: Object.keys(db.templates).length,
      totalWebhooks: Object.keys(db.webhooks).length,
      totalWebhookEvents: db.webhookEvents.length,
      publicTemplates: Object.values(db.templates).filter(t => t.metadata.isPublic).length,
    };
    res.json({ stats });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/system/health
 * Detailed health check
 */
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
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

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
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
    `);
  });
}

export default app;
