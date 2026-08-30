/**
 * Database Configuration
 * MongoDB and Redis connection management
 */

import mongoose from 'mongoose';
import { createClient, RedisClientType } from 'redis';

// Configuration
const MONGO_URI = process.env["MONGO_URI"] || process.env["MONGODB_URI"] || 'mongodb://localhost:27017/eden';
const REDIS_URL = process.env["REDIS_URL"] || 'redis://localhost:6379';
const NODE_ENV = process.env["NODE_ENV"] || 'development';

// MongoDB connection
let mongoConnection: typeof mongoose | null = null;

/**
 * Connect to MongoDB
 */
export async function connectMongoDB(): Promise<typeof mongoose> {
  if (mongoConnection) {
    return mongoConnection;
  }

  console.log(`Connecting to MongoDB at ${MONGO_URI}...`);

  try {
    mongoConnection = await mongoose.connect(MONGO_URI, {
      connectTimeoutMS: 10000,
      socketTimeoutMS: 30000,
      serverSelectionTimeoutMS: 10000,
      retryWrites: true,
      retryReads: true,
    });

    // Connection events
    mongoose.connection.on('connected', () => {
      console.log('✅ MongoDB connected successfully');
    });

    mongoose.connection.on('disconnected', () => {
      console.log('⚠️ MongoDB disconnected');
    });

    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB connection error:', err);
    });

    mongoose.connection.on('reconnected', () => {
      console.log('✅ MongoDB reconnected');
    });

    console.log('✅ MongoDB connected');
    return mongoConnection;
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error);
    throw error;
  }
}

/**
 * Disconnect from MongoDB
 */
export async function disconnectMongoDB(): Promise<void> {
  if (mongoConnection) {
    await mongoose.disconnect();
    mongoConnection = null;
    console.log('MongoDB disconnected');
  }
}

/**
 * Get MongoDB connection status
 */
export function getMongoDBStatus(): string {
  if (!mongoConnection) return 'disconnected';
  return mongoose.connection.readyState === 1 ? 'connected' : 'connecting';
}

// Redis connection
let redisClient: RedisClientType | null = null;

/**
 * Connect to Redis
 */
export async function connectRedis(): Promise<RedisClientType> {
  if (redisClient) {
    return redisClient;
  }

  console.log(`Connecting to Redis at ${REDIS_URL}...`);

  try {
    redisClient = createClient({
      url: REDIS_URL,
      socket: {
        connectTimeout: 10000,
        timeout: 30000,
        reconnectStrategy: (retries) => Math.min(retries * 100, 5000),
      },
      database: NODE_ENV === 'test' ? 1 : 0,
    });

    redisClient.on('error', (err) => {
      console.error('❌ Redis error:', err);
    });

    redisClient.on('connect', () => {
      console.log('✅ Redis connected successfully');
    });

    redisClient.on('disconnect', () => {
      console.log('⚠️ Redis disconnected');
    });

    await redisClient.connect();
    console.log('✅ Redis connected');
    return redisClient;
  } catch (error) {
    console.error('❌ Redis connection failed:', error);
    throw error;
  }
}

/**
 * Disconnect from Redis
 */
export async function disconnectRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    console.log('Redis disconnected');
  }
}

/**
 * Get Redis connection status
 */
export function getRedisStatus(): string {
  if (!redisClient) return 'disconnected';
  return redisClient.isReady ? 'connected' : 'connecting';
}

/**
 * Get Redis client
 */
export function getRedisClient(): RedisClientType {
  if (!redisClient) {
    throw new Error('Redis client not initialized. Call connectRedis() first.');
  }
  return redisClient;
}

/**
 * Initialize all database connections
 */
export async function initializeDatabase(): Promise<void> {
  try {
    // Connect to MongoDB (primary database)
    await connectMongoDB();

    // Connect to Redis (cache/sessions)
    if (NODE_ENV !== 'test' || process.env["REDIS_URL"]) {
      await connectRedis();
    }

    console.log('✅ All database connections initialized');
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    throw error;
  }
}

/**
 * Close all database connections
 */
export async function closeDatabase(): Promise<void> {
  try {
    await disconnectMongoDB();
    await disconnectRedis();
    console.log('✅ All database connections closed');
  } catch (error) {
    console.error('❌ Error closing database connections:', error);
  }
}

// Graceful shutdown
gracefulShutdown();

function gracefulShutdown() {
  process.on('SIGTERM', async () => {
    console.log('SIGTERM received. Closing database connections...');
    await closeDatabase();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    console.log('SIGINT received. Closing database connections...');
    await closeDatabase();
    process.exit(0);
  });
}

export { MONGO_URI, REDIS_URL };
