/**
 * Agent Controller
 * REST API endpoints for agent management
 */

import { Request, Response } from 'express';
import { agentService } from '../services/AgentService';
import { asyncHandler } from '../middleware/errorHandler';
import { authenticate, authorize } from '../middleware/auth';
import { apiLimiter } from '../middleware/rateLimit';

/**
 * Create a new agent
 */
export const createAgent = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const user = (req as any).user;
  const { name, description, nodes, connections, metadata, settings } = req.body;

  if (!name || !nodes) {
    return res.status(400).json({
      error: 'Name and nodes are required',
      code: 'VALIDATION_ERROR',
    });
  }

  const agent = await agentService.createAgent({
    name,
    description,
    nodes,
    connections: connections || [],
    author: user.sub,
    metadata: {
      tags: metadata?.tags || [],
      category: metadata?.category || 'other',
      isPublic: metadata?.isPublic || false,
      difficulty: metadata?.difficulty || 'beginner',
      estimatedTime: metadata?.estimatedTime || 10,
    },
    settings: {
      autoRun: false,
      timeout: 30000,
      maxIterations: 20,
      parallelExecution: false,
      ...settings,
    },
  });

  res.status(201).json({
    agent: agent as any,
  });
});

/**
 * Get agent by ID
 */
export const getAgentById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const user = (req as any).user;

  const agent = await agentService.getAgentById(id);

  // Check if user has access to this agent
  if (agent.author.toString() !== user.sub && user.role !== 'admin') {
    return res.status(403).json({
      error: 'Not authorized to access this agent',
      code: 'UNAUTHORIZED',
    });
  }

  res.json({
    agent: agent as any,
  });
});

/**
 * Get all agents for current user
 */
export const getMyAgents = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const user = (req as any).user;
  const { page, limit, search, tags, category } = req.query;

  const result = await agentService.getAgentsByAuthor(user.sub, {
    page: page ? parseInt(page as string) : undefined,
    limit: limit ? parseInt(limit as string) : undefined,
    search: search as string | undefined,
    tags: tags ? (tags as string).split(',') : undefined,
    category: category as string | undefined,
  });

  res.json({
    agents: result.agents.map(a => a as any),
    total: result.total,
    page: result.page,
    pages: result.pages,
  });
});

/**
 * Get all public agents
 */
export const getPublicAgents = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { page, limit, search, tags, category, sort } = req.query;

  const result = await agentService.getPublicAgents({
    page: page ? parseInt(page as string) : undefined,
    limit: limit ? parseInt(limit as string) : undefined,
    search: search as string | undefined,
    tags: tags ? (tags as string).split(',') : undefined,
    category: category as string | undefined,
    sort: sort as string | undefined,
  });

  res.json({
    agents: result.agents.map(a => a as any),
    total: result.total,
    page: result.page,
    pages: result.pages,
  });
});

/**
 * Update agent
 */
export const updateAgent = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const user = (req as any).user;

  const agent = await agentService.updateAgent(id, user.sub, req.body);

  res.json({
    agent: agent as any,
  });
});

/**
 * Delete agent
 */
export const deleteAgent = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const user = (req as any).user;

  await agentService.deleteAgent(id, user.sub, user.role === 'admin');

  res.json({
    success: true,
    message: 'Agent deleted successfully',
  });
});

/**
 * Clone agent
 */
export const cloneAgent = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const user = (req as any).user;

  const agent = await agentService.cloneAgent(id, user.sub);

  res.status(201).json({
    agent: agent as any,
  });
});

/**
 * Toggle agent visibility
 */
export const toggleAgentVisibility = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const { isPublic } = req.body;
  const user = (req as any).user;

  if (typeof isPublic !== 'boolean') {
    return res.status(400).json({
      error: 'isPublic must be a boolean',
      code: 'VALIDATION_ERROR',
    });
  }

  const agent = await agentService.toggleAgentVisibility(id, user.sub, isPublic);

  res.json({
    agent: agent as any,
  });
});

/**
 * Get featured agents
 */
export const getFeaturedAgents = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { limit } = req.query;
  const agents = await agentService.getFeaturedAgents(parseInt(limit as string) || 10);

  res.json({
    agents: agents.map(a => a as any),
  });
});

/**
 * Get recent agents
 */
export const getRecentAgents = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { limit } = req.query;
  const agents = await agentService.getRecentAgents(parseInt(limit as string) || 10);

  res.json({
    agents: agents.map(a => a as any),
  });
});

/**
 * Get popular agents
 */
export const getPopularAgents = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { limit } = req.query;
  const agents = await agentService.getPopularAgents(parseInt(limit as string) || 10);

  res.json({
    agents: agents.map(a => a as any),
  });
});

/**
 * Get agent stats
 */
export const getAgentStats = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const user = (req as any).user;

  const agent = await agentService.getAgentById(id);

  // Check if user has access to this agent
  if (agent.author.toString() !== user.sub && user.role !== 'admin') {
    return res.status(403).json({
      error: 'Not authorized to access these stats',
      code: 'UNAUTHORIZED',
    });
  }

  const stats = await agentService.getAgentStats(id);

  res.json({
    stats,
  });
});

/**
 * Execute agent
 */
export const executeAgent = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const user = (req as any).user;
  const { input } = req.body;

  const agent = await agentService.getAgentById(id);

  // Check if user has access to this agent
  if (agent.author.toString() !== user.sub && user.role !== 'admin') {
    return res.status(403).json({
      error: 'Not authorized to execute this agent',
      code: 'UNAUTHORIZED',
    });
  }

  const result = await agentService.executeAgent(id, input);

  if (!result.success) {
    return res.status(400).json({
      error: result.error,
      code: 'EXECUTION_ERROR',
    });
  }

  res.json({
    success: true,
    result: result.result,
    executionTime: result.executionTime,
  });
});

/**
 * Get agent categories
 */
export const getAgentCategories = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const categories = [
    'automation',
    'data-processing',
    'ai-assistants',
    'web-scraping',
    'chatbots',
    'analysis',
    'creative',
    'productivity',
    'other',
  ];

  res.json({
    categories,
  });
});

/**
 * Get agent difficulties
 */
export const getAgentDifficulties = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const difficulties = [
    { value: 'beginner', label: 'Beginner' },
    { value: 'intermediate', label: 'Intermediate' },
    { value: 'advanced', label: 'Advanced' },
  ];

  res.json({
    difficulties,
  });
});

export default {
  createAgent,
  getAgentById,
  getMyAgents,
  getPublicAgents,
  updateAgent,
  deleteAgent,
  cloneAgent,
  toggleAgentVisibility,
  getFeaturedAgents,
  getRecentAgents,
  getPopularAgents,
  getAgentStats,
  executeAgent,
  getAgentCategories,
  getAgentDifficulties,
};
