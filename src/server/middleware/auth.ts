/**
 * Authentication Middleware
 * JWT token verification and role-based access control
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { getRedisClient } from '../config/database';

// Configuration
const JWT_SECRET = process.env["JWT_SECRET"] || 'your-secret-key';
const NODE_ENV = process.env["NODE_ENV"] || 'development';

// Token blacklist for logout
const TOKEN_BLACKLIST_PREFIX = 'blacklist:token:';

/**
 * Verify JWT token
 */
export function verifyToken(token: string): any {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error: any) {
    // Check if token is blacklisted
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return null;
    }
    throw error;
  }
}

/**
 * Generate JWT token
 */
export function generateToken(payload: object, expiresIn: string = '24h'): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
}

/**
 * Authentication middleware
 * Verifies JWT token and attaches user to request
 */
export async function authenticate(req: Request, res: Response, next: NextFunction) {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Authentication required',
        code: 'UNAUTHENTICATED',
      });
    }

    const token = authHeader.substring(7);

    // Check if token is blacklisted (logged out)
    try {
      const redis = getRedisClient();
      const isBlacklisted = await redis.get(`${TOKEN_BLACKLIST_PREFIX}${token}`);
      
      if (isBlacklisted) {
        return res.status(401).json({
          error: 'Token has been invalidated',
          code: 'TOKEN_INVALIDATED',
        });
      }
    } catch {
      // Redis not available, continue without blacklist check
    }

    // Verify token
    const decoded = verifyToken(token);
    
    if (!decoded) {
      return res.status(401).json({
        error: 'Invalid or expired token',
        code: 'INVALID_TOKEN',
      });
    }

    // Attach user to request
    (req as any).user = decoded;
    (req as any).token = token;

    next();
  } catch (error: any) {
    console.error('Authentication error:', error);
    res.status(500).json({
      error: 'Authentication failed',
      code: 'AUTH_ERROR',
    });
  }
}

/**
 * Optional authentication middleware
 * If token is valid, attach user to request, but don't fail if missing
 */
export async function optionalAuthenticate(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.substring(7);

    // Check blacklist
    try {
      const redis = getRedisClient();
      const isBlacklisted = await redis.get(`${TOKEN_BLACKLIST_PREFIX}${token}`);
      
      if (isBlacklisted) {
        return next();
      }
    } catch {
      // Continue without blacklist check
    }

    // Verify token
    const decoded = verifyToken(token);
    
    if (!decoded) {
      return next();
    }

    // Attach user to request
    (req as any).user = decoded;
    (req as any).token = token;

    next();
  } catch (error: any) {
    // Don't fail on optional auth
    next();
  }
}

/**
 * Role-based authorization middleware
 * @param roles - Array of allowed roles
 */
export function authorize(roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      
      if (!user) {
        return res.status(401).json({
          error: 'Authentication required',
          code: 'UNAUTHENTICATED',
        });
      }

      // Check if user has any of the required roles
      const hasRequiredRole = roles.some((role) => {
        // Admin can do anything
        if (user.role === 'admin') return true;
        return user.role === role;
      });

      if (!hasRequiredRole) {
        return res.status(403).json({
          error: 'Insufficient permissions',
          code: 'INSUFFICIENT_PERMISSIONS',
          requiredRoles: roles,
          userRole: user.role,
        });
      }

      next();
    } catch (error: any) {
      console.error('Authorization error:', error);
      res.status(500).json({
        error: 'Authorization failed',
        code: 'AUTHZ_ERROR',
      });
    }
  };
}

/**
 * Admin-only middleware
 */
export function adminOnly(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user;
  
  if (!user) {
    return res.status(401).json({
      error: 'Authentication required',
      code: 'UNAUTHENTICATED',
    });
  }

  if (user.role !== 'admin') {
    return res.status(403).json({
      error: 'Admin access required',
      code: 'ADMIN_REQUIRED',
    });
  }

  next();
}

/**
 * Logout middleware
 * Adds token to blacklist
 */
export async function logout(req: Request, res: Response) {
  try {
    const token = (req as any).token;
    
    if (token) {
      try {
        const redis = getRedisClient();
        // Blacklist token for 24 hours (or until it expires)
        await redis.setEx(`${TOKEN_BLACKLIST_PREFIX}${token}`, '1', 24 * 60 * 60);
      } catch {
        // Redis not available, can't blacklist
      }
    }

    res.json({ success: true, message: 'Logged out successfully' });
  } catch (error: any) {
    console.error('Logout error:', error);
    res.status(500).json({
      error: 'Logout failed',
      code: 'LOGOUT_ERROR',
    });
  }
}

/**
 * Rate limiting middleware for auth endpoints
 */
export function authRateLimiter(maxRequests: number = 5, windowMs: number = 60000) {
  const requestCounts = new Map<string, { count: number; resetTime: number }>();

  return (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const now = Date.now();

    const record = requestCounts.get(ip) || { count: 0, resetTime: now + windowMs };

    if (now > record.resetTime) {
      record.count = 0;
      record.resetTime = now + windowMs;
    }

    if (record.count >= maxRequests) {
      return res.status(429).json({
        error: 'Too many requests, please try again later',
        code: 'RATE_LIMITED',
        retryAfter: Math.ceil((record.resetTime - now) / 1000),
      });
    }

    record.count += 1;
    requestCounts.set(ip, record);

    next();
  };
}

/**
 * Extract user ID from token (for socket.io, etc.)
 */
export function extractUserIdFromToken(token: string): string | null {
  try {
    const decoded = verifyToken(token);
    return decoded?.sub || null;
  } catch {
    return null;
  }
}

export { JWT_SECRET };
