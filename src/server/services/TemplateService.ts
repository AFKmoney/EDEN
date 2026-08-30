/**
 * Template Service
 * Business logic for template management
 */

import TemplateModel, { ITemplate, TemplateCategory } from '../models/Template';
import AgentModel from '../models/Agent';
import { IUser } from '../models/User';
import { getRedisClient } from '../config/database';
import { NotFoundError, ValidationError, AuthorizationError, ConflictError } from '../middleware/errorHandler';

// Configuration
const TEMPLATE_CACHE_PREFIX = 'template:';
const TEMPLATE_CACHE_TTL = parseInt(process.env["TEMPLATE_CACHE_TTL"] || '300'); // 5 minutes
const FEATURED_TEMPLATE_LIMIT = parseInt(process.env["FEATURED_TEMPLATE_LIMIT"] || '20');

/**
 * Template service interface
 */
export interface ITemplateService {
  createTemplate(data: { name: string; description: string; nodes: Record<string, any>; connections: any[]; author: string; authorName: string; metadata?: any; content?: any }): Promise<ITemplate>;
  getTemplateById(id: string, user?: string): Promise<ITemplate>;
  getTemplates(query: { page?: number; limit?: number; category?: TemplateCategory; search?: string; tags?: string[]; sort?: string; isPublic?: boolean; author?: string }): Promise<{ templates: ITemplate[]; total: number; page: number; pages: number }>;
  updateTemplate(id: string, author: string, data: Partial<ITemplate>, isAdmin: boolean): Promise<ITemplate>;
  deleteTemplate(id: string, author: string, isAdmin: boolean): Promise<void>;
  cloneTemplate(id: string, author: string, authorName: string): Promise<ITemplate>;
  forkTemplate(id: string, author: string, authorName: string): Promise<ITemplate>;
  toggleTemplateVisibility(id: string, author: string, isPublic: boolean, isAdmin: boolean): Promise<ITemplate>;
  featureTemplate(id: string, isFeatured: boolean, admin: string): Promise<ITemplate>;
  likeTemplate(id: string, user: string): Promise<ITemplate>;
  unlikeTemplate(id: string, user: string): Promise<ITemplate>;
  downloadTemplate(id: string, user?: string): Promise<ITemplate>;
  rateTemplate(id: string, user: string, rating: number): Promise<ITemplate>;
  addReview(id: string, user: string, rating: number, review: string): Promise<ITemplate>;
  getFeaturedTemplates(limit: number): Promise<ITemplate[]>;
  getPopularTemplates(limit: number): Promise<ITemplate[]>;
  getRecentTemplates(limit: number): Promise<ITemplate[]>;
  getTopRatedTemplates(limit: number): Promise<ITemplate[]>;
  getTemplatesByCategory(category: TemplateCategory, limit: number): Promise<ITemplate[]>;
  searchTemplates(query: string, limit: number): Promise<ITemplate[]>;
  getUserTemplates(user: string): Promise<ITemplate[]>;
  getTemplateStats(id: string): Promise<any>;
}

/**
 * Template Service Implementation
 */
export class TemplateService implements ITemplateService {
  /**
   * Create a new template
   */
  async createTemplate(data: { name: string; description: string; nodes: Record<string, any>; connections: any[]; author: string; authorName: string; metadata?: any; content?: any }): Promise<ITemplate> {
    try {
      // Validate nodes
      if (!data.nodes || Object.keys(data.nodes).length === 0) {
        throw new ValidationError('At least one node is required');
      }

      // Check if a template with the same name already exists for this user
      const existingTemplate = await TemplateModel.findOne({
        name: data.name,
        author: data.author,
      });

      if (existingTemplate) {
        throw new ConflictError('A template with this name already exists for this user');
      }

      // Create template
      const template = new TemplateModel({
        name: data.name,
        description: data.description,
        author: data.author,
        authorName: data.authorName,
        nodes: data.nodes,
        connections: data.connections || [],
        metadata: {
          version: '1.0.0',
          category: data.metadata?.category || 'other',
          tags: data.metadata?.tags || [],
          isPublic: data.metadata?.isPublic || false,
          isFeatured: false,
          difficulty: data.metadata?.difficulty || 'beginner',
          estimatedTime: data.metadata?.estimatedTime || 10,
        },
        content: {
          readme: data.content?.readme || '',
          changelog: data.content?.changelog || '',
          usage: data.content?.usage || '',
          dependencies: data.content?.dependencies || [],
          examples: data.content?.examples || [],
        },
      });

      // Save template
      await template.save();

      // Clear cache
      await this.clearTemplateCache(template._id.toString());

      return template;
    } catch (error: any) {
      if (error instanceof ValidationError || error instanceof ConflictError) throw error;
      throw new ValidationError(error.message);
    }
  }

