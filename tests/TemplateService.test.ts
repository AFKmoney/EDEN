/**
 * Template Service Tests
 * Unit tests for TemplateService
 */

import { templateService } from '../src/server/services/TemplateService';
import TemplateModel from '../src/server/models/Template';
import UserModel from '../src/server/models/User';
import { connectMongoDB, disconnectMongoDB } from '../src/server/config/database';
import { NotFoundError, ValidationError, AuthorizationError, ConflictError } from '../src/server/middleware/errorHandler';

// Setup MongoDB for testing
beforeAll(async () => {
  try {
    await connectMongoDB();
  } catch (error) {
    console.warn('Could not connect to MongoDB for tests');
  }
});

afterAll(async () => {
  await disconnectMongoDB();
});

afterEach(async () => {
  // Clear all data after each test
  await TemplateModel.deleteMany({});
  await UserModel.deleteMany({});
});

describe('TemplateService', () => {
  let userId: string;
  let userName: string;

  beforeEach(async () => {
    // Create a test user
    const user = new UserModel({
      email: 'test@example.com',
      password: 'password123',
      name: 'Test User',
    });
    await user.save();
    userId = user._id.toString();
    userName = user.name;
  });

  describe('createTemplate', () => {
    it('should create a new template', async () => {
      const nodes = {
        node1: {
          id: 'node1',
          type: 'Data' as const,
          position: { x: 100, y: 100 },
          metadata: { title: 'Test Node', content: 'Test content' },
          ternaryState: 'UNKNOWN' as const,
          inputs: [],
          outputs: [],
        },
      };

      const template = await templateService.createTemplate({
        name: 'Test Template',
        description: 'A test template',
        nodes,
        connections: [],
        author: userId,
        authorName: userName,
        metadata: { category: 'other', tags: ['test'] },
        content: { readme: 'Test readme' },
      });

      expect(template).toBeDefined();
      expect(template.name).toBe('Test Template');
      expect(template.author.toString()).toBe(userId);
      expect(template.authorName).toBe(userName);
      expect(template.nodes).toBeDefined();
      expect(template.isActive).toBe(true);
    });

    it('should throw ValidationError if nodes are missing', async () => {
      await expect(templateService.createTemplate({
        name: 'Test Template',
        description: 'A test template',
        nodes: {} as any,
        connections: [],
        author: userId,
        authorName: userName,
      }))
        .rejects
        .toThrow(ValidationError);
    });

    it('should throw ConflictError if template with same name exists for user', async () => {
      const nodes = {
        node1: {
          id: 'node1',
          type: 'Data' as const,
          position: { x: 100, y: 100 },
          metadata: { title: 'Test Node' },
          ternaryState: 'UNKNOWN' as const,
          inputs: [],
          outputs: [],
        },
      };

      await templateService.createTemplate({
        name: 'Test Template',
        description: 'A test template',
        nodes,
        connections: [],
        author: userId,
        authorName: userName,
      });

      await expect(templateService.createTemplate({
        name: 'Test Template',
        description: 'Another test template',
        nodes,
        connections: [],
        author: userId,
        authorName: userName,
      }))
        .rejects
        .toThrow(ConflictError);
    });
  });

  describe('getTemplateById', () => {
    it('should get a template by ID', async () => {
      const nodes = {
        node1: {
          id: 'node1',
          type: 'Data' as const,
          position: { x: 100, y: 100 },
          metadata: { title: 'Test Node' },
          ternaryState: 'UNKNOWN' as const,
          inputs: [],
          outputs: [],
        },
      };

      const createdTemplate = await templateService.createTemplate({
        name: 'Test Template',
        description: 'A test template',
        nodes,
        connections: [],
        author: userId,
        authorName: userName,
        metadata: { isPublic: true },
      });

      const template = await templateService.getTemplateById(createdTemplate._id.toString(), userId);

      expect(template).toBeDefined();
      expect(template._id.toString()).toBe(createdTemplate._id.toString());
    });

    it('should throw NotFoundError if template does not exist', async () => {
      const nonExistentId = '507f1f77bcf86cd799439011';

      await expect(templateService.getTemplateById(nonExistentId, userId))
        .rejects
        .toThrow(NotFoundError);
    });

    it('should throw AuthorizationError if user does not have access to private template', async () => {
      const nodes = {
        node1: {
          id: 'node1',
          type: 'Data' as const,
          position: { x: 100, y: 100 },
          metadata: { title: 'Test Node' },
          ternaryState: 'UNKNOWN' as const,
          inputs: [],
          outputs: [],
        },
      };

      const createdTemplate = await templateService.createTemplate({
        name: 'Test Template',
        description: 'A test template',
        nodes,
        connections: [],
        author: userId,
        authorName: userName,
        metadata: { isPublic: false },
      });

      const otherUserId = '507f1f77bcf86cd799439012';

      await expect(templateService.getTemplateById(createdTemplate._id.toString(), otherUserId))
        .rejects
        .toThrow(AuthorizationError);
    });
  });

  describe('getTemplates', () => {
    it('should get all public templates', async () => {
      const nodes = {
        node1: {
          id: 'node1',
          type: 'Data' as const,
          position: { x: 100, y: 100 },
          metadata: { title: 'Test Node' },
          ternaryState: 'UNKNOWN' as const,
          inputs: [],
          outputs: [],
        },
      };

      // Create multiple public templates
      for (let i = 0; i < 5; i++) {
        await templateService.createTemplate({
          name: `Template ${i}`,
          description: `Description ${i}`,
          nodes,
          connections: [],
          author: userId,
          authorName: userName,
          metadata: { isPublic: true },
        });
      }

      const result = await templateService.getTemplates({ isPublic: true });

      expect(result).toBeDefined();
      expect(result.templates.length).toBe(5);
      expect(result.total).toBe(5);
    });

    it('should get templates by author', async () => {
      const nodes = {
        node1: {
          id: 'node1',
          type: 'Data' as const,
          position: { x: 100, y: 100 },
          metadata: { title: 'Test Node' },
          ternaryState: 'UNKNOWN' as const,
          inputs: [],
          outputs: [],
        },
      };

      // Create templates for different users
      await templateService.createTemplate({
        name: 'User 1 Template',
        description: 'Template for user 1',
        nodes,
        connections: [],
        author: userId,
        authorName: userName,
        metadata: { isPublic: true },
      });

      const otherUser = new UserModel({
        email: 'other@example.com',
        password: 'password123',
        name: 'Other User',
      });
      await otherUser.save();

      await templateService.createTemplate({
        name: 'User 2 Template',
        description: 'Template for user 2',
        nodes,
        connections: [],
        author: otherUser._id.toString(),
        authorName: otherUser.name,
        metadata: { isPublic: true },
      });

      const result = await templateService.getTemplates({ author: userId });

      expect(result.templates.length).toBe(1);
      expect(result.templates[0].author.toString()).toBe(userId);
    });

    it('should paginate results', async () => {
      const nodes = {
        node1: {
          id: 'node1',
          type: 'Data' as const,
          position: { x: 100, y: 100 },
          metadata: { title: 'Test Node' },
          ternaryState: 'UNKNOWN' as const,
          inputs: [],
          outputs: [],
        },
      };

      // Create 15 templates
      for (let i = 0; i < 15; i++) {
        await templateService.createTemplate({
          name: `Template ${i}`,
          description: `Description ${i}`,
          nodes,
          connections: [],
          author: userId,
          authorName: userName,
          metadata: { isPublic: true },
        });
      }

      const result = await templateService.getTemplates({ page: 1, limit: 10, isPublic: true });

      expect(result.templates.length).toBe(10);
      expect(result.total).toBe(15);
      expect(result.page).toBe(1);
      expect(result.pages).toBe(2);
    });
  });

  describe('updateTemplate', () => {
    it('should update a template', async () => {
      const nodes = {
        node1: {
          id: 'node1',
          type: 'Data' as const,
          position: { x: 100, y: 100 },
          metadata: { title: 'Test Node' },
          ternaryState: 'UNKNOWN' as const,
          inputs: [],
          outputs: [],
        },
      };

      const createdTemplate = await templateService.createTemplate({
        name: 'Test Template',
        description: 'A test template',
        nodes,
        connections: [],
        author: userId,
        authorName: userName,
      });

      const updatedTemplate = await templateService.updateTemplate(
        createdTemplate._id.toString(),
        userId,
        { name: 'Updated Template', description: 'Updated description' },
        false
      );

      expect(updatedTemplate).toBeDefined();
      expect(updatedTemplate.name).toBe('Updated Template');
      expect(updatedTemplate.description).toBe('Updated description');
    });

    it('should throw NotFoundError if template does not exist', async () => {
      const nonExistentId = '507f1f77bcf86cd799439011';

      await expect(templateService.updateTemplate(nonExistentId, userId, { name: 'New Name' }, false))
        .rejects
        .toThrow(NotFoundError);
    });

    it('should throw AuthorizationError if user is not the author', async () => {
      const nodes = {
        node1: {
          id: 'node1',
          type: 'Data' as const,
          position: { x: 100, y: 100 },
          metadata: { title: 'Test Node' },
          ternaryState: 'UNKNOWN' as const,
          inputs: [],
          outputs: [],
        },
      };

      const createdTemplate = await templateService.createTemplate({
        name: 'Test Template',
        description: 'A test template',
        nodes,
        connections: [],
        author: userId,
        authorName: userName,
      });

      const otherUserId = '507f1f77bcf86cd799439012';

      await expect(templateService.updateTemplate(createdTemplate._id.toString(), otherUserId, { name: 'New Name' }, false))
        .rejects
        .toThrow(AuthorizationError);
    });

    it('should allow admin to update any template', async () => {
      const nodes = {
        node1: {
          id: 'node1',
          type: 'Data' as const,
          position: { x: 100, y: 100 },
          metadata: { title: 'Test Node' },
          ternaryState: 'UNKNOWN' as const,
          inputs: [],
          outputs: [],
        },
      };

      const createdTemplate = await templateService.createTemplate({
        name: 'Test Template',
        description: 'A test template',
        nodes,
        connections: [],
        author: userId,
        authorName: userName,
      });

      const otherUserId = '507f1f77bcf86cd799439012';

      await expect(templateService.updateTemplate(createdTemplate._id.toString(), otherUserId, { name: 'New Name' }, true))
        .resolves
        .not.toThrow();
    });
  });

  describe('deleteTemplate', () => {
    it('should delete a template', async () => {
      const nodes = {
        node1: {
          id: 'node1',
          type: 'Data' as const,
          position: { x: 100, y: 100 },
          metadata: { title: 'Test Node' },
          ternaryState: 'UNKNOWN' as const,
          inputs: [],
          outputs: [],
        },
      };

      const createdTemplate = await templateService.createTemplate({
        name: 'Test Template',
        description: 'A test template',
        nodes,
        connections: [],
        author: userId,
        authorName: userName,
      });

      await templateService.deleteTemplate(createdTemplate._id.toString(), userId, false);

      const deletedTemplate = await TemplateModel.findById(createdTemplate._id);
      expect(deletedTemplate?.isActive).toBe(false);
    });

    it('should throw NotFoundError if template does not exist', async () => {
      const nonExistentId = '507f1f77bcf86cd799439011';

      await expect(templateService.deleteTemplate(nonExistentId, userId, false))
        .rejects
        .toThrow(NotFoundError);
    });

    it('should throw AuthorizationError if user is not the author and not admin', async () => {
      const nodes = {
        node1: {
          id: 'node1',
          type: 'Data' as const,
          position: { x: 100, y: 100 },
          metadata: { title: 'Test Node' },
          ternaryState: 'UNKNOWN' as const,
          inputs: [],
          outputs: [],
        },
      };

      const createdTemplate = await templateService.createTemplate({
        name: 'Test Template',
        description: 'A test template',
        nodes,
        connections: [],
        author: userId,
        authorName: userName,
      });

      const otherUserId = '507f1f77bcf86cd799439012';

      await expect(templateService.deleteTemplate(createdTemplate._id.toString(), otherUserId, false))
        .rejects
        .toThrow(AuthorizationError);
    });
  });

  describe('forkTemplate', () => {
    it('should fork a template', async () => {
      const nodes = {
        node1: {
          id: 'node1',
          type: 'Data' as const,
          position: { x: 100, y: 100 },
          metadata: { title: 'Test Node' },
          ternaryState: 'UNKNOWN' as const,
          inputs: [],
          outputs: [],
        },
      };

      const createdTemplate = await templateService.createTemplate({
        name: 'Test Template',
        description: 'A test template',
        nodes,
        connections: [],
        author: userId,
        authorName: userName,
        metadata: { isPublic: true },
      });

      const forkedTemplate = await templateService.forkTemplate(
        createdTemplate._id.toString(),
        userId,
        userName
      );

      expect(forkedTemplate).toBeDefined();
      expect(forkedTemplate.name).toContain('(Fork)');
      expect(forkedTemplate.author.toString()).toBe(userId);
      expect(forkedTemplate.authorName).toBe(userName);
      expect(forkedTemplate._id.toString()).not.toBe(createdTemplate._id.toString());
    });

    it('should throw AuthorizationError if user does not have access to private template', async () => {
      const nodes = {
        node1: {
          id: 'node1',
          type: 'Data' as const,
          position: { x: 100, y: 100 },
          metadata: { title: 'Test Node' },
          ternaryState: 'UNKNOWN' as const,
          inputs: [],
          outputs: [],
        },
      };

      const createdTemplate = await templateService.createTemplate({
        name: 'Test Template',
        description: 'A test template',
        nodes,
        connections: [],
        author: userId,
        authorName: userName,
        metadata: { isPublic: false },
      });

      const otherUserId = '507f1f77bcf86cd799439012';

      await expect(templateService.forkTemplate(createdTemplate._id.toString(), otherUserId, 'Other User'))
        .rejects
        .toThrow(AuthorizationError);
    });

    it('should increment fork count on original template', async () => {
      const nodes = {
        node1: {
          id: 'node1',
          type: 'Data' as const,
          position: { x: 100, y: 100 },
          metadata: { title: 'Test Node' },
          ternaryState: 'UNKNOWN' as const,
          inputs: [],
          outputs: [],
        },
      };

      const createdTemplate = await templateService.createTemplate({
        name: 'Test Template',
        description: 'A test template',
        nodes,
        connections: [],
        author: userId,
        authorName: userName,
        metadata: { isPublic: true },
      });

      await templateService.forkTemplate(createdTemplate._id.toString(), userId, userName);

      const originalTemplate = await TemplateModel.findById(createdTemplate._id);
      expect(originalTemplate?.stats.forkCount).toBe(1);
    });
  });

  describe('likeTemplate', () => {
    it('should like a template', async () => {
      const nodes = {
        node1: {
          id: 'node1',
          type: 'Data' as const,
          position: { x: 100, y: 100 },
          metadata: { title: 'Test Node' },
          ternaryState: 'UNKNOWN' as const,
          inputs: [],
          outputs: [],
        },
      };

      const createdTemplate = await templateService.createTemplate({
        name: 'Test Template',
        description: 'A test template',
        nodes,
        connections: [],
        author: userId,
        authorName: userName,
        metadata: { isPublic: true },
      });

      const likedTemplate = await templateService.likeTemplate(createdTemplate._id.toString(), userId);

      expect(likedTemplate.stats.likeCount).toBe(1);
    });

    it('should throw ConflictError if user already liked the template', async () => {
      const nodes = {
        node1: {
          id: 'node1',
          type: 'Data' as const,
          position: { x: 100, y: 100 },
          metadata: { title: 'Test Node' },
          ternaryState: 'UNKNOWN' as const,
          inputs: [],
          outputs: [],
        },
      };

      const createdTemplate = await templateService.createTemplate({
        name: 'Test Template',
        description: 'A test template',
        nodes,
        connections: [],
        author: userId,
        authorName: userName,
        metadata: { isPublic: true },
      });

      await templateService.likeTemplate(createdTemplate._id.toString(), userId);

      await expect(templateService.likeTemplate(createdTemplate._id.toString(), userId))
        .rejects
        .toThrow(ConflictError);
    });
  });

  describe('downloadTemplate', () => {
    it('should increment download count', async () => {
      const nodes = {
        node1: {
          id: 'node1',
          type: 'Data' as const,
          position: { x: 100, y: 100 },
          metadata: { title: 'Test Node' },
          ternaryState: 'UNKNOWN' as const,
          inputs: [],
          outputs: [],
        },
      };

      const createdTemplate = await templateService.createTemplate({
        name: 'Test Template',
        description: 'A test template',
        nodes,
        connections: [],
        author: userId,
        authorName: userName,
        metadata: { isPublic: true },
      });

      const downloadedTemplate = await templateService.downloadTemplate(createdTemplate._id.toString(), userId);

      expect(downloadedTemplate.stats.downloadCount).toBe(1);
    });
  });

  describe('rateTemplate', () => {
    it('should rate a template', async () => {
      const nodes = {
        node1: {
          id: 'node1',
          type: 'Data' as const,
          position: { x: 100, y: 100 },
          metadata: { title: 'Test Node' },
          ternaryState: 'UNKNOWN' as const,
          inputs: [],
          outputs: [],
        },
      };

      const createdTemplate = await templateService.createTemplate({
        name: 'Test Template',
        description: 'A test template',
        nodes,
        connections: [],
        author: userId,
        authorName: userName,
        metadata: { isPublic: true },
      });

      const ratedTemplate = await templateService.rateTemplate(createdTemplate._id.toString(), userId, 5);

      expect(ratedTemplate.stats.ratingCount).toBe(1);
      expect(ratedTemplate.stats.ratingTotal).toBe(5);
    });

    it('should throw ValidationError if rating is out of range', async () => {
      const nodes = {
        node1: {
          id: 'node1',
          type: 'Data' as const,
          position: { x: 100, y: 100 },
          metadata: { title: 'Test Node' },
          ternaryState: 'UNKNOWN' as const,
          inputs: [],
          outputs: [],
        },
      };

      const createdTemplate = await templateService.createTemplate({
        name: 'Test Template',
        description: 'A test template',
        nodes,
        connections: [],
        author: userId,
        authorName: userName,
        metadata: { isPublic: true },
      });

      await expect(templateService.rateTemplate(createdTemplate._id.toString(), userId, 6))
        .rejects
        .toThrow(ValidationError);
    });

    it('should throw ConflictError if user already rated the template', async () => {
      const nodes = {
        node1: {
          id: 'node1',
          type: 'Data' as const,
          position: { x: 100, y: 100 },
          metadata: { title: 'Test Node' },
          ternaryState: 'UNKNOWN' as const,
          inputs: [],
          outputs: [],
        },
      };

      const createdTemplate = await templateService.createTemplate({
        name: 'Test Template',
        description: 'A test template',
        nodes,
        connections: [],
        author: userId,
        authorName: userName,
        metadata: { isPublic: true },
      });

      await templateService.rateTemplate(createdTemplate._id.toString(), userId, 5);

      await expect(templateService.rateTemplate(createdTemplate._id.toString(), userId, 4))
        .rejects
        .toThrow(ConflictError);
    });
  });

  describe('getFeaturedTemplates', () => {
    it('should get featured templates', async () => {
      const nodes = {
        node1: {
          id: 'node1',
          type: 'Data' as const,
          position: { x: 100, y: 100 },
          metadata: { title: 'Test Node' },
          ternaryState: 'UNKNOWN' as const,
          inputs: [],
          outputs: [],
        },
      };

      // Create featured template
      const featuredTemplate = await templateService.createTemplate({
        name: 'Featured Template',
        description: 'A featured template',
        nodes,
        connections: [],
        author: userId,
        authorName: userName,
        metadata: { isPublic: true, isFeatured: true },
      });

      // Create non-featured template
      await templateService.createTemplate({
        name: 'Regular Template',
        description: 'A regular template',
        nodes,
        connections: [],
        author: userId,
        authorName: userName,
        metadata: { isPublic: true, isFeatured: false },
      });

      const templates = await templateService.getFeaturedTemplates(10);

      expect(templates.length).toBe(1);
      expect(templates[0]._id.toString()).toBe(featuredTemplate._id.toString());
    });
  });

  describe('searchTemplates', () => {
    it('should search templates by name', async () => {
      const nodes = {
        node1: {
          id: 'node1',
          type: 'Data' as const,
          position: { x: 100, y: 100 },
          metadata: { title: 'Test Node' },
          ternaryState: 'UNKNOWN' as const,
          inputs: [],
          outputs: [],
        },
      };

      await templateService.createTemplate({
        name: 'Searchable Template',
        description: 'A searchable template',
        nodes,
        connections: [],
        author: userId,
        authorName: userName,
        metadata: { isPublic: true },
      });

      await templateService.createTemplate({
        name: 'Other Template',
        description: 'Another template',
        nodes,
        connections: [],
        author: userId,
        authorName: userName,
        metadata: { isPublic: true },
      });

      const templates = await templateService.searchTemplates('searchable', 10);

      expect(templates.length).toBe(1);
      expect(templates[0].name).toContain('Searchable');
    });
  });

  describe('getTemplateStats', () => {
    it('should get template stats', async () => {
      const nodes = {
        node1: {
          id: 'node1',
          type: 'Data' as const,
          position: { x: 100, y: 100 },
          metadata: { title: 'Test Node' },
          ternaryState: 'UNKNOWN' as const,
          inputs: [],
          outputs: [],
        },
      };

      const createdTemplate = await templateService.createTemplate({
        name: 'Test Template',
        description: 'A test template',
        nodes,
        connections: [],
        author: userId,
        authorName: userName,
      });

      // Increment some stats
      await templateService.downloadTemplate(createdTemplate._id.toString(), userId);
      await templateService.likeTemplate(createdTemplate._id.toString(), userId);
      await templateService.rateTemplate(createdTemplate._id.toString(), userId, 5);

      const stats = await templateService.getTemplateStats(createdTemplate._id.toString());

      expect(stats).toBeDefined();
      expect(stats.downloadCount).toBe(1);
      expect(stats.likeCount).toBe(1);
      expect(stats.rating).toBe(5);
    });

    it('should throw NotFoundError if template does not exist', async () => {
      const nonExistentId = '507f1f77bcf86cd799439011';

      await expect(templateService.getTemplateStats(nonExistentId))
        .rejects
        .toThrow(NotFoundError);
    });
  });
});
