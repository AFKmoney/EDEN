/**
 * WebSocket Service
 * Real-time communication for agent executions and notifications
 */

import { Server as HttpServer } from 'http';
import { Server as HttpsServer } from 'https';
import { Server, Socket } from 'socket.io';
import { DefaultEventsMap } from 'socket.io/dist/typed-events';
import { agentService } from './AgentService';
import { authenticate, extractUserIdFromToken } from '../middleware/auth';
import { logger, createContextLogger } from '../utils/logger';
import { recordAgentExecution } from '../utils/metrics';

// Configuration
const NODE_ENV = process.env.NODE_ENV || 'development';
const WS_PORT = parseInt(process.env.WS_PORT || '4001');
const WS_PATH = process.env.WS_PATH || '/socket.io';
const WS_CORS_ORIGIN = process.env.WS_CORS_ORIGIN || '*';
const WS_MAX_CONNECTIONS = parseInt(process.env.WS_MAX_CONNECTIONS || '1000');

// Context logger
const log = createContextLogger('WebSocketService');

// WebSocket event types
export type WebSocketEventType = 
  | 'connection'
  | 'disconnect'
  | 'error'
  | 'agent:execute'
  | 'agent:execution_start'
  | 'agent:execution_progress'
  | 'agent:execution_complete'
  | 'agent:execution_error'
  | 'agent:status_change'
  | 'template:update'
  | 'template:like'
  | 'template:download'
  | 'notification'
  | 'message';

// WebSocket message types
export interface WebSocketMessage {
  type: WebSocketEventType;
  data: any;
  timestamp: number;
  requestId?: string;
}

// WebSocket error types
export interface WebSocketError {
  error: string;
  code: string;
  details?: any;
  timestamp: number;
}

// Connected clients
const connectedClients = new Map<string, {
  socket: Socket;
  userId: string;
  rooms: Set<string>;
  lastPing: number;
  metadata: any;
}>();

// Active executions
const activeExecutions = new Map<string, {
  agentId: string;
  userId: string;
  socketId: string;
  startTime: number;
  status: 'running' | 'completed' | 'error';
  progress: number;
  result?: any;
  error?: string;
}>();

/**
 * WebSocket Service Interface
 */
export interface IWebSocketService {
  startServer(httpServer: HttpServer | HttpsServer): Promise<Server>;
  stopServer(): Promise<void>;
  getServer(): Server | null;
  broadcast(event: WebSocketEventType, data: any, room?: string): void;
  sendToUser(userId: string, event: WebSocketEventType, data: any): void;
  joinRoom(socketId: string, room: string): void;
  leaveRoom(socketId: string, room: string): void;
  getClientCount(): number;
  getClientsInRoom(room: string): string[];
  executeAgent(socket: Socket, data: { agentId: string; input?: any; requestId?: string }): Promise<void>;
}

/**
 * WebSocket Service Implementation
 */
export class WebSocketService implements IWebSocketService {
  private io: Server | null = null;
  private server: HttpServer | HttpsServer | null = null;

  /**
   * Start WebSocket server
   */
  async startServer(httpServer: HttpServer | HttpsServer): Promise<Server> {
    try {
      log.info('Starting WebSocket server...');

      // Create Socket.IO server
      this.server = httpServer;
      this.io = new Server(this.server, {
        path: WS_PATH,
        cors: {
          origin: WS_CORS_ORIGIN,
          methods: ['GET', 'POST'],
          allowedHeaders: ['Authorization', 'Content-Type'],
          credentials: true,
        },
        maxHttpBufferSize: 10e6, // 10MB
        pingInterval: 25000,
        pingTimeout: 5000,
        connectionStateRecovery: {
          maxDisconnectionDuration: 2 * 60 * 1000, // 2 minutes
          skipMiddlewares: false,
        },
        adapter: this.createAdapter(),
      });

      // Configure connection handling
      this.setupConnectionHandlers();

      // Start listening if not already attached to HTTP server
      if (!this.server.listening) {
        await new Promise<void>((resolve, reject) => {
          this.server?.listen(WS_PORT, () => {
            log.info(`WebSocket server listening on port ${WS_PORT}`);
            resolve();
          });
          
          this.server?.on('error', (err: Error) => {
            log.error('WebSocket server error', {}, err);
            reject(err);
          });
        });
      } else {
        log.info('WebSocket server attached to existing HTTP server');
      }

      return this.io;
    } catch (error: any) {
      log.error('Failed to start WebSocket server', {}, error);
      throw error;
    }
  }