  /**
   * Get template by ID
   */
  async getTemplateById(id: string, user?: string): Promise<ITemplate> {
    try {
      // Try to get from cache first
      const redis = getRedisClient();
      const cachedTemplate = await redis.get(`${TEMPLATE_CACHE_PREFIX}${id}`);
      
      if (cachedTemplate) {
        const template = JSON.parse(cachedTemplate) as ITemplate;
        
        // Check if user has access to private template
        if (!template.metadata.isPublic && template.author.toString() !== user) {
          throw new AuthorizationError('Not authorized to access this template');
        }
        
        return template;
      }

      // Get from database
      const template = await TemplateModel.findById(id);
      if (!template) {
        throw new NotFoundError('Template not found');
      }

      // Check if user has access to private template
      if (!template.metadata.isPublic && template.author.toString() !== user) {
        throw new AuthorizationError('Not authorized to access this template');
      }

      // Cache the template
      await redis.setEx(`${TEMPLATE_CACHE_PREFIX}${id}`, JSON.stringify(template.toJSON()), TEMPLATE_CACHE_TTL);

      return template;
    } catch (error: any) {
      if (error.name === 'CastError') {
        throw new ValidationError('Invalid template ID');
      }
      if (error instanceof AuthorizationError || error instanceof NotFoundError) throw error;
      throw error;
    }
  }

  /**
   * Get templates with pagination and filtering
   */
  async getTemplates(query: { page?: number; limit?: number; category?: TemplateCategory; search?: string; tags?: string[]; sort?: string; isPublic?: boolean; author?: string }): Promise<{ templates: ITemplate[]; total: number; page: number; pages: number }> {
    try {
      const page = query.page || 1;
      const limit = Math.min(query.limit || 20, 100);
      const skip = (page - 1) * limit;

      // Build filter
      const filter: any = { isActive: true };

      // Public templates filter
      if (query.isPublic !== undefined) {
        filter['metadata.isPublic'] = query.isPublic;
      } else if (!query.author) {
        // If no author specified and isPublic not set, only show public templates
        filter['metadata.isPublic'] = true;
      }

      // Author filter
      if (query.author) {
        filter.author = query.author;
      }

      // Category filter
      if (query.category) {
        filter['metadata.category'] = query.category;
      }

      // Search filter
      if (query.search) {
        const searchRegex = new RegExp(query.search, 'i');
        filter.$or = [
          { name: searchRegex },
          { description: searchRegex },
          { 'content.readme': searchRegex },
        ];
      }

      // Tags filter
      if (query.tags && query.tags.length > 0) {
        filter['metadata.tags'] = { $in: query.tags };
      }

      // Build sort
      let sort: any = { createdAt: -1 };
      switch (query.sort) {
        case 'popular':
          sort = { 'stats.downloadCount': -1, 'stats.likeCount': -1 };
          break;
        case 'rating':
          sort = { rating: -1, 'stats.downloadCount': -1 };
          break;
        case 'recent':
          sort = { createdAt: -1 };
          break;
        case 'updated':
          sort = { updatedAt: -1 };
          break;
        case 'views':
          sort = { 'stats.viewCount': -1 };
          break;
      }

      // Get templates
      const [templates, total] = await Promise.all([
        TemplateModel.find(filter)
          .sort(sort)
          .skip(skip)
          .limit(limit),
        TemplateModel.countDocuments(filter),
      ]);

      const pages = Math.ceil(total / limit);

      return {
        templates,
        total,
        page,
        pages,
      };
    } catch (error: any) {
      throw new ValidationError(error.message);
    }
  }

