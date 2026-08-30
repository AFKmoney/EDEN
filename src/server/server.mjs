/**
 * EDEN Backend Server - ES Module Entry Point
 * This file is used for running the server with SSR
 */

import { createServer } from 'http';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Import the server
import app from './index.js';

// Configuration
const PORT = process.env.PORT || 4000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Create HTTP server
const server = createServer(app);

// Start server
server.listen(PORT, '0.0.0.0', () => {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   ███████╗██████╗███████╗███╗   ██╗███████╗                ║
║   ██╔════╝██╔══██╗██╔════╝████╗  ██║██╔════╝                ║
║   ███████╗██████╔╝█████╗  ██╔██╗ ██║█████╗                  ║
║   ╚════██║██╔══██╗██╔══╝  ██║╚██╗██║██╔══╝                  ║
║   ███████║██║  ██║███████╗██║ ╚████║███████╗                ║
║   ╚══════╝╚═╝  ╚═╝╚══════╝╚═╝  ╚═══╝╚══════╝                ║
║                                                           ║
║   EDEN Backend Server (ES Module)                         ║
║   Version: 1.0.0                                         ║
║   Environment: ${NODE_ENV}                                ║
║   Port: ${PORT}                                          ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
    `);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    console.log('Server closed.');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received. Shutting down gracefully...');
  server.close(() => {
    console.log('Server closed.');
    process.exit(0);
  });
});

export default server;