  /**
   * Stop WebSocket server
   */
  async stopServer(): Promise<void> {
    try {
      log.info('Stopping WebSocket server...');

      if (this.io) {
        // Close all connections
        this.io.close();
        this.io = null;
      }

      if (this.server) {
        this.server.close();
        this.server = null;
      }

      // Clear connected clients
      connectedClients.clear();
      activeExecutions.clear();

      log.info('WebSocket server stopped');
    } catch (error: any) {
      log.error('Failed to stop WebSocket server', {}, error);
      throw error;
    }
  }

  /**
   * Get WebSocket server instance
   */
  getServer(): Server | null {
    return this.io;
  }

  /**
   * Create Socket.IO adapter
   */
  private createAdapter() {
    // In production, you might want to use a Redis adapter for scaling
    if (NODE_ENV === 'production') {
      try {
        const { createAdapter } = require('@socket.io/redis-adapter');
        const { getRedisClient } = require('../config/database');
        const redis = getRedisClient();
        return createAdapter(redis, redis.duplicate());
      } catch (error: any) {
        log.warn('Could not create Redis adapter, using in-memory', { error: error.message });
      }
    }
    return undefined;
  }

  /**
   * Setup connection handlers
   */
  private setupConnectionHandlers() {
    if (!this.io) return;

    // Connection
    this.io.on('connection', (socket: Socket) => {
      this.handleConnection(socket);
    });

    // Connection error
    this.io.engine.on('connection_error', (err: Error) => {
      log.error('WebSocket connection error', {}, err);
    });

    // New connection attempt
    this.io.engine.on('headers', (headers: any, req: any) => {
      log.debug('WebSocket connection attempt', { headers });
    });
  }

  /**
   * Handle new connection
   */
  private handleConnection(socket: Socket) {
    const socketId = socket.id;
    const clientIp = socket.handshake.address;
    const userAgent = socket.handshake.headers['user-agent'] || '';

    log.info('New WebSocket connection', {
      socketId,
      clientIp,
      userAgent,
      headers: socket.handshake.headers,
    });

    // Store client info
    connectedClients.set(socketId, {
      socket,
      userId: '',
      rooms: new Set(),
      lastPing: Date.now(),
      metadata: {
        ip: clientIp,
        userAgent,
        connectedAt: Date.now(),
      },
    });

    // Authentication
    this.handleAuthentication(socket);

    // Setup event handlers
    this.setupSocketHandlers(socket);

    // Connection stats
    log.info('Connection stats', {
      totalConnections: connectedClients.size,
      maxConnections: WS_MAX_CONNECTIONS,
    });

    // Send welcome message
    this.sendMessage(socket, 'connection', {
      message: 'Connected to EDEN WebSocket',
      socketId,
      timestamp: Date.now(),
    });
  }

  /**
   * Handle authentication
   */
  private handleAuthentication(socket: Socket) {
    const socketId = socket.id;
    const client = connectedClients.get(socketId);
    if (!client) return;

    // Try to authenticate from handshake headers
    const authHeader = socket.handshake.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      try {
        const userId = extractUserIdFromToken(token);
        if (userId) {
          client.userId = userId;
          client.metadata.userId = userId;
          
          // Join user's personal room
          this.joinRoom(socketId, `user:${userId}`);
          
          log.info('Client authenticated', {
            socketId,
            userId,
          });
          
          // Send authentication success
          this.sendMessage(socket, 'connection', {
            message: 'Authenticated',
            userId,
            authenticated: true,
          });
          
          return;
        }
      } catch (error: any) {
        log.warn('Authentication failed', {
          socketId,
          error: error.message,
        });
      }
    }

    // Not authenticated
    log.warn('Client connected without authentication', { socketId });
    