  /**
   * Update template
   */
  async updateTemplate(id: string, author: string, data: Partial<ITemplate>, isAdmin: boolean): Promise<ITemplate> {
    try {
      // Get template and check ownership or admin
      const template = await TemplateModel.findById(id);
      if (!template) {
        throw new NotFoundError('Template not found');
      }

      if (template.author.toString() !== author && !isAdmin) {
        throw new AuthorizationError('Not authorized to update this template');
      }

      // Prevent updating certain fields
      const safeData = { ...data };
      delete (safeData as any).author;
      delete (safeData as any).authorName;
      delete (safeData as any).createdAt;

      // If not admin, prevent changing approval status
      if (!isAdmin) {
        delete (safeData as any).isApproved;
        delete (safeData as any).approvedBy;
        delete (safeData as any).approvedAt;
        delete (safeData as any).rejectionReason;
      }

      // Update template
      const updatedTemplate = await TemplateModel.findByIdAndUpdate(
        id,
        { $set: safeData },
        { new: true, runValidators: true }
      );

      if (!updatedTemplate) {
        throw new NotFoundError('Template not found');
      }

      // Clear cache
      await this.clearTemplateCache(id);

      return updatedTemplate;
    } catch (error: any) {
      if (error.name === 'CastError') {
        throw new ValidationError('Invalid template ID');
      }
      if (error instanceof AuthorizationError || error instanceof NotFoundError) throw error;
      throw new ValidationError(error.message);
    }
  }

  /**
   * Delete template
   */
  async deleteTemplate(id: string, author: string, isAdmin: boolean): Promise<void> {
    try {
      // Get template and check ownership or admin
      const template = await TemplateModel.findById(id);
      if (!template) {
        throw new NotFoundError('Template not found');
      }

      if (template.author.toString() !== author && !isAdmin) {
        throw new AuthorizationError('Not authorized to delete (this as any) template');
      }

      // Soft delete
      template.isActive = false;
      await template.save();

      // Clear cache
      await this.clearTemplateCache(id);
    } catch (error: any) {
      if (error.name === 'CastError') {
        throw new ValidationError('Invalid template ID');
      }
      if (error instanceof AuthorizationError || error instanceof NotFoundError) throw error;
      throw new ValidationError(error.message);
    }
  }

  /**
   * Clone template (create a copy for the same user)
   */
  async cloneTemplate(id: string, author: string, authorName: string): Promise<ITemplate> {
    try {
      // Get original template
      const template = await TemplateModel.findById(id);
      if (!template) {
        throw new NotFoundError('Template not found');
      }

      // Check ownership
      if (template.author.toString() !== author) {
        throw new AuthorizationError('Not authorized to clone this template');
      }

      // Create a copy
      const clonedData = template.toObject();
      delete (clonedData as any)._id;
      delete (clonedData as any).createdAt;
      delete (clonedData as any).updatedAt;
      delete (clonedData as any).stats;
      delete (clonedData as any).isApproved;
      delete (clonedData as any).approvedBy;
      delete (clonedData as any).approvedAt;
      delete (clonedData as any).rejectionReason;

      // Update clone-specific fields
      clonedData.name = `${clonedData.name} (Copy)`;
      clonedData.author = new mongoose.Types.ObjectId(author);
      clonedData.authorName = authorName;
      clonedData.metadata.isPublic = false;
      clonedData.metadata.isFeatured = false;

      // Create new template
      const clonedTemplate = new TemplateModel(clonedData);
      await clonedTemplate.save();

      return clonedTemplate;
    } catch (error: any) {
      if (error.name === 'CastError') {
        throw new ValidationError('Invalid template ID');
      }
      if (error instanceof AuthorizationError || error instanceof NotFoundError) throw error;
      throw new ValidationError(error.message);
    }
  }

  /**
   * Fork template (create a copy for a different user)
   */
  async forkTemplate(id: string, author: string, authorName: string): Promise<ITemplate> {
    try {
      // Get original template
      const template = await TemplateModel.findById(id);
      if (!template) {
        throw new NotFoundError('Template not found');
      }

      // Check if template is public or user has access
      if (!template.metadata.isPublic && template.author.toString() !== author) {
        throw new AuthorizationError('Not authorized to fork this template');
      }

      // Fork the template
      const forkedTemplate = await template.fork(
        new mongoose.Types.ObjectId(author),
        authorName
      );

      // Increment fork count on original
      template.stats.forkCount += 1;
      template.markModified('stats');
      await template.save();

      // Clear cache for both templates
      await this.clearTemplateCache(id);
      await this.clearTemplateCache(forkedTemplate._id.toString());

      return forkedTemplate;
    } catch (error: any) {
      if (error.name === 'CastError') {
        throw new ValidationError('Invalid template ID');
      }
      if (error instanceof AuthorizationError || error instanceof NotFoundError) throw error;
      throw new ValidationError(error.message);
    }
  }

