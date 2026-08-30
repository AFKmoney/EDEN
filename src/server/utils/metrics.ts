/**
 * Metrics Service
 * Prometheus metrics for monitoring
 */

import client from 'prom-client';

// Configuration
const NODE_ENV = process.env["NODE_ENV"] || 'development';
const ENABLE_METRICS = process.env["ENABLE_METRICS"] !== 'false';

// Metrics registry
const register = new client.Registry();

// ============================================
// HTTP Metrics
// ============================================

// Request counter
const httpRequestsTotal = new client.Counter({
  name: 'eden_http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'path', 'status'],
  registers: [register],
});

// Request duration
const httpRequestDuration = new client.Histogram({
  name: 'eden_http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'path', 'status'],
  buckets: [0.001, 0.01, 0.1, 0.5, 1, 2, 5, 10],
  registers: [register],
});

// Request size
const httpRequestSize = new client.Histogram({
  name: 'eden_http_request_size_bytes',
  help: 'Size of HTTP requests in bytes',
  labelNames: ['method', 'path'],
  buckets: [100, 1000, 10000, 100000, 1000000, 10000000],
  registers: [register],
});

// Response size
const httpResponseSize = new client.Histogram({
  name: 'eden_http_response_size_bytes',
  help: 'Size of HTTP responses in bytes',
  labelNames: ['method', 'path', 'status'],
  buckets: [100, 1000, 10000, 100000, 1000000, 10000000],
  registers: [register],
});

// Active connections
const httpActiveConnections = new client.Gauge({
  name: 'eden_http_active_connections',
  help: 'Number of active HTTP connections',
  registers: [register],
});

// ============================================
// Database Metrics
// ============================================

// MongoDB query counter
const mongoQueriesTotal = new client.Counter({
  name: 'eden_mongodb_queries_total',
  help: 'Total number of MongoDB queries',
  labelNames: ['operation', 'model', 'status'],
  registers: [register],
});

// MongoDB query duration
const mongoQueryDuration = new client.Histogram({
  name: 'eden_mongodb_query_duration_seconds',
  help: 'Duration of MongoDB queries in seconds',
  labelNames: ['operation', 'model'],
  buckets: [0.001, 0.01, 0.1, 0.5, 1, 2, 5],
  registers: [register],
});

// MongoDB connection pool
const mongoConnectionPool = new client.Gauge({
  name: 'eden_mongodb_connection_pool',
  help: 'MongoDB connection pool statistics',
  labelNames: ['state'],
  registers: [register],
});

// Redis command counter
const redisCommandsTotal = new client.Counter({
  name: 'eden_redis_commands_total',
  help: 'Total number of Redis commands',
  labelNames: ['command', 'status'],
  registers: [register],
});

// Redis command duration
const redisCommandDuration = new client.Histogram({
  name: 'eden_redis_command_duration_seconds',
  help: 'Duration of Redis commands in seconds',
  labelNames: ['command'],
  buckets: [0.001, 0.01, 0.1, 0.5, 1],
  registers: [register],
});

// Redis memory usage
const redisMemoryUsage = new client.Gauge({
  name: 'eden_redis_memory_usage_bytes',
  help: 'Redis memory usage in bytes',
  registers: [register],
});

// ============================================
// Application Metrics
// ============================================

// User counter
const usersTotal = new client.Counter({
  name: 'eden_users_total',
  help: 'Total number of users',
  labelNames: ['role'],
  registers: [register],
});

// Active users
const activeUsers = new client.Gauge({
  name: 'eden_active_users',
  help: 'Number of active users',
  registers: [register],
});

// Agent counter
const agentsTotal = new client.Counter({
  name: 'eden_agents_total',
  help: 'Total number of agents',
  labelNames: ['isPublic', 'category'],
  registers: [register],
});

// Agent executions
const agentExecutionsTotal = new client.Counter({
  name: 'eden_agent_executions_total',
  help: 'Total number of agent executions',
  labelNames: ['status'],
  registers: [register],
});

// Agent execution duration
const agentExecutionDuration = new client.Histogram({
  name: 'eden_agent_execution_duration_seconds',
  help: 'Duration of agent executions in seconds',
  labelNames: ['agentId', 'status'],
  buckets: [0.001, 0.01, 0.1, 0.5, 1, 5, 10, 30, 60],
  registers: [register],
});

// Template counter
const templatesTotal = new client.Counter({
  name: 'eden_templates_total',
  help: 'Total number of templates',
  labelNames: ['isPublic', 'category'],
  registers: [register],
});

// Template downloads
const templateDownloadsTotal = new client.Counter({
  name: 'eden_template_downloads_total',
  help: 'Total number of template downloads',
  labelNames: ['templateId'],
  registers: [register],
});

