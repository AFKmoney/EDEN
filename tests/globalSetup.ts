/**
 * Global Jest Setup
 * Runs once before all tests
 */

import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';

let mongoServer: MongoMemoryServer;

module.exports = async () => {
  // Start MongoDB Memory Server
  try {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    
    // Connect to the in-memory MongoDB
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    console.log('✅ MongoDB Memory Server started for tests');
  } catch (error) {
    console.warn('⚠️ Could not start MongoDB Memory Server, using regular MongoDB connection');
  }
  
  // Store global reference for teardown
  (global as any).__MONGOD__ = mongoServer;
};
