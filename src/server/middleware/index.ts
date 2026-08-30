/**
 * Middleware Index
 * Export all middleware functions
 */

export {
  authenticate,
  optionalAuthenticate,
  authorize,
  adminOnly,
  logout,
  authRateLimiter,
  extractUserIdFromToken,
  JWT_SECRET,
} from './auth';

export {
  rateLimiter,
  memoryRateLimiter,
  apiLimiter,
  authLimiter,
  webhookLimiter,
  searchLimiter,
  default as defaultRateLimitOptions,
} from './rateLimit';

export {
  AppError,
  NotFoundError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  RateLimitError,
  BadRequestError,
  ConflictError,
  errorResponse,
  notFoundHandler,
  errorHandler,
  asyncHandler,
  tryCatchHandler,
} from './errorHandler';