  /**
   * Toggle template visibility
   */
  async toggleTemplateVisibility(id: string, author: string, isPublic: boolean, isAdmin: boolean): Promise<ITemplate> {
    try {
      // Get template and check ownership or admin
      const template = await TemplateModel.findById(id);
      if (!template) {
        throw new NotFoundError('Template not found');
      }

      if (template.author.toString() !== author && !isAdmin) {
        throw new AuthorizationError('Not authorized to update this template');
      }

      // Update visibility
      (template.metadata as any).isPublic = isPublic;
      
      // If making public and not admin, set as pending approval
      if (isPublic && !isAdmin) {
        template.isApproved = false;
      }

      await template.save();

      // Clear cache
      await this.clearTemplateCache(id);

      return template;
    } catch (error: any) {
      if (error.name === 'CastError') {
        throw new ValidationError('Invalid template ID');
      }
      if (error instanceof AuthorizationError || error instanceof NotFoundError) throw error;
      throw new ValidationError(error.message);
    }
  }

  /**
   * Feature/unfeature template
   */
  async featureTemplate(id: string, isFeatured: boolean, admin: string): Promise<ITemplate> {
    try {
      // Get template
      const template = await TemplateModel.findById(id);
      if (!template) {
        throw new NotFoundError('Template not found');
      }

      // Check if template is public
      if (!template.metadata.isPublic) {
        throw new ValidationError('Cannot feature a private template');
      }

      // Check if template is approved
      if (!template.isApproved) {
        throw new ValidationError('Cannot feature an unapproved template');
      }

      // Update featured status
      (template.metadata as any).isFeatured = isFeatured;
      template.approvedBy = new mongoose.Types.ObjectId(admin);
      template.approvedAt = new Date();
      await template.save();

      // Enforce featured template limit
      if (isFeatured) {
        const featuredCount = await TemplateModel.countDocuments({
          'metadata.isFeatured': true,
        });

        if (featuredCount > FEATURED_TEMPLATE_LIMIT) {
          // Remove featured status from oldest featured template
          const oldestFeatured = await TemplateModel.findOne({
            'metadata.isFeatured': true,
          }).sort({ approvedAt: 1 });

          if (oldestFeatured) {
            (oldestFeatured.metadata as any).isFeatured = false;
            await oldestFeatured.save();
            await this.clearTemplateCache(oldestFeatured._id.toString());
          }
        }
      }

      // Clear cache
      await this.clearTemplateCache(id);

      return template;
    } catch (error: any) {
      if (error.name === 'CastError') {
        throw new ValidationError('Invalid template ID');
      }
      if (error instanceof NotFoundError || error instanceof ValidationError) throw error;
      throw new ValidationError(error.message);
    }
  }

  /**
   * Like template
   */
  async likeTemplate(id: string, user: string): Promise<ITemplate> {
    try {
      // Get template
      const template = await TemplateModel.findById(id);
      if (!template) {
        throw new NotFoundError('Template not found');
      }

      // Check if user already liked this template
      const redis = getRedisClient();
      const likeKey = `template:like:${id}:${user}`;
      const alreadyLiked = await redis.get(likeKey);

      if (alreadyLiked) {
        throw new ConflictError('You have already liked this template');
      }

      // Mark as liked and increment like count
      await redis.setEx(likeKey, '1', 24 * 60 * 60 * 1000); // 24 hours
      await template.incrementLike();

      // Clear cache
      await this.clearTemplateCache(id);

      return template;
    } catch (error: any) {
      if (error.name === 'CastError') {
        throw new ValidationError('Invalid template ID');
      }
      if (error instanceof NotFoundError || error instanceof ConflictError) throw error;
      throw new ValidationError(error.message);
    }
  }

