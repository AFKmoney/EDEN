/**
 * Template Controller
 * REST API endpoints for template management
 */

import { Request, Response } from 'express';
import { templateService } from '../services/TemplateService';
import { asyncHandler } from '../middleware/errorHandler';
import { authenticate, authorize, optionalAuthenticate } from '../middleware/auth';
import { apiLimiter, searchLimiter } from '../middleware/rateLimit';

/**
 * Create a new template
 */
export const createTemplate = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const user = (req as any).user;
  const { name, description, nodes, connections, metadata, content } = req.body;

  if (!name || !description || !nodes) {
    return res.status(400).json({
      error: 'Name, description, and nodes are required',
      code: 'VALIDATION_ERROR',
    });
  }

  const template = await templateService.createTemplate({
    name,
    description,
    nodes,
    connections: connections || [],
    author: user.sub,
    authorName: user.name || user.email,
    metadata: {
      category: metadata?.category || 'other',
      tags: metadata?.tags || [],
      isPublic: metadata?.isPublic || false,
      difficulty: metadata?.difficulty || 'beginner',
      estimatedTime: metadata?.estimatedTime || 10,
    },
    content: {
      readme: content?.readme || '',
      changelog: content?.changelog || '',
      usage: content?.usage || '',
      dependencies: content?.dependencies || [],
      examples: content?.examples || [],
    },
  });

  res.status(201).json({
    template: template as any,
  });
});

/**
 * Get template by ID
 */
export const getTemplateById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const user = (req as any).user;

  const template = await templateService.getTemplateById(id, user?.sub);

  // Increment view count (only for public templates or authenticated users)
  if (template.metadata.isPublic || user) {
    await templateService.incrementView(template._id.toString());
  }

  res.json({
    template: template as any,
  });
});

/**
 * Get all templates
 */
export const getAllTemplates = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const user = (req as any).user;
  const { page, limit, category, search, tags, sort, isPublic } = req.query;

  const result = await templateService.getTemplates({
    page: page ? parseInt(page as string) : undefined,
    limit: limit ? parseInt(limit as string) : undefined,
    category: category as any,
    search: search as string | undefined,
    tags: tags ? (tags as string).split(',') : undefined,
    sort: sort as string | undefined,
    isPublic: isPublic ? isPublic === 'true' : undefined,
    author: user?.sub,
  });

  res.json({
    templates: result.templates.map(t => t as any),
    total: result.total,
    page: result.page,
    pages: result.pages,
  });
});

/**
 * Get public templates
 */
export const getPublicTemplates = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { page, limit, category, search, tags, sort } = req.query;

  const result = await templateService.getTemplates({
    page: page ? parseInt(page as string) : undefined,
    limit: limit ? parseInt(limit as string) : undefined,
    category: category as any,
    search: search as string | undefined,
    tags: tags ? (tags as string).split(',') : undefined,
    sort: sort as string | undefined,
    isPublic: true,
  });

  res.json({
    templates: result.templates.map(t => t as any),
    total: result.total,
    page: result.page,
    pages: result.pages,
  });
});

/**
 * Get user's templates
 */
export const getUserTemplates = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const user = (req as any).user;
  const { id } = req.params;

  // Check if user is accessing their own templates or is admin
  if (user.sub !== id && user.role !== 'admin') {
    return res.status(403).json({
      error: 'Not authorized to access these templates',
      code: 'UNAUTHORIZED',
    });
  }

  const templates = await templateService.getUserTemplates(id);

  res.json({
    templates: templates.map(t => t as any),
  });
});

/**
 * Update template
 */
export const updateTemplate = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const user = (req as any).user;

  const template = await templateService.updateTemplate(
    id,
    user.sub,
    req.body,
    user.role === 'admin'
  );

  res.json({
    template: template as any,
  });
});

/**
 * Delete template
 */
export const deleteTemplate = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const user = (req as any).user;

  await templateService.deleteTemplate(id, user.sub, user.role === 'admin');

  res.json({
    success: true,
    message: 'Template deleted successfully',
  });
});

/**
 * Clone template
 */
export const cloneTemplate = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const user = (req as any).user;

  const template = await templateService.cloneTemplate(id, user.sub, user.name || user.email);

  res.status(201).json({
    template: template as any,
  });
});

/**
 * Fork template
 */
export const forkTemplate = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const user = (req as any).user;

  const template = await templateService.forkTemplate(id, user.sub, user.name || user.email);

  res.status(201).json({
    template: template as any,
  });
});

/**
 * Toggle template visibility
 */
export const toggleTemplateVisibility = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const { isPublic } = req.body;
  const user = (req as any).user;

  if (typeof isPublic !== 'boolean') {
    return res.status(400).json({
      error: 'isPublic must be a boolean',
      code: 'VALIDATION_ERROR',
    });
  }

  const template = await templateService.toggleTemplateVisibility(
    id,
    user.sub,
    isPublic,
    user.role === 'admin'
  );

  res.json({
    template: template as any,
  });
});

/**
 * Feature template (admin only)
 */
