/**
 * Seed Script
 * Database seeding for EDEN application
 */

import mongoose from 'mongoose';
import { connectMongoDB, disconnectMongoDB } from '../src/server/config/database';
import UserModel from '../src/server/models/User';
import AgentModel from '../src/server/models/Agent';
import TemplateModel from '../src/server/models/Template';
import WebhookModel from '../src/server/models/Webhook';

// Configuration
const NODE_ENV = process.env.NODE_ENV || 'development';
const SEED_ADMIN = process.env.SEED_ADMIN === 'true';
const SEED_USERS = parseInt(process.env.SEED_USERS || '10');
const SEED_AGENTS = parseInt(process.env.SEED_AGENTS || '20');
const SEED_TEMPLATES = parseInt(process.env.SEED_TEMPLATES || '10');

// Sample data
const sampleUsers = [
  { email: 'admin@eden.dev', password: 'admin123', name: 'Admin User', role: 'admin' as const },
  { email: 'user1@eden.dev', password: 'password123', name: 'User One', role: 'user' as const },
  { email: 'user2@eden.dev', password: 'password123', name: 'User Two', role: 'user' as const },
  { email: 'moderator@eden.dev', password: 'moderator123', name: 'Moderator', role: 'moderator' as const },
];

const sampleAgents = [
  {
    name: 'Data Processing Pipeline',
    description: 'Process and transform data from multiple sources',
    metadata: {
      category: 'data-processing' as const,
      tags: ['data', 'processing', 'pipeline'],
      isPublic: true,
      isFeatured: true,
      difficulty: 'intermediate' as const,
      estimatedTime: 15,
    },
    nodes: {
      input1: {
        id: 'input1',
        type: 'IO' as const,
        position: { x: 100, y: 100 },
        metadata: { title: 'Input 1', content: 'Data source 1' },
        ternaryState: 'UNKNOWN' as const,
        inputs: [],
        outputs: ['output1'],
      },
      input2: {
        id: 'input2',
        type: 'IO' as const,
        position: { x: 100, y: 250 },
        metadata: { title: 'Input 2', content: 'Data source 2' },
        ternaryState: 'UNKNOWN' as const,
        inputs: [],
        outputs: ['output1'],
      },
      processor: {
        id: 'processor',
        type: 'Logic' as const,
        position: { x: 300, y: 150 },
        metadata: { title: 'Data Processor', gateType: 'AND' as const },
        ternaryState: 'UNKNOWN' as const,
        inputs: ['input1', 'input2'],
        outputs: ['output1', 'output2'],
      },
      output: {
        id: 'output',
        type: 'IO' as const,
        position: { x: 500, y: 150 },
        metadata: { title: 'Output', content: 'Processed data' },
        ternaryState: 'UNKNOWN' as const,
        inputs: ['input1'],
        outputs: [],
      },
    },
    connections: [
      { id: 'conn1', sourceId: 'input1', sourcePort: 'output1', targetId: 'processor', targetPort: 'input1' },
      { id: 'conn2', sourceId: 'input2', sourcePort: 'output1', targetId: 'processor', targetPort: 'input2' },
      { id: 'conn3', sourceId: 'processor', sourcePort: 'output1', targetId: 'output', targetPort: 'input1' },
    ],
  },
  {
    name: 'AI Chatbot',
    description: 'Intelligent chatbot with natural language processing',
    metadata: {
      category: 'ai-assistants' as const,
      tags: ['ai', 'chatbot', 'nlp'],
      isPublic: true,
      isFeatured: true,
      difficulty: 'advanced' as const,
      estimatedTime: 30,
    },
    nodes: {
      input: {
        id: 'input',
        type: 'IO' as const,
        position: { x: 100, y: 100 },
        metadata: { title: 'User Input', content: 'User message' },
        ternaryState: 'UNKNOWN' as const,
        inputs: [],
        outputs: ['output1'],
      },
      nlp: {
        id: 'nlp',
        type: 'AI' as const,
        position: { x: 300, y: 100 },
        metadata: { title: 'NLP Processor', content: 'Natural Language Processing' },
        ternaryState: 'UNKNOWN' as const,
        inputs: ['input1'],
        outputs: ['output1'],
      },
      response: {
        id: 'response',
        type: 'IO' as const,
        position: { x: 500, y: 100 },
        metadata: { title: 'Chatbot Response', content: 'Bot response' },
        ternaryState: 'UNKNOWN' as const,
        inputs: ['input1'],
        outputs: [],
      },
    },
    connections: [
      { id: 'conn1', sourceId: 'input', sourcePort: 'output1', targetId: 'nlp', targetPort: 'input1' },
      { id: 'conn2', sourceId: 'nlp', sourcePort: 'output1', targetId: 'response', targetPort: 'input1' },
    ],
  },
  {
    name: 'Web Scraper',
    description: 'Extract data from websites',
    metadata: {
      category: 'web-scraping' as const,
      tags: ['web', 'scraping', 'extraction'],
      isPublic: true,
      isFeatured: false,
      difficulty: 'beginner' as const,
      estimatedTime: 10,
    },
    nodes: {
      urlInput: {
        id: 'urlInput',
        type: 'IO' as const,
        position: { x: 100, y: 100 },
        metadata: { title: 'URL Input', content: 'Website URL' },
        ternaryState: 'UNKNOWN' as const,
        inputs: [],
        outputs: ['output1'],
      },
      scraper: {
        id: 'scraper',
        type: 'Custom' as const,
        position: { x: 300, y: 100 },
        metadata: { title: 'Web Scraper', content: 'Extract website content' },
        ternaryState: 'UNKNOWN' as const,
        inputs: ['input1'],
        outputs: ['output1'],
      },
      dataOutput: {
        id: 'dataOutput',
        type: 'IO' as const,
        position: { x: 500, y: 100 },
        metadata: { title: 'Extracted Data', content: 'Scraped data' },
        ternaryState: 'UNKNOWN' as const,
        inputs: ['input1'],
        outputs: [],
      },
    },
    connections: [
      { id: 'conn1', sourceId: 'urlInput', sourcePort: 'output1', targetId: 'scraper', targetPort: 'input1' },
      { id: 'conn2', sourceId: 'scraper', sourcePort: 'output1', targetId: 'dataOutput', targetPort: 'input1' },
    ],
  },
];

