/**
 * Jest Setup
 * Setup for test environment
 */

import { connectMongoDB } from '../src/server/config/database';

// Connect to MongoDB before tests
beforeAll(async () => {
  try {
    await connectMongoDB();
  } catch (error) {
    console.warn('Could not connect to MongoDB for tests');
  }
});

// Mock console methods to reduce noise during tests
const originalConsole = {
  log: console.log,
  warn: console.warn,
  error: console.error,
  info: console.info,
  debug: console.debug,
};

beforeEach(() => {
  // Mock console methods
  console.log = jest.fn();
  console.warn = jest.fn();
  console.error = jest.fn();
  console.info = jest.fn();
  console.debug = jest.fn();
});

afterEach(() => {
  // Restore console methods
  console.log = originalConsole.log;
  console.warn = originalConsole.warn;
  console.error = originalConsole.error;
  console.info = originalConsole.info;
  console.debug = originalConsole.debug;
  
  // Clear all mocks
  jest.clearAllMocks();
});

// Global error handler for unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});