export const featureTemplate = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const { isFeatured } = req.body;
  const user = (req as any).user;

  if (user.role !== 'admin') {
    return res.status(403).json({
      error: 'Admin access required',
      code: 'ADMIN_REQUIRED',
    });
  }

  if (typeof isFeatured !== 'boolean') {
    return res.status(400).json({
      error: 'isFeatured must be a boolean',
      code: 'VALIDATION_ERROR',
    });
  }

  const template = await templateService.featureTemplate(id, isFeatured, user.sub);

  res.json({
    template: template as any,
  });
});

/**
 * Like template
 */
export const likeTemplate = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const user = (req as any).user;

  const template = await templateService.likeTemplate(id, user.sub);

  res.json({
    template: template as any,
  });
});

/**
 * Unlike template
 */
export const unlikeTemplate = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const user = (req as any).user;

  const template = await templateService.unlikeTemplate(id, user.sub);

  res.json({
    template: template as any,
  });
});

/**
 * Download template
 */
export const downloadTemplate = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const user = (req as any).user;

  const template = await templateService.downloadTemplate(id, user?.sub);

  res.json({
    template: template as any,
  });
});

/**
 * Rate template
 */
export const rateTemplate = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const { rating } = req.body;
  const user = (req as any).user;

  if (!rating || rating < 1 || rating > 5) {
    return res.status(400).json({
      error: 'Rating must be between 1 and 5',
      code: 'VALIDATION_ERROR',
    });
  }

  const template = await templateService.rateTemplate(id, user.sub, rating);

  res.json({
    template: template as any,
  });
});

/**
 * Add review to template
 */
export const addReview = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const { rating, review } = req.body;
  const user = (req as any).user;

  if (!rating || rating < 1 || rating > 5) {
    return res.status(400).json({
      error: 'Rating must be between 1 and 5',
      code: 'VALIDATION_ERROR',
    });
  }

  if (!review || review.length < 10) {
    return res.status(400).json({
      error: 'Review must be at least 10 characters',
      code: 'VALIDATION_ERROR',
    });
  }

  const template = await templateService.addReview(id, user.sub, rating, review);

  res.status(201).json({
    template: template as any,
  });
});

/**
 * Get featured templates
 */
export const getFeaturedTemplates = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { limit } = req.query;
  const templates = await templateService.getFeaturedTemplates(parseInt(limit as string) || 10);

  res.json({
    templates: templates.map(t => t as any),
  });
});

/**
 * Get popular templates
 */
export const getPopularTemplates = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { limit } = req.query;
  const templates = await templateService.getPopularTemplates(parseInt(limit as string) || 10);

  res.json({
    templates: templates.map(t => t as any),
  });
});

/**
 * Get recent templates
 */
export const getRecentTemplates = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { limit } = req.query;
  const templates = await templateService.getRecentTemplates(parseInt(limit as string) || 10);

  res.json({
    templates: templates.map(t => t as any),
  });
});

/**
 * Get top rated templates
 */
export const getTopRatedTemplates = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { limit } = req.query;
  const templates = await templateService.getTopRatedTemplates(parseInt(limit as string) || 10);

  res.json({
    templates: templates.map(t => t as any),
  });
});

/**
 * Get templates by category
 */
export const getTemplatesByCategory = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { category } = req.params;
  const { limit } = req.query;

  const templates = await templateService.getTemplatesByCategory(
    category as any,
    parseInt(limit as string) || 20
  );

  res.json({
    templates: templates.map(t => t as any),
  });
});

/**
 * Search templates
 */
export const searchTemplates = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { q } = req.query;
  const { limit } = req.query;

  if (!q || typeof q !== 'string') {
    return res.status(400).json({
      error: 'Search query is required',
      code: 'VALIDATION_ERROR',
    });
  }

  const templates = await templateService.searchTemplates(
    q,
    parseInt(limit as string) || 20
  );

  res.json({
    templates: templates.map(t => t as any),
  });
});

/**
 * Get template stats
 */
export const getTemplateStats = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const user = (req as any).user;

  const template = await templateService.getTemplateById(id, user?.sub);

  const stats = await templateService.getTemplateStats(id);

  res.json({
    stats,
  });
});

/**
 * Get template categories
 */
export const getTemplateCategories = asyncHandler(async (req: Request, res: Response): Promise<void> => {
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
 * Get template difficulties
 */
export const getTemplateDifficulties = asyncHandler(async (req: Request, res: Response): Promise<void> => {
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
  createTemplate,
  getTemplateById,
  getAllTemplates,
  getPublicTemplates,
  getUserTemplates,
  updateTemplate,
  deleteTemplate,
  cloneTemplate,
  forkTemplate,
  toggleTemplateVisibility,
  featureTemplate,
  likeTemplate,
  unlikeTemplate,
  downloadTemplate,
  rateTemplate,
  addReview,
  getFeaturedTemplates,
  getPopularTemplates,
  getRecentTemplates,
  getTopRatedTemplates,
  getTemplatesByCategory,
  searchTemplates,
  getTemplateStats,
  getTemplateCategories,
  getTemplateDifficulties,
};
