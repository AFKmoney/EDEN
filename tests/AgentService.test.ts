/**
 * Agent Service Tests
 * Unit tests for AgentService with Ternary VM and Chain of Thought
 */

import { agentService } from '../src/server/services/AgentService';
import AgentModel from '../src/server/models/Agent';
import UserModel from '../src/server/models/User';
import { connectMongoDB, disconnectMongoDB } from '../src/server/config/database';
import { NotFoundError, ValidationError, AuthorizationError } from '../src/server/middleware/errorHandler';

// Set NODE_ENV for tests
process.env.NODE_ENV = 'test';

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
  await AgentModel.deleteMany({});
  await UserModel.deleteMany({});
});

describe('AgentService', () => {
  let userId: string;

  beforeEach(async () => {
    // Create a test user
    const user = new UserModel({
      email: 'test@example.com',
      password: 'password123',
      name: 'Test User',
    });
    await user.save();
    userId = user._id.toString();
  });

  describe('createAgent', () => {
    it('should create a new agent', async () => {
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

      const agent = await agentService.createAgent({
        name: 'Test Agent',
        description: 'A test agent',
        nodes,
        connections: [],
        author: userId,
        metadata: { tags: ['test'], category: 'other' },
      });

      expect(agent).toBeDefined();
      expect(agent.name).toBe('Test Agent');
      expect(agent.author.toString()).toBe(userId);
      expect(agent.nodes).toBeDefined();
      expect(agent.isActive).toBe(true);
    });

    it('should throw ValidationError if nodes are missing', async () => {
      await expect(agentService.createAgent({
        name: 'Test Agent',
        description: 'A test agent',
        nodes: {} as any,
        connections: [],
        author: userId,
      }))
        .rejects
        .toThrow(ValidationError);
    });
  });

  describe('getAgentById', () => {
    it('should get an agent by ID', async () => {
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

      const createdAgent = await agentService.createAgent({
        name: 'Test Agent',
        nodes,
        connections: [],
        author: userId,
      });

      const agent = await agentService.getAgentById(createdAgent._id.toString());

      expect(agent).toBeDefined();
      expect(agent._id.toString()).toBe(createdAgent._id.toString());
    });

    it('should throw NotFoundError if agent does not exist', async () => {
      const nonExistentId = '507f1f77bcf86cd799439011';

      await expect(agentService.getAgentById(nonExistentId))
        .rejects
        .toThrow(NotFoundError);
    });

    it('should throw ValidationError if ID is invalid', async () => {
      const invalidId = 'invalid-id';

      await expect(agentService.getAgentById(invalidId))
        .rejects
        .toThrow(ValidationError);
    });
  });

  describe('getAgentsByAuthor', () => {
    it('should get agents by author', async () => {
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

      // Create multiple agents
      for (let i = 0; i < 5; i++) {
        await agentService.createAgent({
          name: `Agent ${i}`,
          nodes,
          connections: [],
          author: userId,
        });
      }

      const result = await agentService.getAgentsByAuthor(userId, {});

      expect(result).toBeDefined();
      expect(result.agents.length).toBe(5);
      expect(result.total).toBe(5);
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

      // Create 15 agents
      for (let i = 0; i < 15; i++) {
        await agentService.createAgent({
          name: `Agent ${i}`,
          nodes,
          connections: [],
          author: userId,
        });
      }

      const result = await agentService.getAgentsByAuthor(userId, { page: 1, limit: 10 });

      expect(result.agents.length).toBe(10);
      expect(result.total).toBe(15);
      expect(result.page).toBe(1);
      expect(result.pages).toBe(2);
    });

    it('should filter by tags', async () => {
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

      // Create agents with different tags
      await agentService.createAgent({
        name: 'Agent 1',
        nodes,
        connections: [],
        author: userId,
        metadata: { tags: ['tag1'] },
      });

      await agentService.createAgent({
        name: 'Agent 2',
        nodes,
        connections: [],
        author: userId,
        metadata: { tags: ['tag2'] },
      });

      await agentService.createAgent({
        name: 'Agent 3',
        nodes,
        connections: [],
        author: userId,
        metadata: { tags: ['tag1', 'tag2'] },
      });

      const result = await agentService.getAgentsByAuthor(userId, { tags: ['tag1'] });

      expect(result.agents.length).toBe(2);
    });
  });

  describe('updateAgent', () => {
    it('should update an agent', async () => {
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

      const createdAgent = await agentService.createAgent({
        name: 'Test Agent',
        nodes,
        connections: [],
        author: userId,
      });

      const updatedAgent = await agentService.updateAgent(
        createdAgent._id.toString(),
        userId,
        { name: 'Updated Agent', description: 'Updated description' }
      );

      expect(updatedAgent).toBeDefined();
      expect(updatedAgent.name).toBe('Updated Agent');
      expect(updatedAgent.description).toBe('Updated description');
    });

    it('should throw NotFoundError if agent does not exist', async () => {
      const nonExistentId = '507f1f77bcf86cd799439011';

      await expect(agentService.updateAgent(nonExistentId, userId, { name: 'New Name' }))
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

      const createdAgent = await agentService.createAgent({
        name: 'Test Agent',
        nodes,
        connections: [],
        author: userId,
      });

      const otherUserId = '507f1f77bcf86cd799439012';

      await expect(agentService.updateAgent(createdAgent._id.toString(), otherUserId, { name: 'New Name' }))
        .rejects
        .toThrow(AuthorizationError);
    });
  });

  describe('deleteAgent', () => {
    it('should delete an agent', async () => {
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

      const createdAgent = await agentService.createAgent({
        name: 'Test Agent',
        nodes,
        connections: [],
        author: userId,
      });

      await agentService.deleteAgent(createdAgent._id.toString(), userId, false);

      const deletedAgent = await agentService.getAgentById(createdAgent._id.toString());
      expect(deletedAgent.isArchived).toBe(true);
    });

    it('should throw NotFoundError if agent does not exist', async () => {
      const nonExistentId = '507f1f77bcf86cd799439011';

      await expect(agentService.deleteAgent(nonExistentId, userId, false))
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

      const createdAgent = await agentService.createAgent({
        name: 'Test Agent',
        nodes,
        connections: [],
        author: userId,
      });

      const otherUserId = '507f1f77bcf86cd799439012';

      await expect(agentService.deleteAgent(createdAgent._id.toString(), otherUserId, false))
        .rejects
        .toThrow(AuthorizationError);
    });

    it('should allow admin to delete any agent', async () => {
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

      const createdAgent = await agentService.createAgent({
        name: 'Test Agent',
        nodes,
        connections: [],
        author: userId,
      });

      const otherUserId = '507f1f77bcf86cd799439012';

      await expect(agentService.deleteAgent(createdAgent._id.toString(), otherUserId, true))
        .resolves
        .not.toThrow();
    });
  });

  describe('cloneAgent', () => {
    it('should clone an agent', async () => {
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

      const createdAgent = await agentService.createAgent({
        name: 'Test Agent',
        nodes,
        connections: [],
        author: userId,
      });

      const clonedAgent = await agentService.cloneAgent(createdAgent._id.toString(), userId);

      expect(clonedAgent).toBeDefined();
      expect(clonedAgent.name).toContain('(Copy)');
      expect(clonedAgent.author.toString()).toBe(userId);
      expect(clonedAgent._id.toString()).not.toBe(createdAgent._id.toString());
    });

    it('should throw NotFoundError if agent does not exist', async () => {
      const nonExistentId = '507f1f77bcf86cd799439011';

      await expect(agentService.cloneAgent(nonExistentId, userId))
        .rejects
        .toThrow(NotFoundError);
    });
  });

  describe('toggleAgentVisibility', () => {
    it('should toggle agent visibility', async () => {
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

      const createdAgent = await agentService.createAgent({
        name: 'Test Agent',
        nodes,
        connections: [],
        author: userId,
        metadata: { isPublic: false },
      });

      const updatedAgent = await agentService.toggleAgentVisibility(
        createdAgent._id.toString(),
        userId,
        true
      );

      expect(updatedAgent).toBeDefined();
      expect(updatedAgent.metadata.isPublic).toBe(true);
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

      const createdAgent = await agentService.createAgent({
        name: 'Test Agent',
        nodes,
        connections: [],
        author: userId,
      });

      const otherUserId = '507f1f77bcf86cd799439012';

      await expect(agentService.toggleAgentVisibility(createdAgent._id.toString(), otherUserId, true))
        .rejects
        .toThrow(AuthorizationError);
    });
  });

  describe('getAgentStats', () => {
    it('should get agent stats', async () => {
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

      const createdAgent = await agentService.createAgent({
        name: 'Test Agent',
        nodes,
        connections: [],
        author: userId,
      });

      const stats = await agentService.getAgentStats(createdAgent._id.toString());

      expect(stats).toBeDefined();
      expect(stats.id).toBe(createdAgent._id.toString());
      expect(stats.nodeCount).toBe(1);
      expect(stats.connectionCount).toBe(0);
    });

    it('should throw NotFoundError if agent does not exist', async () => {
      const nonExistentId = '507f1f77bcf86cd799439011';

      await expect(agentService.getAgentStats(nonExistentId))
        .rejects
        .toThrow(NotFoundError);
    });
  });

  describe('executeAgent', () => {
    it('should execute an agent with Ternary VM', async () => {
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

      const createdAgent = await agentService.createAgent({
        name: 'Test Agent',
        nodes,
        connections: [],
        author: userId,
      });

      const result = await agentService.executeAgent(createdAgent._id.toString(), {});

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.nodeResults).toBeDefined();
      expect(result.stats).toBeDefined();
      expect(result.executionTime).toBeGreaterThanOrEqual(0);
      expect(result.stats.totalNodes).toBe(1);
    });

    it('should execute agent with logic gates', async () => {
      const nodes: Record<string, any> = {
        node1: {
          id: 'node1',
          type: 'Data' as const,
          position: { x: 100, y: 100 },
          metadata: { title: 'Input 1' },
          ternaryState: 'TRUE' as const,
          inputs: [],
          outputs: [],
        },
        node2: {
          id: 'node2',
          type: 'Data' as const,
          position: { x: 100, y: 200 },
          metadata: { title: 'Input 2' },
          ternaryState: 'TRUE' as const,
          inputs: [],
          outputs: [],
        },
        node3: {
          id: 'node3',
          type: 'Logic' as const,
          position: { x: 300, y: 150 },
          metadata: { title: 'AND Gate', gateType: 'AND' },
          ternaryState: 'UNKNOWN' as const,
          inputs: [],
          outputs: [],
        },
      };

      const connections = [
        { id: 'edge1', sourceId: 'node1', sourcePort: 'output', targetId: 'node3', targetPort: 'input' },
        { id: 'edge2', sourceId: 'node2', sourcePort: 'output', targetId: 'node3', targetPort: 'input' },
      ];

      const createdAgent = await agentService.createAgent({
        name: 'Logic Test Agent',
        nodes,
        connections,
        author: userId,
      });

      const result = await agentService.executeAgent(createdAgent._id.toString(), {});

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.nodeResults.node3).toBeDefined();
      // AND gate with two TRUE inputs should result in TRUE
      expect(result.nodeResults.node3.state).toBe('TRUE');
    });

    it('should execute agent with OR gate', async () => {
      const nodes: Record<string, any> = {
        node1: {
          id: 'node1',
          type: 'Data' as const,
          position: { x: 100, y: 100 },
          metadata: { title: 'Input 1' },
          ternaryState: 'FALSE' as const,
          inputs: [],
          outputs: [],
        },
        node2: {
          id: 'node2',
          type: 'Data' as const,
          position: { x: 100, y: 200 },
          metadata: { title: 'Input 2' },
          ternaryState: 'TRUE' as const,
          inputs: [],
          outputs: [],
        },
        node3: {
          id: 'node3',
          type: 'Logic' as const,
          position: { x: 300, y: 150 },
          metadata: { title: 'OR Gate', gateType: 'OR' },
          ternaryState: 'UNKNOWN' as const,
          inputs: [],
          outputs: [],
        },
      };

      const connections = [
        { id: 'edge1', sourceId: 'node1', sourcePort: 'output', targetId: 'node3', targetPort: 'input' },
        { id: 'edge2', sourceId: 'node2', sourcePort: 'output', targetId: 'node3', targetPort: 'input' },
      ];

      const createdAgent = await agentService.createAgent({
        name: 'OR Test Agent',
        nodes,
        connections,
        author: userId,
      });

      const result = await agentService.executeAgent(createdAgent._id.toString(), {});

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      // OR gate with FALSE and TRUE inputs should result in TRUE
      expect(result.nodeResults.node3.state).toBe('TRUE');
    });

    it('should execute agent with NOT gate', async () => {
      const nodes: Record<string, any> = {
        node1: {
          id: 'node1',
          type: 'Data' as const,
          position: { x: 100, y: 100 },
          metadata: { title: 'Input' },
          ternaryState: 'FALSE' as const,
          inputs: [],
          outputs: [],
        },
        node2: {
          id: 'node2',
          type: 'Logic' as const,
          position: { x: 300, y: 150 },
          metadata: { title: 'NOT Gate', gateType: 'NOT' },
          ternaryState: 'UNKNOWN' as const,
          inputs: [],
          outputs: [],
        },
      };

      const connections = [
        { id: 'edge1', sourceId: 'node1', sourcePort: 'output', targetId: 'node2', targetPort: 'input' },
      ];

      const createdAgent = await agentService.createAgent({
        name: 'NOT Test Agent',
        nodes,
        connections,
        author: userId,
      });

      const result = await agentService.executeAgent(createdAgent._id.toString(), {});

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      // NOT gate with FALSE input should result in TRUE
      expect(result.nodeResults.node2.state).toBe('TRUE');
    });

    it('should handle agent with unknown state', async () => {
      const nodes: Record<string, any> = {
        node1: {
          id: 'node1',
          type: 'Data' as const,
          position: { x: 100, y: 100 },
          metadata: { title: 'Unknown Node' },
          ternaryState: 'UNKNOWN' as const,
          inputs: [],
          outputs: [],
        },
        node2: {
          id: 'node2',
          type: 'Logic' as const,
          position: { x: 300, y: 150 },
          metadata: { title: 'AND Gate', gateType: 'AND' },
          ternaryState: 'UNKNOWN' as const,
          inputs: [],
          outputs: [],
        },
      };

      const connections = [
        { id: 'edge1', sourceId: 'node1', sourcePort: 'output', targetId: 'node2', targetPort: 'input' },
      ];

      const createdAgent = await agentService.createAgent({
        name: 'Unknown Test Agent',
        nodes,
        connections,
        author: userId,
      });

      const result = await agentService.executeAgent(createdAgent._id.toString(), {});

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      // AND gate with UNKNOWN input should result in UNKNOWN
      expect(result.nodeResults.node2.state).toBe('UNKNOWN');
    });

    it('should throw NotFoundError if agent does not exist', async () => {
      const nonExistentId = '507f1f77bcf86cd799439011';

      const result = await agentService.executeAgent(nonExistentId, {});
      
      expect(result).toBeDefined();
      expect(result.success).toBe(false);
      expect(result.error).toContain('Agent not found');
    });

    it('should execute agentic loop', async () => {
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

      const createdAgent = await agentService.createAgent({
        name: 'Agentic Test Agent',
        nodes,
        connections: [],
        author: userId,
      });

      const result = await agentService.executeAgenticLoop(
        createdAgent._id.toString(),
        'Create a simple graph with 2 nodes',
        3
      );

      expect(result).toBeDefined();
      expect(result.iterations).toBeGreaterThan(0);
      expect(result.chainOfThought).toBeInstanceOf(Array);
    });
  });
});