  /**
   * Unlike template
   */
  async unlikeTemplate(id: string, user: string): Promise<ITemplate> {
    try {
      // Get template
      const template = await TemplateModel.findById(id);
      if (!template) {
        throw new NotFoundError('Template not found');
      }

      // Check if user liked this template
      const redis = getRedisClient();
      const likeKey = `template:like:${id}:${user}`;
      const alreadyLiked = await redis.get(likeKey);

      if (!alreadyLiked) {
        throw new ConflictError('You have not liked this template');
      }

      // Remove like and decrement like count
      await redis.del(likeKey);
      template.stats.likeCount -= 1;
      template.markModified('stats');
      await template.save();

      // Clear cache
      await this.clearTemplateCache(id);

      return template;
    } catch (error: any) {
      if (error.name === 'CastError') {
        throw new ValidationError('Invalid template ID');
      }
      if (error instanceof NotFoundError || error instanceof ConflictError) throw error;
      throw new ValidationError(error.message);
    }
  }

  /**
   * Download template
   */
  async downloadTemplate(id: string, user?: string): Promise<ITemplate> {
    try {
      // Get template
      const template = await TemplateModel.findById(id);
      if (!template) {
        throw new NotFoundError('Template not found');
      }

      // Increment download count
      await template.incrementDownload();

      // Track download per user (optional)
      if (user) {
        const redis = getRedisClient();
        const downloadKey = `template:download:${id}:${user}`;
        await redis.incr(downloadKey);
        await redis.expire(downloadKey, 24 * 60 * 60); // 24 hours
      }

      // Clear cache
      await this.clearTemplateCache(id);

      return template;
    } catch (error: any) {
      if (error.name === 'CastError') {
        throw new ValidationError('Invalid template ID');
      }
      if (error instanceof NotFoundError) throw error;
      throw new ValidationError(error.message);
    }
  }

  /**
   * Rate template
   */
  async rateTemplate(id: string, user: string, rating: number): Promise<ITemplate> {
    try {
      if (rating < 1 || rating > 5) {
        throw new ValidationError('Rating must be between 1 and 5');
      }

      // Get template
      const template = await TemplateModel.findById(id);
      if (!template) {
        throw new NotFoundError('Template not found');
      }

      // Check if user already rated this template
      const redis = getRedisClient();
      const ratingKey = `template:rating:${id}:${user}`;
      const alreadyRated = await redis.get(ratingKey);

      if (alreadyRated) {
        throw new ConflictError('You have already rated this template');
      }

      // Add rating
      await template.addReview(rating, '');
      await redis.setEx(ratingKey, rating.toString(), 24 * 60 * 60 * 1000); // 24 hours

      // Clear cache
      await this.clearTemplateCache(id);

      return template;
    } catch (error: any) {
      if (error.name === 'CastError') {
        throw new ValidationError('Invalid template ID');
      }
      if (error instanceof NotFoundError || error instanceof ConflictError || error instanceof ValidationError) throw error;
      throw new ValidationError(error.message);
    }
  }

  /**
   * Add review with rating and text
   */
  async addReview(id: string, user: string, rating: number, review: string): Promise<ITemplate> {
    try {
      if (rating < 1 || rating > 5) {
        throw new ValidationError('Rating must be between 1 and 5');
      }

      // Get template
      const template = await TemplateModel.findById(id);
      if (!template) {
        throw new NotFoundError('Template not found');
      }

      // Check if user already reviewed this template
      const redis = getRedisClient();
      const reviewKey = `template:review:${id}:${user}`;
      const alreadyReviewed = await redis.get(reviewKey);

      if (alreadyReviewed) {
        throw new ConflictError('You have already reviewed this template');
      }

      // Add review
      await template.addReview(rating, review);
      await redis.setEx(reviewKey, '1', 24 * 60 * 60 * 1000); // 24 hours

      // Clear cache
      await this.clearTemplateCache(id);

      return template;
    } catch (error: any) {
      if (error.name === 'CastError') {
        throw new ValidationError('Invalid template ID');
      }
      if (error instanceof NotFoundError || error instanceof ConflictError || error instanceof ValidationError) throw error;
      throw new ValidationError(error.message);
    }
  }

