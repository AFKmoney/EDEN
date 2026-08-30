/**
 * Monitoring Middleware
 * Prometheus metrics and health checks
 */

import { Request, Response, NextFunction } from 'express';
import { getMetrics, getMetricsSummary, metricsMiddleware, updateSystemMetrics } from '../utils/metrics';
import { requestLogger, errorLogger } from '../utils/logger';

// Configuration
const ENABLE_MONITORING = process.env["ENABLE_MONITORING"] !== 'false';
const HEALTH_CHECK_PATH = process.env["HEALTH_CHECK_PATH"] || '/api/health';
const METRICS_PATH = process.env["METRICS_PATH"] || '/api/metrics';
const METRICS_SUMMARY_PATH = process.env["METRICS_SUMMARY_PATH"] || '/api/metrics/summary';

/**
 * Health check middleware
 */
export function healthCheck(req: Request, res: Response, next: NextFunction) {
  if (req.path === HEALTH_CHECK_PATH) {
    // Basic health check
    res.json({
      status: 'ok',
      timestamp: Date.now(),
      version: process.env["npm_package_version"] || '1.0.0',
      environment: process.env["NODE_ENV"] || 'development',
      uptime: process.uptime(),
      memory: process.memoryUsage(),
    });
    return;
  }
  next();
}

/**
 * Detailed health check with database connectivity
 */
export function detailedHealthCheck(req: Request, res: Response, next: NextFunction) {
  if (req.path === HEALTH_CHECK_PATH) {
    // Import here to avoid circular dependencies
    const { getMongoDBStatus, getRedisStatus } = require('../config/database');

    const health: any = {
      status: 'ok',
      timestamp: Date.now(),
      version: process.env["npm_package_version"] || '1.0.0',
      environment: process.env["NODE_ENV"] || 'development',
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      services: {
        mongodb: {
          status: getMongoDBStatus(),
        },
        redis: {
          status: getRedisStatus(),
        },
      },
    };

    // Check if any service is down
    if (health.services.mongodb.status !== 'connected') {
      health.status = 'degraded';
      health.errors = health.errors || [];
      health.errors.push('MongoDB not connected');
    }

    if (health.services.redis.status !== 'connected') {
      health.status = 'degraded';
      health.errors = health.errors || [];
      health.errors.push('Redis not connected');
    }

    // Check memory usage
    if (health.memory.heapUsed / health.memory.heapTotal > 0.9) {
      health.status = 'warning';
      health.errors = health.errors || [];
      health.errors.push('High memory usage');
    }

    // Check if health is not ok
    if (health.status !== 'ok') {
      return res.status(503).json(health);
    }

    return res.json(health);
  }
  next();
}

/**
 * Metrics endpoint
 */
export function metricsEndpoint(req: Request, res: Response, next: NextFunction) {
  if (req.path === METRICS_PATH) {
    return getMetrics(req, res);
  }
  next();
}

/**
 * Metrics summary endpoint
 */
export function metricsSummaryEndpoint(req: Request, res: Response, next: NextFunction) {
  if (req.path === METRICS_SUMMARY_PATH) {
    return getMetricsSummary(req, res);
  }
  next();
}

/**
 * System metrics updater
 */
export function systemMetricsUpdater() {
  if (!ENABLE_MONITORING) return;

  // Update system metrics every 5 seconds
  setInterval(() => {
    try {
      updateSystemMetrics();
    } catch (error: any) {
      console.error('Error updating system metrics:', error);
    }
  }, 5000);

  // Initial update
  updateSystemMetrics();
}

/**
 * Request monitoring middleware
 */
export function requestMonitoring(req: Request, res: Response, next: NextFunction) {
  if (!ENABLE_MONITORING) {
    return next();
  }

  // Use metrics middleware
  metricsMiddleware(req, res, next);
}

/**
 * Error monitoring middleware
 */
export function errorMonitoring(err: Error, req: Request, res: Response, next: NextFunction) {
  if (!ENABLE_MONITORING) {
    return next(err);
  }

  // Log error
  errorLogger(err, req, res, next);

  // Record error metric
  const { httpRequestsTotal } = require('../utils/metrics');
  httpRequestsTotal.inc({ method: req.method, path: req.path, status: '500' });

  next(err);
}

/**
 * Response time header middleware
 */
export function responseTimeHeader(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    res.setHeader('X-Response-Time', `${duration}ms`);
  });

  res.on('close', () => {
    const duration = Date.now() - start;
    res.setHeader('X-Response-Time', `${duration}ms`);
  });

  next();
}

/**
 * Request ID middleware
 */
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction) {
  const requestId = req.headers['x-request-id'] as string || require('crypto').randomUUID();
  
  // Set request ID on response
  res.setHeader('X-Request-ID', requestId);
  
  // Store request ID on request object
  (req as any).requestId = requestId;
  
  next();
}

/**
 * Correlation ID middleware
 */
export function correlationIdMiddleware(req: Request, res: Response, next: NextFunction) {
  const correlationId = req.headers['x-correlation-id'] as string || require('crypto').randomUUID();
  
  // Set correlation ID on response
  res.setHeader('X-Correlation-ID', correlationId);
  
  // Store correlation ID on request object
  (req as any).correlationId = correlationId;
  
  next();
}

/**
 * Security headers middleware
 */
export function securityHeaders(req: Request, res: Response, next: NextFunction) {
  // Set security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  
  next();
}

/**
 * Cache control middleware
 */
export function cacheControl(req: Request, res: Response, next: NextFunction) {
  // Set cache control for API endpoints
  if (req.path.startsWith('/api/')) {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
  
  next();
}

/**
 * Initialize monitoring
 */
export function initializeMonitoring(app: any) {
  if (!ENABLE_MONITORING) {
    console.log('⚠️ Monitoring is disabled');
    return;
  }

  console.log('✅ Initializing monitoring...');

  // Start system metrics updater
  systemMetricsUpdater();

  // Add monitoring middleware
  app.use(requestIdMiddleware);
  app.use(correlationIdMiddleware);
  app.use(responseTimeHeader);
  app.use(securityHeaders);
  app.use(cacheControl);
  app.use(requestMonitoring);
  app.use(requestLogger);

  // Add error monitoring
  app.use(errorMonitoring);

  // Add health check endpoint
  app.use(detailedHealthCheck);

  // Add metrics endpoints
  app.use(metricsEndpoint);
  app.use(metricsSummaryEndpoint);

  console.log('✅ Monitoring initialized');
}

export {
  ENABLE_MONITORING,
  HEALTH_CHECK_PATH,
  METRICS_PATH,
  METRICS_SUMMARY_PATH,
};
