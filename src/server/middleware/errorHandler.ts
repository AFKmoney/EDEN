/**
 * Error Handling Middleware
 * Centralized error handling for Express
 */

import { Request, Response, NextFunction } from 'express';

/**
 * Custom error class
 */
export class AppError extends Error {
  statusCode: number;
  code: string;
  isOperational: boolean;
  details?: any;

  constructor(
    message: string,
    statusCode: number = 500,
    code: string = 'INTERNAL_ERROR',
    isOperational: boolean = true,
    details?: any
  ) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Not found error
 */
export class NotFoundError extends AppError {
  constructor(message: string = 'Not found', details?: any) {
    super(message, 404, 'NOT_FOUND', true, details);
  }
}

/**
 * Validation error
 */
export class ValidationError extends AppError {
  constructor(message: string = 'Validation failed', details?: any) {
    super(message, 400, 'VALIDATION_ERROR', true, details);
  }
}

/**
 * Authentication error
 */
export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication required', details?: any) {
    super(message, 401, 'UNAUTHENTICATED', true, details);
  }
}

/**
 * Authorization error
 */
export class AuthorizationError extends AppError {
  constructor(message: string = 'Insufficient permissions', details?: any) {
    super(message, 403, 'UNAUTHORIZED', true, details);
  }
}

/**
 * Rate limit error
 */
export class RateLimitError extends AppError {
  constructor(message: string = 'Too many requests', details?: any) {
    super(message, 429, 'RATE_LIMITED', true, details);
  }
}

/**
 * Bad request error
 */
export class BadRequestError extends AppError {
  constructor(message: string = 'Bad request', details?: any) {
    super(message, 400, 'BAD_REQUEST', true, details);
  }
}

/**
 * Conflict error
 */
export class ConflictError extends AppError {
  constructor(message: string = 'Conflict', details?: any) {
    super(message, 409, 'CONFLICT', true, details);
  }
}

/**
 * Error response helper
 */
export function errorResponse(
  res: Response,
  error: AppError | Error,
  includeStack: boolean = false
) {
  const isAppError = error instanceof AppError;
  const statusCode = isAppError ? error.statusCode : 500;
  const code = isAppError ? error.code : 'INTERNAL_ERROR';
  const message = isAppError ? error.message : 'Internal server error';

  const response: any = {
    error: message,
    code,
  };

  if (isAppError && error.details) {
    response.details = error.details;
  }

  if (includeStack && error.stack) {
    response.stack = error.stack.split('\n');
  }

  // Log the error
  console.error(`[${new Date().toISOString()}] ${statusCode} ${code}: ${message}`);
  if (error.stack) {
    console.error(error.stack);
  }

  return res.status(statusCode).json(response);
}

/**
 * 404 handler
 */
export function notFoundHandler(req: Request, res: Response, next: NextFunction) {
  const error = new NotFoundError(`Path ${req.originalUrl} not found`);
  errorResponse(res, error);
}

/**
 * Global error handler
 */
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) {
  const NODE_ENV = process.env["NODE_ENV"] || 'development';
  const includeStack = NODE_ENV === 'development';

  // Handle Mongoose validation errors
  if (err.name === 'ValidationError') {
    const details = Object.values((err as any).errors).map((e: any) => ({
      field: e.path,
      message: e.message,
    }));
    return errorResponse(res, new ValidationError('Validation failed', details));
  }

  // Handle Mongoose duplicate key errors
  if ((err as any).code === 11000) {
    const field = Object.keys((err as any).keyPattern)[0];
    return errorResponse(res, new ConflictError(`${field} already exists`));
  }

  // Handle Mongoose cast errors
  if (err.name === 'CastError') {
    return errorResponse(res, new ValidationError('Invalid ID format'));
  }

  // Handle JWT errors
  if (err.name === 'JsonWebTokenError') {
    return errorResponse(res, new AuthenticationError('Invalid token'));
  }

  if (err.name === 'TokenExpiredError') {
    return errorResponse(res, new AuthenticationError('Token expired'));
  }

  // Handle our custom errors
  if (err instanceof AppError) {
    return errorResponse(res, err, includeStack);
  }

  // Handle all other errors
  errorResponse(res, err, includeStack);
}

/**
 * Async handler wrapper
 * Wraps async route handlers to catch errors
 */
export function asyncHandler<T>(fn: (req: Request, res: Response, next: NextFunction) => T): (req: Request, res: Response, next: NextFunction) => void<T>(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<T>
): (req: Request, res: Response, next: NextFunction) => Promise<void> {
  return (req: Request, res: Response, next: NextFunction) => {
    return Promise.resolve(fn(req, res, next)).catch((err) => {
      errorHandler(err, req, res, next);
    });
  };
}

/**
 * Try-catch wrapper for sync functions
 */
export function tryCatchHandler(
  fn: (req: Request, res: Response, next: NextFunction) => any
) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      fn(req, res, next);
    } catch (err: any) {
      errorHandler(err, req, res, next);
    }
  };
}

export default errorHandler;
