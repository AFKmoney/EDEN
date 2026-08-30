/**
 * Rate Limiting Middleware
 * Request rate limiting with Redis support
 */

import { Request, Response, NextFunction } from 'express';
import { getRedisClient } from '../config/database';

// Configuration
const NODE_ENV = process.env["NODE_ENV"] || 'development';

/**
 * Rate limiter options
 */
export interface RateLimitOptions {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  message?: string; // Custom error message
  key?: (req: Request) => string; // Function to generate rate limit key
  skip?: (req: Request) => boolean; // Function to skip rate limiting
  standardHeaders?: boolean; // Add standard rate limit headers
  legacyHeaders?: boolean; // Add legacy rate limit headers
}

const defaultOptions: RateLimitOptions = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 100,
  message: 'Too many requests, please try again later',
  key: (req) => req.ip || req.connection.remoteAddress || 'unknown',
  skip: () => false,
  standardHeaders: true,
  legacyHeaders: false,
};

/**
 * Rate limiting middleware using Redis
 */
export function rateLimiter(options: Partial<RateLimitOptions> = {}) {
  const opts: RateLimitOptions = { ...defaultOptions, ...options };

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Skip if should skip
      if (opts.skip?.(req)) {
        return next();
      }

      // Get rate limit key
      const key = `ratelimit:${opts.key?.(req)}`;

      // Use Redis for distributed rate limiting
      const redis = getRedisClient();

      // Use Redis to track requests
      const current = await redis.incr(key);
      
      // Set expiration if this is the first request in the window
      if (current === 1) {
        await redis.expire(key, Math.floor(opts.windowMs / 1000));
      }

      // Check if limit exceeded
      if (current > opts.maxRequests) {
        // Add rate limit headers
        if (opts.standardHeaders) {
          res.set('RateLimit-Limit', opts.maxRequests.toString());
          res.set('RateLimit-Remaining', '0');
          res.set('RateLimit-Reset', Math.floor((opts.windowMs - (Date.now() % opts.windowMs)) / 1000).toString());
        }

        return res.status(429).json({
          error: opts.message,
          code: 'RATE_LIMITED',
          retryAfter: Math.floor(opts.windowMs / 1000),
        });
      }

      // Add rate limit headers
      if (opts.standardHeaders) {
        res.set('RateLimit-Limit', opts.maxRequests.toString());
        res.set('RateLimit-Remaining', (opts.maxRequests - current).toString());
        res.set('RateLimit-Reset', Math.floor((opts.windowMs - (Date.now() % opts.windowMs)) / 1000).toString());
      }

      next();
    } catch (error: any) {
      // If Redis fails, use in-memory fallback
      console.error('Rate limiting error:', error);
      next();
    }
  };
}

/**
 * In-memory rate limiter (fallback when Redis is not available)
 */
export function memoryRateLimiter(options: Partial<RateLimitOptions> = {}) {
  const opts: RateLimitOptions = { ...defaultOptions, ...options };
  const requestCounts = new Map<string, { count: number; resetTime: number }>();

  return (req: Request, res: Response, next: NextFunction) => {
    // Skip if should skip
    if (opts.skip?.(req)) {
      return next();
    }

    // Get rate limit key
    const key = opts.key?.(req) || req.ip || 'unknown';
    const now = Date.now();

    // Get or create request record
    let record = requestCounts.get(key);
    
    if (!record || now > record.resetTime) {
      record = { count: 0, resetTime: now + opts.windowMs };
      requestCounts.set(key, record);
    }

    // Check if limit exceeded
    if (record.count >= opts.maxRequests) {
      // Add rate limit headers
      if (opts.standardHeaders) {
        res.set('RateLimit-Limit', opts.maxRequests.toString());
        res.set('RateLimit-Remaining', '0');
        res.set('RateLimit-Reset', Math.floor((record.resetTime - now) / 1000).toString());
      }

      return res.status(429).json({
        error: opts.message,
        code: 'RATE_LIMITED',
        retryAfter: Math.ceil((record.resetTime - now) / 1000),
      });
    }

    // Increment count
    record.count += 1;

    // Add rate limit headers
    if (opts.standardHeaders) {
      res.set('RateLimit-Limit', opts.maxRequests.toString());
      res.set('RateLimit-Remaining', (opts.maxRequests - record.count).toString());
      res.set('RateLimit-Reset', Math.floor((record.resetTime - now) / 1000).toString());
    }

    next();
  };
}

/**
 * API-specific rate limiters
 */

// Rate limiter for API endpoints
const apiLimiter = rateLimiter({
  windowMs: 15 * 60 * 1000,
  maxRequests: 1000,
  message: 'Too many API requests, please try again later',
  standardHeaders: true,
});

// Rate limiter for auth endpoints (more restrictive)
const authLimiter = rateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 10,
  message: 'Too many authentication attempts, please try again later',
  standardHeaders: true,
});

// Rate limiter for webhook endpoints
const webhookLimiter = rateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 100,
  message: 'Too many webhook requests, please try again later',
  standardHeaders: true,
});

// Rate limiter for search endpoints
const searchLimiter = rateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 30,
  message: 'Too many search requests, please try again later',
  standardHeaders: true,
});

export {
  apiLimiter,
  authLimiter,
  webhookLimiter,
  searchLimiter,
  defaultOptions,
};