const sampleTemplates = [
  {
    name: 'Basic Data Pipeline',
    description: 'A basic template for data processing pipelines',
    author: '', // Will be set during seeding
    authorName: '', // Will be set during seeding
    metadata: {
      category: 'data-processing' as const,
      tags: ['data', 'pipeline', 'template'],
      isPublic: true,
      isFeatured: true,
      difficulty: 'beginner' as const,
      estimatedTime: 10,
    },
    content: {
      readme: '# Basic Data Pipeline\n\nThis template provides a basic structure for data processing pipelines.',
      changelog: '## v1.0.0\n- Initial release',
      usage: '1. Add your data sources\n2. Configure the processor nodes\n3. Connect the outputs',
      dependencies: [],
      examples: [],
    },
  },
  {
    name: 'AI Assistant',
    description: 'Template for building AI assistants',
    author: '',
    authorName: '',
    metadata: {
      category: 'ai-assistants' as const,
      tags: ['ai', 'assistant', 'template'],
      isPublic: true,
      isFeatured: true,
      difficulty: 'intermediate' as const,
      estimatedTime: 20,
    },
    content: {
      readme: '# AI Assistant\n\nTemplate for building intelligent AI assistants.',
      changelog: '## v1.0.0\n- Initial release',
      usage: '1. Configure the AI model\n2. Add conversation flow\n3. Test and deploy',
      dependencies: ['@tensorflow/tfjs', 'natural'],
      examples: [],
    },
  },
];

const sampleWebhooks = [
  {
    name: 'GitHub Webhook',
    description: 'Receive notifications from GitHub',
    author: '', // Will be set during seeding
    url: 'https://api.eden.dev/api/webhooks/incoming/github',
    secret: 'github-webhook-secret',
    events: ['github_push', 'github_pull_request', 'github_issue'] as const,
    source: 'github' as const,
    isActive: true,
    isVerified: false,
  },
  {
    name: 'Discord Webhook',
    description: 'Send notifications to Discord',
    author: '', // Will be set during seeding
    url: 'https://discord.com/api/webhooks/your-webhook-url',
    secret: 'discord-webhook-secret',
    events: ['agent_created', 'agent_executed', 'template_created'] as const,
    source: 'discord' as const,
    isActive: true,
    isVerified: false,
  },
];

// ============================================
// Helper Functions
// ============================================

/**
 * Generate random string
 */
function randomString(length: number = 10): string {
  return Math.random().toString(36).substring(2, 2 + length);
}

/**
 * Generate random email
 */
function randomEmail(): string {
  return `user${randomString(8)}@example.com`;
}

/**
 * Generate random name
 */