    // Send authentication required message
    this.sendMessage(socket, 'connection', {
      message: 'Authentication required',
      authenticated: false,
    });
  }

  /**
   * Setup socket event handlers
   */
  private setupSocketHandlers(socket: Socket) {
    const socketId = socket.id;
    const client = connectedClients.get(socketId);
    if (!client) return;

    // Disconnect handler
    socket.on('disconnect', (reason: string) => {
      this.handleDisconnect(socket, reason);
    });

    // Error handler
    socket.on('error', (error: Error) => {
      this.handleError(socket, error);
    });

    // Ping/pong for keepalive
    socket.on('ping', () => {
      if (client) {
        client.lastPing = Date.now();
      }
    });

    // Agent execution request
    socket.on('agent:execute', async (data: { agentId: string; input?: any; requestId?: string }) => {
      await this.executeAgent(socket, data);
    });

    // Join room
    socket.on('join', (room: string | string[]) => {
      if (Array.isArray(room)) {
        room.forEach(r => this.joinRoom(socketId, r));
      } else {
        this.joinRoom(socketId, room);
      }
    });

    // Leave room
    socket.on('leave', (room: string | string[]) => {
      if (Array.isArray(room)) {
        room.forEach(r => this.leaveRoom(socketId, r));
      } else {
        this.leaveRoom(socketId, room);
      }
    });

    // Subscribe to agent updates
    socket.on('subscribe:agent', (agentId: string) => {
      this.joinRoom(socketId, `agent:${agentId}`);
    });

    // Unsubscribe from agent updates
    socket.on('unsubscribe:agent', (agentId: string) => {
      this.leaveRoom(socketId, `agent:${agentId}`);
    });

    // Subscribe to template updates
    socket.on('subscribe:template', (templateId: string) => {
      this.joinRoom(socketId, `template:${templateId}`);
    });

    // Unsubscribe from template updates
    socket.on('unsubscribe:template', (templateId: string) => {
      this.leaveRoom(socketId, `template:${templateId}`);
    });

    // Custom message
    socket.on('message', (data: any) => {
      log.debug('Received message', {
        socketId,
        userId: client.userId,
        data,
      });
    });
  }

  /**
   * Handle disconnect
   */
  private handleDisconnect(socket: Socket, reason: string) {
    const socketId = socket.id;
    const client = connectedClients.get(socketId);
    
    if (client) {
      log.info('Client disconnected', {
        socketId,
        userId: client.userId,
        reason,
        connectedFor: Date.now() - (client.metadata.connectedAt || Date.now()),
      });

      // Remove from connected clients
      connectedClients.delete(socketId);

      // Clean up active executions for this client
      for (const [executionId, execution] of activeExecutions.entries()) {
        if (execution.socketId === socketId) {
          activeExecutions.delete(executionId);
          
          // Notify that execution was cancelled
          this.broadcast('agent:execution_error', {
            executionId,
            agentId: execution.agentId,
            error: 'Client disconnected',
            code: 'CLIENT_DISCONNECTED',
          }, `agent:${execution.agentId}`);
        }
      }
    }

    log.info('Connection stats', {
      totalConnections: connectedClients.size,
    });
  }

  /**
   * Handle error
   */
  private handleError(socket: Socket, error: Error) {
    const socketId = socket.id;
    const client = connectedClients.get(socketId);
    
    log.error('WebSocket error', {
      socketId,
      userId: client?.userId,
      error: error.message,
      stack: error.stack,
    });

    // Send error to client
    this.sendError(socket, {
      error: error.message,
      code: 'WS_ERROR',
      details: { message: error.message },
      timestamp: Date.now(),
    });
  }

  /**
   * Send message to socket
   */
  private sendMessage(socket: Socket, type: WebSocketEventType, data: any, requestId?: string) {
    try {
      const message: WebSocketMessage = {
        type,
        data,
        timestamp: Date.now(),
        requestId,
      };

      socket.emit(type, message);
      
      log.debug('Message sent', {
        socketId: socket.id,
        type,
        requestId,
      });
    } catch (error: any) {
      log.error('Failed to send message', {
        socketId: socket.id,
        type,
        error: error.message,
      });
    }
  }

  /**
   * Send error to socket
   */
  private sendError(socket: Socket, error: WebSocketError) {
    try {
      socket.emit('error', error);
      
      log.debug('Error sent', {
        socketId: socket.id,
        error: error.error,
      });
    } catch (error: any) {
      log.error('Failed to send error', {
        socketId: socket.id,
        error: error.message,
      });
    }
  }

  /**
   * Broadcast message to all clients or specific room
   */
  broadcast(event: WebSocketEventType, data: any, room?: string): void {
    if (!this.io) return;

    const message: WebSocketMessage = {
      type: event,
      data,
      timestamp: Date.now(),
    };

    if (room) {
      this.io.to(room).emit(event, message);
      log.debug('Broadcast to room', { event, room, clientCount: this.getClientsInRoom(room).length });
    } else {
      this.io.emit(event, message);
      log.debug('Broadcast to all', { event, clientCount: connectedClients.size });
    }
  }

  /**
   * Send message to specific user
   */
  sendToUser(userId: string, event: WebSocketEventType, data: any): void {
    const room = `user:${userId}`;
    this.broadcast(event, data, room);
  }

  /**
   * Join room
   */
  joinRoom(socketId: string, room: string): void {
    const client = connectedClients.get(socketId);
    if (!client) return;

    client.socket.join(room);
    client.rooms.add(room);
    
    log.debug('Client joined room', {
      socketId,
      userId: client.userId,
      room,
      rooms: Array.from(client.rooms),
    });
  }

  /**
   * Leave room
   */
  leaveRoom(socketId: string, room: string): void {
    const client = connectedClients.get(socketId);
    if (!client) return;

    client.socket.leave(room);
    client.rooms.delete(room);
    
    log.debug('Client left room', {
      socketId,
      userId: client.userId,
      room,
      rooms: Array.from(client.rooms),
    });
  }

  /**
   * Get client count
   */
  getClientCount(): number {
    return connectedClients.size;
  }

  /**
   * Get clients in room
   */
  getClientsInRoom(room: string): string[] {
    if (!this.io) return [];
    
    const sockets = this.io.sockets.adapter.sockets(new Set([room]));
    return Array.from(sockets.keys());
  }

  /**
   * Execute agent via WebSocket
   */
  async executeAgent(socket: Socket, data: { agentId: string; input?: any; requestId?: string }): Promise<void> {
    const socketId = socket.id;
    const client = connectedClients.get(socketId);
    
    if (!client) {
      this.sendError(socket, {
        error: 'Not connected',
        code: 'NOT_CONNECTED',
        timestamp: Date.now(),
      });
      return;
    }

    if (!client.userId) {
      this.sendError(socket, {
        error: 'Authentication required',
        code: 'UNAUTHENTICATED',
        timestamp: Date.now(),
      });
      return;
    }

    const { agentId, input, requestId } = data;
    const executionId = requestId || `exec_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    try {
      // Notify execution start
      this.sendMessage(socket, 'agent:execution_start', {
        executionId,
        agentId,
        message: 'Agent execution started',
      }, executionId);

      // Join agent room for updates
      this.joinRoom(socketId, `agent:${agentId}`);

      // Store execution info
      activeExecutions.set(executionId, {
        agentId,
        userId: client.userId,
        socketId,
        startTime: Date.now(),
        status: 'running',
        progress: 0,
      });

      // Simulate agent execution (in a real implementation, this would be async)
      const startTime = Date.now();

      // Simulate progress updates
      for (let i = 0; i <= 100; i += 25) {
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Update progress
        const execution = activeExecutions.get(executionId);
        if (execution) {
          execution.progress = i;
          
          // Send progress update
          this.sendMessage(socket, 'agent:execution_progress', {
            executionId,
            agentId,
            progress: i,
            message: `Execution ${i}% complete`,
          }, executionId);

          // Broadcast to agent room
          this.broadcast('agent:execution_progress', {
            executionId,
            agentId,
            progress: i,
            userId: client.userId,
          }, `agent:${agentId}`);
        }
      }

      // Simulate completion
      const executionTime = Date.now() - startTime;
      const result = {
        message: 'Agent executed successfully',
        executionTime,
        data: { input, processed: true },
      };

      // Update execution
      const execution = activeExecutions.get(executionId);
      if (execution) {
        execution.status = 'completed';
        execution.result = result;
        execution.progress = 100;
      }

      // Record metrics
      recordAgentExecution(agentId, executionTime / 1000, true);

      // Send completion message
      this.sendMessage(socket, 'agent:execution_complete', {
        executionId,
        agentId,
        result,
        executionTime,
      }, executionId);

      // Broadcast to agent room
      this.broadcast('agent:execution_complete', {
        executionId,
        agentId,
        result,
        executionTime,
        userId: client.userId,
      }, `agent:${agentId}`);

      // Clean up after a delay
      setTimeout(() => {
        activeExecutions.delete(executionId);
      }, 5000);

    } catch (error: any) {
      // Update execution
      const execution = activeExecutions.get(executionId);
      if (execution) {
        execution.status = 'error';
        execution.error = error.message;
      }

      // Record metrics
      recordAgentExecution(agentId, (Date.now() - startTime) / 1000, false);

      // Send error message
      this.sendMessage(socket, 'agent:execution_error', {
        executionId,
        agentId,
        error: error.message,
        code: 'EXECUTION_ERROR',
      }, executionId);

      // Broadcast to agent room
      this.broadcast('agent:execution_error', {
        executionId,
        agentId,
        error: error.message,
        code: 'EXECUTION_ERROR',
        userId: client.userId,
      }, `agent:${agentId}`);

      // Clean up
      activeExecutions.delete(executionId);
    }
  }
}

// Singleton instance
export const webSocketService = new WebSocketService();
export default webSocketService;