  /**
   * Get featured templates
   */
  async getFeaturedTemplates(limit: number = 10): Promise<ITemplate[]> {
    try {
      return await TemplateModel.find({
        'metadata.isFeatured': true,
        'metadata.isPublic': true,
        isActive: true,
      })
        .sort({ 'stats.downloadCount': -1, 'stats.likeCount': -1, rating: -1 })
        .limit(limit);
    } catch (error: any) {
      throw new ValidationError(error.message);
    }
  }

  /**
   * Get popular templates
   */
  async getPopularTemplates(limit: number = 10): Promise<ITemplate[]> {
    try {
      return await TemplateModel.find({
        'metadata.isPublic': true,
        isActive: true,
      })
        .sort({ 'stats.downloadCount': -1, 'stats.likeCount': -1, rating: -1 })
        .limit(limit);
    } catch (error: any) {
      throw new ValidationError(error.message);
    }
  }

  /**
   * Get recent templates
   */
  async getRecentTemplates(limit: number = 10): Promise<ITemplate[]> {
    try {
      return await TemplateModel.find({
        'metadata.isPublic': true,
        isActive: true,
      })
        .sort({ createdAt: -1 })
        .limit(limit);
    } catch (error: any) {
      throw new ValidationError(error.message);
    }
  }

  /**
   * Get top rated templates
   */
  async getTopRatedTemplates(limit: number = 10): Promise<ITemplate[]> {
    try {
      return await TemplateModel.find({
        'metadata.isPublic': true,
        isActive: true,
        'stats.ratingCount': { $gt: 0 },
      })
        .sort({ rating: -1, 'stats.ratingCount': -1 })
        .limit(limit);
    } catch (error: any) {
      throw new ValidationError(error.message);
    }
  }

  /**
   * Get templates by category
   */
  async getTemplatesByCategory(category: TemplateCategory, limit: number = 20): Promise<ITemplate[]> {
    try {
      return await TemplateModel.find({
        'metadata.category': category,
        'metadata.isPublic': true,
        isActive: true,
      })
        .sort({ 'stats.downloadCount': -1, 'stats.likeCount': -1 })
        .limit(limit);
    } catch (error: any) {
      throw new ValidationError(error.message);
    }
  }

  /**
   * Search templates
   */
  async searchTemplates(query: string, limit: number = 20): Promise<ITemplate[]> {
    try {
      const searchRegex = new RegExp(query, 'i');

      return await TemplateModel.find({
        'metadata.isPublic': true,
        isActive: true,
        $or: [
          { name: searchRegex },
          { description: searchRegex },
          { 'content.readme': searchRegex },
          { 'metadata.tags': searchRegex },
        ],
      })
        .sort({ 'stats.downloadCount': -1, 'stats.likeCount': -1, rating: -1 })
        .limit(limit);
    } catch (error: any) {
      throw new ValidationError(error.message);
    }
  }

  /**
   * Get user's templates
   */
  async getUserTemplates(user: string): Promise<ITemplate[]> {
    try {
      return await TemplateModel.find({
        author: user,
      })
        .sort({ updatedAt: -1 });
    } catch (error: any) {
      throw new ValidationError(error.message);
    }
  }

  /**
   * Get template stats
   */
  async getTemplateStats(id: string): Promise<any> {
    try {
      const template = await TemplateModel.findById(id);
      if (!template) {
        throw new NotFoundError('Template not found');
      }

      return {
        id: template._id.toString(),
        name: template.name,
        downloadCount: template.stats.downloadCount,
        likeCount: template.stats.likeCount,
        viewCount: template.stats.viewCount,
        rating: template.getRating(),
        ratingCount: template.stats.ratingCount,
        reviewCount: template.stats.reviewCount,
        forkCount: template.stats.forkCount,
        createdAt: template.createdAt,
        updatedAt: template.updatedAt,
      };
    } catch (error: any) {
      if (error.name === 'CastError') {
        throw new ValidationError('Invalid template ID');
      }
      throw error;
    }
  }

  /**
   * Clear template cache
   */
  private async clearTemplateCache(id: string): Promise<void> {
    try {
      const redis = getRedisClient();
      await redis.del(`${TEMPLATE_CACHE_PREFIX}${id}`);
    } catch {
      // Redis not available
    }
  }
}

// Singleton instance
import mongoose from 'mongoose';
export const templateService = new TemplateService();
export default templateService;
