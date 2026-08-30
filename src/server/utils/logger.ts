/**
 * Logger Service
 * Structured logging with Winston
 */

import winston from 'winston';
import { format, transports, createLogger } from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';

// Configuration
const NODE_ENV = process.env["NODE_ENV"] || 'development';
const LOG_LEVEL = process.env["LOG_LEVEL"] || (NODE_ENV === 'production' ? 'info' : 'debug');
const LOG_DIR = process.env["LOG_DIR"] || './logs';
const ENABLE_FILE_LOGGING = process.env["ENABLE_FILE_LOGGING"] !== 'false';

// Create log directory if it doesn't exist
import fs from 'fs';
import path from 'path';

if (ENABLE_FILE_LOGGING && !fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

// Custom format for JSON logs
const jsonFormat = format.combine(
  format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  format.errors({ stack: true }),
  format.splat(),
  format.json()
);

// Custom format for console logs
const consoleFormat = format.combine(
  format.colorize(),
  format.timestamp({ format: 'HH:mm:ss.SSS' }),
  format.errors({ stack: true }),
  format.splat(),
  format.printf(({ level, message, timestamp, stack, ...meta }) => {
    let log = `${timestamp} [${level}]: ${message}`;
    
    if (Object.keys(meta).length > 0) {
      log += ` ${JSON.stringify(meta)}`;
    }
    
    if (stack) {
      log += `\n${stack}`;
    }
    
    return log;
  })
);

// Create transports
const transportsList: any[] = [
  // Console transport
  new transports.Console({
    format: consoleFormat,
    level: LOG_LEVEL,
    handleExceptions: true,
    json: false,
    colorize: true,
  }),
];

// Add file transports if enabled
if (ENABLE_FILE_LOGGING) {
  // Error logs
  transportsList.push(new DailyRotateFile({
    filename: path.join(LOG_DIR, 'error-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    maxSize: '20m',
    maxFiles: '30d',
    level: 'error',
    format: jsonFormat,
  }));

  // Combined logs
  transportsList.push(new DailyRotateFile({
    filename: path.join(LOG_DIR, 'combined-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    maxSize: '20m',
    maxFiles: '30d',
    level: LOG_LEVEL,
    format: jsonFormat,
  }));

  // Access logs
  transportsList.push(new DailyRotateFile({
    filename: path.join(LOG_DIR, 'access-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    maxSize: '20m',
    maxFiles: '30d',
    level: 'http',
    format: jsonFormat,
  }));
}

// Create logger
const logger = createLogger({
  level: LOG_LEVEL,
  levels: winston.config.npm.levels,
  format: jsonFormat,
  transports: transportsList,
  exitOnError: false,
  exceptionHandlers: [
    new transports.Console({
      format: consoleFormat,
    }),
    ...(ENABLE_FILE_LOGGING ? [
      new DailyRotateFile({
        filename: path.join(LOG_DIR, 'exceptions-%DATE%.log'),
        datePattern: 'YYYY-MM-DD',
        maxSize: '20m',
        maxFiles: '30d',
        format: jsonFormat,
      }),
    ] : []),
  ],
  rejectionHandlers: [
    new transports.Console({
      format: consoleFormat,
    }),
    ...(ENABLE_FILE_LOGGING ? [
      new DailyRotateFile({
        filename: path.join(LOG_DIR, 'rejections-%DATE%.log'),
        datePattern: 'YYYY-MM-DD',
        maxSize: '20m',
        maxFiles: '30d',
        format: jsonFormat,
      }),
    ] : []),
  ],
});

// Add stream for morgan
logger.stream = {
  write: (message: string) => {
    logger.http(message.trim());
  },
};

// ============================================
// Logger Methods
// ============================================

// Error logging
export function error(message: string, meta?: any, error?: Error) {
  if (error) {
    logger.error(message, { ...meta, error: error.message, stack: error.stack });
  } else {
    logger.error(message, meta);
  }
}

// Warn logging
export function warn(message: string, meta?: any) {
  logger.warn(message, meta);
}

// Info logging
export function info(message: string, meta?: any) {
  logger.info(message, meta);
}

// Debug logging
export function debug(message: string, meta?: any) {
  logger.debug(message, meta);
}

// HTTP logging
export function http(message: string, meta?: any) {
  logger.http(message, meta);
}

// Verbose logging
export function verbose(message: string, meta?: any) {
  logger.verbose(message, meta);
}

// Silly logging
export function silly(message: string, meta?: any) {
  logger.silly(message, meta);
}

// ============================================
// Context-aware Logger
// ============================================

/**
 * Create a context-aware logger
 */
export function createContextLogger(context: string) {
  return {
    error: (message: string, meta?: any, error?: Error) => {
      error(message, { context, ...meta }, error);
    },
    warn: (message: string, meta?: any) => {
      warn(message, { context, ...meta });
    },
    info: (message: string, meta?: any) => {
      info(message, { context, ...meta });
    },
    debug: (message: string, meta?: any) => {
      debug(message, { context, ...meta });
    },
    http: (message: string, meta?: any) => {
      http(message, { context, ...meta });
    },
    verbose: (message: string, meta?: any) => {
      verbose(message, { context, ...meta });
    },
    silly: (message: string, meta?: any) => {
      silly(message, { context, ...meta });
    },
    child: (subContext: string) => createContextLogger(`${context}:${subContext}`),
  };
}

// ============================================
// Request Logger Middleware
// ============================================

/**
 * Express middleware for request logging
 */
export function requestLogger(req: any, res: any, next: any) {
  const start = Date.now();
  const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress || req.ip;
  const userAgent = req.headers['user-agent'] || '';

  // Log request start
  http('Request started', {
    method: req.method,
    path: req.path,
    query: req.query,
    ip,
    userAgent,
    requestId: req.headers['x-request-id'] || '',
  });

  // Log request completion
  res.on('finish', () => {
    const duration = Date.now() - start;
    const status = res.statusCode;
    const contentLength = res.getHeader('content-length') || 0;

    http('Request completed', {
      method: req.method,
      path: req.path,
      status,
      duration,
      contentLength,
      ip,
      userAgent,
      requestId: req.headers['x-request-id'] || '',
    });
  });

  // Log errors
  res.on('error', (err: Error) => {
    error('Request error', {
      method: req.method,
      path: req.path,
      error: err.message,
      stack: err.stack,
      ip,
      userAgent,
      requestId: req.headers['x-request-id'] || '',
    }, err);
  });

  next();
}

// ============================================
// Error Logger
// ============================================

/**
 * Express error handler for logging
 */
export function errorLogger(err: Error, req: any, res: any, next: any) {
  const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress || req.ip;
  const userAgent = req.headers['user-agent'] || '';

  error('Unhandled error', {
    method: req.method,
    path: req.path,
    status: res.statusCode,
    error: err.message,
    stack: err.stack,
    ip,
    userAgent,
    requestId: req.headers['x-request-id'] || '',
  }, err);

  next(err);
}

// ============================================
// Audit Logger
// ============================================

// Create audit logger for security-sensitive operations
const auditLogger = createContextLogger('AUDIT');

export const audit = {
  login: (userId: string, ip: string, userAgent: string, success: boolean, reason?: string) => {
    auditLogger.info('Login attempt', {
      userId,
      ip,
      userAgent,
      success,
      reason,
    });
  },
  logout: (userId: string, ip: string, userAgent: string) => {
    auditLogger.info('Logout', {
      userId,
      ip,
      userAgent,
    });
  },
  action: (userId: string, action: string, resource: string, resourceId: string, ip: string, success: boolean, details?: any) => {
    auditLogger.info('Action performed', {
      userId,
      action,
      resource,
      resourceId,
      ip,
      success,
      ...details,
    });
  },
  security: (event: string, details: any, severity: 'high' | 'medium' | 'low' = 'medium') => {
    if (severity === 'high') {
      auditLogger.error('Security event', { event, severity, ...details });
    } else if (severity === 'medium') {
      auditLogger.warn('Security event', { event, severity, ...details });
    } else {
      auditLogger.info('Security event', { event, severity, ...details });
    }
  },
};

// ============================================
// Export
// ============================================

export {
  logger,
  LOG_LEVEL,
  LOG_DIR,
  ENABLE_FILE_LOGGING,
  requestLogger,
  errorLogger,
  createContextLogger,
  audit,
};

export default logger;