// Template likes
const templateLikesTotal = new client.Counter({
  name: 'eden_template_likes_total',
  help: 'Total number of template likes',
  labelNames: ['templateId'],
  registers: [register],
});

// Webhook counter
const webhooksTotal = new client.Counter({
  name: 'eden_webhooks_total',
  help: 'Total number of webhooks',
  labelNames: ['source', 'isActive'],
  registers: [register],
});

// Webhook events
const webhookEventsTotal = new client.Counter({
  name: 'eden_webhook_events_total',
  help: 'Total number of webhook events',
  labelNames: ['source', 'type', 'status'],
  registers: [register],
});

// Webhook event duration
const webhookEventDuration = new client.Histogram({
  name: 'eden_webhook_event_duration_seconds',
  help: 'Duration of webhook event processing in seconds',
  labelNames: ['source', 'type', 'status'],
  buckets: [0.001, 0.01, 0.1, 0.5, 1, 5, 10],
  registers: [register],
});

// ============================================
// System Metrics
// ============================================

// Memory usage
const memoryUsage = new client.Gauge({
  name: 'eden_memory_usage_bytes',
  help: 'Memory usage in bytes',
  labelNames: ['type'],
  registers: [register],
});

// CPU usage
const cpuUsage = new client.Gauge({
  name: 'eden_cpu_usage',
  help: 'CPU usage percentage',
  registers: [register],
});

// Event loop lag
const eventLoopLag = new client.Gauge({
  name: 'eden_event_loop_lag_seconds',
  help: 'Event loop lag in seconds',
  registers: [register],
});

// ============================================
// Metrics Middleware
// ============================================

/**
 * Express middleware for HTTP metrics
 */
export function metricsMiddleware(req: any, res: any, next: any) {
  if (!ENABLE_METRICS) {
    return next();
  }

  const start = process.hrtime.bigint();
  const startTime = Date.now();

  // Track active connections
  httpActiveConnections.inc();

  // Track request size
  const requestSize = req.headers['content-length'] || 0;
  httpRequestSize.observe({ method: req.method, path: req.path }, parseInt(requestSize));

  // Response size tracking
  const originalWrite = res.write;
  const originalEnd = res.end;
  let responseSize = 0;

  res.write = function (chunk: any) {
    if (chunk) {
      responseSize += chunk.length;
    }
    return originalWrite.apply(res, arguments as any);
  };

  res.end = function (chunk: any) {
    if (chunk) {
      responseSize += chunk.length;
    }
    
    // Record metrics
    const duration = process.hrtime.bigint() - start;
    const durationSeconds = Number(duration) / 1e9;
    const status = res.statusCode || 200;

    httpRequestsTotal.inc({ method: req.method, path: req.path, status: status.toString() });
    httpRequestDuration.observe({ method: req.method, path: req.path, status: status.toString() }, durationSeconds);
    httpResponseSize.observe({ method: req.method, path: req.path, status: status.toString() }, responseSize);
    httpActiveConnections.dec();

    return originalEnd.apply(res, arguments as any);
  };

  // Handle errors
  const originalEmit = res.emit;
  res.emit = function (event: string, ...args: any[]) {
    if (event === 'error') {
      const duration = process.hrtime.bigint() - start;
      const durationSeconds = Number(duration) / 1e9;
      const status = 500;

      httpRequestsTotal.inc({ method: req.method, path: req.path, status: status.toString() });
      httpRequestDuration.observe({ method: req.method, path: req.path, status: status.toString() }, durationSeconds);
      httpActiveConnections.dec();
    }
    return originalEmit.apply(res, [event, ...args]);
  };

  // Handle close
  res.on('finish', () => {
    httpActiveConnections.dec();
  });

  next();
}

// ============================================
// Metrics Endpoint
// ============================================

/**
 * Get Prometheus metrics
 */