function randomName(): string {
  const firstNames = ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve', 'Frank', 'Grace', 'Henry'];
  const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Miller', 'Davis'];
  return `${firstNames[Math.floor(Math.random() * firstNames.length)]} ${lastNames[Math.floor(Math.random() * lastNames.length)]}`;
}

/**
 * Generate random agent
 */
function randomAgent(authorId: string): any {
  const categories = ['automation', 'data-processing', 'ai-assistants', 'web-scraping', 'chatbots', 'analysis', 'creative', 'productivity', 'other'] as const;
  const difficulties = ['beginner', 'intermediate', 'advanced'] as const;
  const nodeTypes = ['Data', 'Logic', 'UI', 'IO', 'Custom'] as const;
  const ternaryStates = ['TRUE', 'FALSE', 'UNKNOWN', 'ERROR'] as const;

  const nodeCount = Math.floor(Math.random() * 5) + 2;
  const nodes: Record<string, any> = {};
  const connections: any[] = [];

  // Create nodes
  for (let i = 0; i < nodeCount; i++) {
    const nodeId = `node${i}`;
    nodes[nodeId] = {
      id: nodeId,
      type: nodeTypes[Math.floor(Math.random() * nodeTypes.length)],
      position: { x: (i + 1) * 200, y: 100 },
      metadata: {
        title: `Node ${i + 1}`,
        content: `Node ${i + 1} content`,
      },
      ternaryState: ternaryStates[Math.floor(Math.random() * ternaryStates.length)],
      inputs: [],
      outputs: [`output${i + 1}`],
    };
  }

  // Create connections
  for (let i = 0; i < nodeCount - 1; i++) {
    connections.push({
      id: `conn${i}`,
      sourceId: `node${i}`,
      sourcePort: 'output1',
      targetId: `node${i + 1}`,
      targetPort: 'input1',
    });
  }

  return {
    name: `Agent ${randomString(6)}`,
    description: `Random agent ${randomString(10)}`,
    author: authorId,
    nodes,
    connections,
    metadata: {
      version: '1.0.0',
      category: categories[Math.floor(Math.random() * categories.length)],
      tags: [randomString(5), randomString(5)],
      isPublic: Math.random() > 0.5,
      isFeatured: Math.random() > 0.8,
      difficulty: difficulties[Math.floor(Math.random() * difficulties.length)],
      estimatedTime: Math.floor(Math.random() * 60) + 5,
    },
    settings: {
      autoRun: Math.random() > 0.7,
      timeout: 30000,
      maxIterations: 20,
      parallelExecution: Math.random() > 0.5,
    },
  };
}

/**
 * Generate random template
 */
function randomTemplate(authorId: string, authorName: string): any {
  const categories = ['automation', 'data-processing', 'ai-assistants', 'web-scraping', 'chatbots', 'analysis', 'creative', 'productivity', 'other'] as const;
  const difficulties = ['beginner', 'intermediate', 'advanced'] as const;

  return {
    name: `Template ${randomString(6)}`,
    description: `Random template ${randomString(10)}`,
    author: authorId,
    authorName,
    nodes: sampleAgents[0].nodes,
    connections: sampleAgents[0].connections,
    metadata: {
      version: '1.0.0',
      category: categories[Math.floor(Math.random() * categories.length)],
      tags: [randomString(5), randomString(5)],
      isPublic: Math.random() > 0.5,
      isFeatured: Math.random() > 0.8,
      difficulty: difficulties[Math.floor(Math.random() * difficulties.length)],
      estimatedTime: Math.floor(Math.random() * 60) + 5,
    },
    content: {
      readme: `# ${randomString(6)} Template\n\nThis is a randomly generated template.`,
      changelog: `## v1.0.0\n- Initial release`,
      usage: `1. Configure the template\n2. Customize as needed\n3. Deploy`,
      dependencies: [],
      examples: [],
    },
  };
}

// ============================================
// Seed Functions
// ============================================

/**
 * Seed users
 */
async function seedUsers() {
  console.log('🌱 Seeding users...');

  // Clear existing users
  await UserModel.deleteMany({});

  // Create sample users
  const users = [];
  for (const userData of sampleUsers) {
    const user = new UserModel(userData);
    await user.save();
    users.push(user);
    console.log(`  ✅ Created user: ${user.email}`);
  }

  // Create random users if requested
  if (SEED_USERS > sampleUsers.length) {
    for (let i = 0; i < SEED_USERS - sampleUsers.length; i++) {
      const user = new UserModel({
        email: randomEmail(),
        password: 'password123',
        name: randomName(),
        role: 'user' as const,
      });
      await user.save();
      users.push(user);
      console.log(`  ✅ Created random user: ${user.email}`);
    }
  }

  console.log(`✅ Seeded ${users.length} users`);
  return users;
}

