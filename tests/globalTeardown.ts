/**
 * Global Jest Teardown
 * Runs once after all tests
 */

import mongoose from 'mongoose';

module.exports = async () => {
  // Close MongoDB connection
  try {
    await mongoose.disconnect();
    console.log('✅ MongoDB connection closed');
  } catch (error) {
    console.warn('⚠️ Error closing MongoDB connection:', error);
  }
  
  // Stop MongoDB Memory Server
  const mongoServer = (global as any).__MONGOD__;
  if (mongoServer) {
    try {
      await mongoServer.stop();
      console.log('✅ MongoDB Memory Server stopped');
    } catch (error) {
      console.warn('⚠️ Error stopping MongoDB Memory Server:', error);
    }
  }
};