export async function getMetrics(req: any, res: any) {
  if (!ENABLE_METRICS) {
    return res.status(404).json({ error: 'Metrics disabled' });
  }

  try {
    res.set('Content-Type', register.contentType);
    const metrics = await register.metrics();
    res.end(metrics);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

/**
 * Get metrics summary
 */
export async function getMetricsSummary(req: any, res: any) {
  if (!ENABLE_METRICS) {
    return res.status(404).json({ error: 'Metrics disabled' });
  }

  try {
    // Collect all metrics
    const metrics = await register.getMetricsAsJSON();
    
    // Extract summary
    const summary: any = {
      timestamp: Date.now(),
      http: {
        requestsTotal: 0,
        averageRequestDuration: 0,
        activeConnections: httpActiveConnections.get() || 0,
      },
      database: {
        mongoQueriesTotal: 0,
        redisCommandsTotal: 0,
      },
      application: {
        usersTotal: 0,
        agentsTotal: 0,
        templatesTotal: 0,
        webhooksTotal: 0,
        agentExecutionsTotal: 0,
        templateDownloadsTotal: 0,
      },
      system: {
        memory: process.memoryUsage(),
        cpu: process.cpuUsage(process.cpuUsage() as any),
        uptime: process.uptime(),
      },
    };

    res.json({ success: true, summary });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

// ============================================
// Metrics Utilities
// ============================================

/**
 * Record MongoDB query metrics
 */
export function recordMongoQuery(operation: string, model: string, duration: number, success: boolean) {
  if (!ENABLE_METRICS) return;

  mongoQueriesTotal.inc({ operation, model, status: success ? 'success' : 'error' });
  mongoQueryDuration.observe({ operation, model }, duration);
}

/**
 * Record Redis command metrics
 */
export function recordRedisCommand(command: string, duration: number, success: boolean) {
  if (!ENABLE_METRICS) return;

  redisCommandsTotal.inc({ command, status: success ? 'success' : 'error' });
  redisCommandDuration.observe({ command }, duration);
}

/**
 * Record agent execution metrics
 */
export function recordAgentExecution(agentId: string, duration: number, success: boolean) {
  if (!ENABLE_METRICS) return;

  agentExecutionsTotal.inc({ status: success ? 'success' : 'error' });
  agentExecutionDuration.observe({ agentId, status: success ? 'success' : 'error' }, duration);
}

/**
 * Record template download metrics
 */
export function recordTemplateDownload(templateId: string) {
  if (!ENABLE_METRICS) return;

  templateDownloadsTotal.inc({ templateId });
}

/**
 * Record template like metrics
 */
export function recordTemplateLike(templateId: string) {
  if (!ENABLE_METRICS) return;

  templateLikesTotal.inc({ templateId });
}

/**
 * Record webhook event metrics
 */
export function recordWebhookEvent(source: string, type: string, duration: number, success: boolean) {
  if (!ENABLE_METRICS) return;

  webhookEventsTotal.inc({ source, type, status: success ? 'success' : 'error' });
  webhookEventDuration.observe({ source, type, status: success ? 'success' : 'error' }, duration);
}

/**
 * Update MongoDB connection pool metrics
 */
export function updateMongoConnectionPool(pool: any) {
  if (!ENABLE_METRICS) return;

  if (pool) {
    mongoConnectionPool.set({ state: 'totalCreated' }, pool.totalCreated || 0);
    mongoConnectionPool.set({ state: 'totalInUse' }, pool.totalInUse || 0);
    mongoConnectionPool.set({ state: 'totalAvailable' }, pool.totalAvailable || 0);
    mongoConnectionPool.set({ state: 'totalPoolSize' }, pool.totalPoolSize || 0);
  }
}

/**
 * Update Redis memory metrics
 */
export function updateRedisMemory(info: any) {
  if (!ENABLE_METRICS) return;

  if (info && info.used_memory) {
    redisMemoryUsage.set(info.used_memory);
  }
}

/**
 * Update system metrics
 */
export function updateSystemMetrics() {
  if (!ENABLE_METRICS) return;

  const memUsage = process.memoryUsage();
  memoryUsage.set({ type: 'rss' }, memUsage.rss);
  memoryUsage.set({ type: 'heapTotal' }, memUsage.heapTotal);
  memoryUsage.set({ type: 'heapUsed' }, memUsage.heapUsed);
  memoryUsage.set({ type: 'external' }, memUsage.external);

  const cpu = process.cpuUsage(process.cpuUsage() as any);
  cpuUsage.set(cpu.user + cpu.system);
}

// ============================================
// Collect Default Metrics
// ============================================

// Collect default Node.js metrics
client.collectDefaultMetrics({
  register,
  gcDurationBuckets: [0.001, 0.1, 1, 2, 5, 10],
});

// ============================================
// Export Metrics
// ============================================

export {
  register,
  ENABLE_METRICS,
  httpRequestsTotal,
  httpRequestDuration,
  httpRequestSize,
  httpResponseSize,
  httpActiveConnections,
  mongoQueriesTotal,
  mongoQueryDuration,
  mongoConnectionPool,
  redisCommandsTotal,
  redisCommandDuration,
  redisMemoryUsage,
  usersTotal,
  activeUsers,
  agentsTotal,
  agentExecutionsTotal,
  agentExecutionDuration,
  templatesTotal,
  templateDownloadsTotal,
  templateLikesTotal,
  webhooksTotal,
  webhookEventsTotal,
  webhookEventDuration,
  memoryUsage,
  cpuUsage,
  eventLoopLag,
};