/**
 * Seed agents
 */
async function seedAgents(users: any[]) {
  console.log('🌱 Seeding agents...');

  // Clear existing agents
  await AgentModel.deleteMany({});

  // Create sample agents for each user
  const agents = [];
  for (const user of users) {
    // Create sample agents for each user
    for (const agentData of sampleAgents) {
      const agent = new AgentModel({
        ...agentData,
        author: user._id,
      });
      await agent.save();
      agents.push(agent);
      console.log(`  ✅ Created agent: ${agent.name} (by ${user.email})`);
    }

    // Create random agents if requested
    if (SEED_AGENTS > sampleAgents.length * users.length) {
      const agentsPerUser = Math.floor((SEED_AGENTS - sampleAgents.length * users.length) / users.length);
      for (let i = 0; i < agentsPerUser; i++) {
        const agent = new AgentModel(randomAgent(user._id.toString()));
        await agent.save();
        agents.push(agent);
        console.log(`  ✅ Created random agent: ${agent.name} (by ${user.email})`);
      }
    }
  }

  console.log(`✅ Seeded ${agents.length} agents`);
  return agents;
}

/**
 * Seed templates
 */
async function seedTemplates(users: any[]) {
  console.log('🌱 Seeding templates...');

  // Clear existing templates
  await TemplateModel.deleteMany({});

  // Create sample templates for each user
  const templates = [];
  for (const user of users) {
    // Create sample templates for each user
    for (const templateData of sampleTemplates) {
      const template = new TemplateModel({
        ...templateData,
        author: user._id,
        authorName: user.name,
      });
      await template.save();
      templates.push(template);
      console.log(`  ✅ Created template: ${template.name} (by ${user.email})`);
    }

    // Create random templates if requested
    if (SEED_TEMPLATES > sampleTemplates.length * users.length) {
      const templatesPerUser = Math.floor((SEED_TEMPLATES - sampleTemplates.length * users.length) / users.length);
      for (let i = 0; i < templatesPerUser; i++) {
        const template = new TemplateModel(randomTemplate(user._id.toString(), user.name));
        await template.save();
        templates.push(template);
        console.log(`  ✅ Created random template: ${template.name} (by ${user.email})`);
      }
    }
  }

  console.log(`✅ Seeded ${templates.length} templates`);
  return templates;
}

/**
 * Seed webhooks
 */
async function seedWebhooks(users: any[]) {
  console.log('🌱 Seeding webhooks...');

  // Clear existing webhooks
  await WebhookModel.deleteMany({});

  // Create sample webhooks for admin user
  const adminUser = users.find((u: any) => u.role === 'admin');
  if (!adminUser) {
    console.log('  ⚠️ No admin user found, skipping webhooks');
    return [];
  }

  const webhooks = [];
  for (const webhookData of sampleWebhooks) {
    const webhook = new WebhookModel({
      ...webhookData,
      author: adminUser._id,
    });
    await webhook.save();
    webhooks.push(webhook);
    console.log(`  ✅ Created webhook: ${webhook.name} (by ${adminUser.email})`);
  }

  console.log(`✅ Seeded ${webhooks.length} webhooks`);
  return webhooks;
}

// ============================================
// Main Seed Function
// ============================================

async function seed() {
  console.log('🌱 Starting EDEN database seeding...\n');

  try {
    // Connect to MongoDB
    console.log('🔌 Connecting to MongoDB...');
    await connectMongoDB();
    console.log('✅ Connected to MongoDB\n');

    // Seed data
    const users = await seedUsers();
    const agents = await seedAgents(users);
    const templates = await seedTemplates(users);
    const webhooks = await seedWebhooks(users);

    // Summary
    console.log('\n📊 Seed Summary:');
    console.log(`  Users: ${users.length}`);
    console.log(`  Agents: ${agents.length}`);
    console.log(`  Templates: ${templates.length}`);
    console.log(`  Webhooks: ${webhooks.length}`);

    console.log('\n✅ Database seeding completed successfully!');

    // Disconnect from MongoDB
    await disconnectMongoDB();
  } catch (error: any) {
    console.error('\n❌ Error during seeding:', error);
    process.exit(1);
  }
}

// ============================================
// Run Seed
// ============================================

// Only run if this file is executed directly
if (require.main === module) {
  seed();
}

export { seed, seedUsers, seedAgents, seedTemplates, seedWebhooks };
