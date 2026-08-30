/**
 * User Controller
 * REST API endpoints for user management
 */

import { Request, Response } from 'express';
import { userService } from '../services/UserService';
import { asyncHandler } from '../middleware/errorHandler';
import { authenticate, authorize, optionalAuthenticate } from '../middleware/auth';
import { apiLimiter, authLimiter } from '../middleware/rateLimit';

/**
 * Register a new user
 */
export const register = asyncHandler(async (req: Request, res: Response) => {
  const { email, password, name, role } = req.body;

  if (!email || !password || !name) {
    return res.status(400).json({
      error: 'Email, password, and name are required',
      code: 'VALIDATION_ERROR',
    });
  }

  const user = await userService.createUser({ email, password, name, role });

  // Generate token for immediate login
  const token = user.generateAuthToken();

  res.status(201).json({
    success: true,
    user: user.publicProfile,
    token,
  });
});

/**
 * Login user
 */
export const login = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      error: 'Email and password are required',
      code: 'VALIDATION_ERROR',
    });
  }

  const { user, token } = await userService.login(email, password);

  res.json({
    success: true,
    user,
    token,
  });
});

/**
 * Logout user
 */
export const logout = asyncHandler(async (req: Request, res: Response) => {
  const token = (req as any).token;
  await userService.logout(token);

  res.json({
    success: true,
    message: 'Logged out successfully',
  });
});

/**
 * Refresh token
 */
export const refreshToken = asyncHandler(async (req: Request, res: Response) => {
  const token = (req as any).token;
  const { token: newToken } = await userService.refreshToken(token);

  res.json({
    success: true,
    token: newToken,
  });
});

/**
 * Get current user
 */
export const getMe = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;
  const userData = await userService.getUserProfile(user.sub);

  res.json({
    user: userData,
  });
});

/**
 * Get user by ID
 */
export const getUserById = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = (req as any).user;

  // Check if user is admin or requesting their own profile
  if (user.role !== 'admin' && user.sub !== id) {
    return res.status(403).json({
      error: 'Not authorized to access this user',
      code: 'UNAUTHORIZED',
    });
  }

  const userData = await userService.getUserProfile(id);

  res.json({
    user: userData,
  });
});

/**
 * Update user profile
 */
export const updateProfile = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = (req as any).user;

  // Check if user is updating their own profile or is admin
  if (user.sub !== id && user.role !== 'admin') {
    return res.status(403).json({
      error: 'Not authorized to update this user',
      code: 'UNAUTHORIZED',
    });
  }

  const updatedUser = await userService.updateUserProfile(id, req.body);

  res.json({
    user: updatedUser,
  });
});

/**
 * Update user (admin only)
 */
export const updateUser = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = (req as any).user;

  if (user.role !== 'admin') {
    return res.status(403).json({
      error: 'Admin access required',
      code: 'ADMIN_REQUIRED',
    });
  }

  const updatedUser = await userService.updateUser(id, req.body);

  res.json({
    user: updatedUser.publicProfile,
  });
});

/**
 * Delete user
 */
export const deleteUser = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = (req as any).user;

  // Check if user is deleting their own account or is admin
  if (user.sub !== id && user.role !== 'admin') {
    return res.status(403).json({
      error: 'Not authorized to delete this user',
      code: 'UNAUTHORIZED',
    });
  }

  await userService.deleteUser(id);

  res.json({
    success: true,
    message: 'User deleted successfully',
  });
});

/**
 * Get all users (admin only)
 */
export const getAllUsers = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;

  if (user.role !== 'admin') {
    return res.status(403).json({
      error: 'Admin access required',
      code: 'ADMIN_REQUIRED',
    });
  }

  const { page, limit, role, search } = req.query;
  const result = await userService.getUsers({
    page: page ? parseInt(page as string) : undefined,
    limit: limit ? parseInt(limit as string) : undefined,
    role: role as string | undefined,
    search: search as string | undefined,
  });

  res.json({
    users: result.users.map(u => u.publicProfile),
    total: result.total,
    page: result.page,
    pages: result.pages,
  });
});

/**
 * Verify email
 */
export const verifyEmail = asyncHandler(async (req: Request, res: Response) => {
  const { token } = req.query;

  if (!token || typeof token !== 'string') {
    return res.status(400).json({
      error: 'Verification token is required',
      code: 'VALIDATION_ERROR',
    });
  }

  const user = await userService.verifyEmail(token);

  res.json({
    success: true,
    user: user.publicProfile,
    message: 'Email verified successfully',
  });
});

/**
 * Request password reset
 */
export const requestPasswordReset = asyncHandler(async (req: Request, res: Response) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({
      error: 'Email is required',
      code: 'VALIDATION_ERROR',
    });
  }

  await userService.requestPasswordReset(email);

  // Don't reveal if user exists or not
  res.json({
    success: true,
    message: 'If an account with this email exists, a password reset link has been sent',
  });
});

/**
 * Reset password
 */
export const resetPassword = asyncHandler(async (req: Request, res: Response) => {
  const { token } = req.query;
  const { newPassword } = req.body;

  if (!token || typeof token !== 'string') {
    return res.status(400).json({
      error: 'Reset token is required',
      code: 'VALIDATION_ERROR',
    });
  }

  if (!newPassword) {
    return res.status(400).json({
      error: 'New password is required',
      code: 'VALIDATION_ERROR',
    });
  }

  await userService.resetPassword(token, newPassword);

  res.json({
    success: true,
    message: 'Password reset successfully',
  });
});

/**
 * Check if email is available
 */
export const checkEmailAvailable = asyncHandler(async (req: Request, res: Response) => {
  const { email } = req.query;

  if (!email || typeof email !== 'string') {
    return res.status(400).json({
      error: 'Email is required',
      code: 'VALIDATION_ERROR',
    });
  }

  const user = await userService.getUserByEmail(email);

  res.json({
    available: !user,
  });
});

/**
 * Get user stats (for profile page)
 */
export const getUserStats = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = (req as any).user;

  // Check if user is accessing their own stats or is admin
  if (user.sub !== id && user.role !== 'admin') {
    return res.status(403).json({
      error: 'Not authorized to access these stats',
      code: 'UNAUTHORIZED',
    });
  }

  const userData = await userService.getUserProfile(id);

  // In a real implementation, you would fetch actual stats
  res.json({
    stats: {
      agentCount: 0,
      templateCount: 0,
      likeCount: 0,
      downloadCount: 0,
      executionCount: 0,
    },
    user: userData,
  });
});

export default {
  register,
  login,
  logout,
  refreshToken,
  getMe,
  getUserById,
  updateProfile,
  updateUser,
  deleteUser,
  getAllUsers,
  verifyEmail,
  requestPasswordReset,
  resetPassword,
  checkEmailAvailable,
  getUserStats,
};
