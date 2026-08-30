/**
 * User Service
 * Business logic for user management
 */

import UserModel, { IUser } from '../models/User';
import { getRedisClient } from '../config/database';
import { generateToken, verifyToken } from '../middleware/auth';
import { sendWelcomeEmail, sendVerificationEmail, sendPasswordResetEmail } from '../utils/email';
import { AppError, AuthenticationError, ValidationError, ConflictError, NotFoundError } from '../middleware/errorHandler';

// Configuration
const BASE_URL = process.env.BASE_URL || 'http://localhost:4000';
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';
const VERIFICATION_TOKEN_EXPIRES_IN = parseInt(process.env.VERIFICATION_TOKEN_EXPIRES_IN || '86400'); // 24 hours
const PASSWORD_RESET_TOKEN_EXPIRES_IN = parseInt(process.env.PASSWORD_RESET_TOKEN_EXPIRES_IN || '3600'); // 1 hour

// Token blacklist prefix
const TOKEN_BLACKLIST_PREFIX = 'blacklist:token:';

/**
 * User service interface
 */
export interface IUserService {
  createUser(data: { email: string; password: string; name: string; role?: string }): Promise<IUser>;
  getUserById(id: string): Promise<IUser>;
  getUserByEmail(email: string): Promise<IUser | null>;
  updateUser(id: string, data: Partial<IUser>): Promise<IUser>;
  deleteUser(id: string): Promise<void>;
  login(email: string, password: string): Promise<{ user: Partial<IUser>; token: string }>;
  logout(token: string): Promise<void>;
  refreshToken(token: string): Promise<{ token: string }>;
  verifyEmail(token: string): Promise<IUser>;
  requestPasswordReset(email: string): Promise<void>;
  resetPassword(token: string, newPassword: string): Promise<void>;
  getUsers(query: { page?: number; limit?: number; role?: string; search?: string }): Promise<{ users: IUser[]; total: number; page: number; pages: number }>;
  getUserProfile(id: string): Promise<Partial<IUser>>;
  updateUserProfile(id: string, data: Partial<IUser>): Promise<Partial<IUser>>;
}

/**
 * User Service Implementation
 */
export class UserService implements IUserService {
  /**
   * Create a new user
   */
  async createUser(data: { email: string; password: string; name: string; role?: string }): Promise<IUser> {
    try {
      // Check if user already exists
      const existingUser = await UserModel.findOne({ email: data.email });
      if (existingUser) {
        throw new ConflictError('User with this email already exists');
      }

      // Create user
      const user = new UserModel({
        email: data.email,
        password: data.password,
        name: data.name,
        role: data.role || 'user',
      });

      // Save user
      await user.save();

      // Generate verification token
      const verificationToken = user.generateVerificationToken();
      await user.save();

      // Send welcome email (in production)
      if (process.env.NODE_ENV === 'production' && process.env.SMTP_HOST) {
        const verificationUrl = `${BASE_URL}/api/auth/verify?token=${verificationToken}`;
        await sendWelcomeEmail(user.email, user.name, BASE_URL);
        await sendVerificationEmail(user.email, user.name, verificationUrl);
      }

      return user;
    } catch (error: any) {
      if (error instanceof AppError) throw error;
      throw new ValidationError(error.message);
    }
  }

  /**
   * Get user by ID
   */
  async getUserById(id: string): Promise<IUser> {
    try {
      const user = await UserModel.findById(id);
      if (!user) {
        throw new NotFoundError('User not found');
      }
      return user;
    } catch (error: any) {
      if (error.name === 'CastError') {
        throw new ValidationError('Invalid user ID');
      }
      throw error;
    }
  }

  /**
   * Get user by email
   */
  async getUserByEmail(email: string): Promise<IUser | null> {
    try {
      return await UserModel.findOne({ email: email.toLowerCase() });
    } catch (error: any) {
      throw new ValidationError(error.message);
    }
  }

  /**
   * Update user
   */
  async updateUser(id: string, data: Partial<IUser>): Promise<IUser> {
    try {
      const user = await UserModel.findByIdAndUpdate(
        id,
        { $set: data },
        { new: true, runValidators: true }
      );

      if (!user) {
        throw new NotFoundError('User not found');
      }

      return user;
    } catch (error: any) {
      if (error.name === 'CastError') {
        throw new ValidationError('Invalid user ID');
      }
      if (error instanceof AppError) throw error;
      throw new ValidationError(error.message);
    }
  }

  /**
   * Delete user
   */
  async deleteUser(id: string): Promise<void> {
    try {
      const user = await UserModel.findByIdAndDelete(id);
      if (!user) {
        throw new NotFoundError('User not found');
      }

      // In a real implementation, you would also:
      // 1. Delete user's agents
      // 2. Delete user's templates
      // 3. Delete user's webhooks
      // 4. Remove user from any collaborations
    } catch (error: any) {
      if (error.name === 'CastError') {
        throw new ValidationError('Invalid user ID');
      }
      throw error;
    }
  }

  /**
   * Login user
   */
  async login(email: string, password: string): Promise<{ user: Partial<IUser>; token: string }> {
    try {
      // Find user
      const user = await UserModel.findOne({ email: email.toLowerCase() }).select('+password');
      if (!user) {
        throw new AuthenticationError('Invalid email or password');
      }

      // Check password
      const isMatch = await user.comparePassword(password);
      if (!isMatch) {
        throw new AuthenticationError('Invalid email or password');
      }

      // Check if user is active
      if (!user.isActive) {
        throw new AuthenticationError('Account is deactivated');
      }

      // Update login stats
      user.lastLogin = new Date();
      user.loginCount += 1;
      await user.save();

      // Generate token
      const token = user.generateAuthToken();

      // Return user without sensitive data
      const userResponse = user.toJSON();
      delete (userResponse as any).password;

      return {
        user: userResponse,
        token,
      };
    } catch (error: any) {
      if (error instanceof AppError) throw error;
      throw new AuthenticationError(error.message);
    }
  }

  /**
   * Logout user (add token to blacklist)
   */
  async logout(token: string): Promise<void> {
    try {
      const redis = getRedisClient();
      await redis.setEx(`${TOKEN_BLACKLIST_PREFIX}${token}`, '1', 24 * 60 * 60);
    } catch (error: any) {
      // Redis not available, can't blacklist
      console.warn('Could not blacklist token:', error.message);
    }
  }

  /**
   * Refresh token
   */
  async refreshToken(token: string): Promise<{ token: string }> {
    try {
      // Verify old token
      const decoded = verifyToken(token);
      if (!decoded) {
        throw new AuthenticationError('Invalid token');
      }

      // Check if token is blacklisted
      const redis = getRedisClient();
      const isBlacklisted = await redis.get(`${TOKEN_BLACKLIST_PREFIX}${token}`);
      if (isBlacklisted) {
        throw new AuthenticationError('Token has been invalidated');
      }

      // Get user
      const user = await UserModel.findById(decoded.sub);
      if (!user) {
        throw new AuthenticationError('User not found');
      }

      // Generate new token
      const newToken = user.generateAuthToken();

      return { token: newToken };
    } catch (error: any) {
      if (error instanceof AppError) throw error;
      throw new AuthenticationError(error.message);
    }
  }

  /**
   * Verify email
   */
  async verifyEmail(token: string): Promise<IUser> {
    try {
      // Decode token
      const decoded = verifyToken(token);
      if (!decoded || decoded.type !== 'verification') {
        throw new AuthenticationError('Invalid verification token');
      }

      // Get user
      const user = await UserModel.findById(decoded.sub);
      if (!user) {
        throw new NotFoundError('User not found');
      }

      // Check if already verified
      if (user.isVerified) {
        throw new ValidationError('Email already verified');
      }

      // Verify user
      user.isVerified = true;
      user.verificationToken = undefined;
      user.verificationTokenExpires = undefined;
      await user.save();

      return user;
    } catch (error: any) {
      if (error instanceof AppError) throw error;
      throw new ValidationError(error.message);
    }
  }

  /**
   * Request password reset
   */
  async requestPasswordReset(email: string): Promise<void> {
    try {
      // Find user
      const user = await UserModel.findOne({ email: email.toLowerCase() });
      if (!user) {
        // Don't reveal that user doesn't exist
        return;
      }

      // Generate password reset token
      const token = user.generatePasswordResetToken();
      await user.save();

      // Send password reset email
      if (process.env.NODE_ENV === 'production' && process.env.SMTP_HOST) {
        const resetUrl = `${BASE_URL}/api/auth/reset-password?token=${token}`;
        await sendPasswordResetEmail(user.email, user.name, resetUrl);
      }
    } catch (error: any) {
      console.error('Password reset request failed:', error);
      // Don't reveal errors to prevent email enumeration
    }
  }

  /**
   * Reset password
   */
  async resetPassword(token: string, newPassword: string): Promise<void> {
    try {
      // Decode token
      const decoded = verifyToken(token);
      if (!decoded || decoded.type !== 'password-reset') {
        throw new AuthenticationError('Invalid password reset token');
      }

      // Get user
      const user = await UserModel.findById(decoded.sub).select('+password');
      if (!user) {
        throw new NotFoundError('User not found');
      }

      // Check if token is expired
      if (user.passwordResetTokenExpires && 
          user.passwordResetTokenExpires.getTime() < Date.now()) {
        throw new AuthenticationError('Password reset token expired');
      }

      // Update password
      user.password = newPassword;
      user.passwordResetToken = undefined;
      user.passwordResetTokenExpires = undefined;
      await user.save();

      // Send notification email
      if (process.env.NODE_ENV === 'production' && process.env.SMTP_HOST) {
        await sendNotificationEmail(
          user.email,
          user.name,
          'Password Changed',
          'Your EDEN password has been changed successfully.'
        );
      }
    } catch (error: any) {
      if (error instanceof AppError) throw error;
      throw new ValidationError(error.message);
    }
  }

  /**
   * Get users with pagination
   */
  async getUsers(query: { page?: number; limit?: number; role?: string; search?: string }): Promise<{ users: IUser[]; total: number; page: number; pages: number }> {
    try {
      const page = query.page || 1;
      const limit = Math.min(query.limit || 20, 100);
      const skip = (page - 1) * limit;

      // Build query
      const filter: any = {};
      
      if (query.role) {
        filter.role = query.role;
      }

      if (query.search) {
        const searchRegex = new RegExp(query.search, 'i');
        filter.$or = [
          { name: searchRegex },
          { email: searchRegex },
        ];
      }

      // Get users
      const [users, total] = await Promise.all([
        UserModel.find(filter)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .select('-password -verificationToken -passwordResetToken'),
        UserModel.countDocuments(filter),
      ]);

      const pages = Math.ceil(total / limit);

      return {
        users,
        total,
        page,
        pages,
      };
    } catch (error: any) {
      throw new ValidationError(error.message);
    }
  }

  /**
   * Get user profile
   */
  async getUserProfile(id: string): Promise<Partial<IUser>> {
    try {
      const user = await UserModel.findById(id).select('-password -verificationToken -passwordResetToken');
      if (!user) {
        throw new NotFoundError('User not found');
      }
      return user.toJSON();
    } catch (error: any) {
      if (error.name === 'CastError') {
        throw new ValidationError('Invalid user ID');
      }
      throw error;
    }
  }

  /**
   * Update user profile
   */
  async updateUserProfile(id: string, data: Partial<IUser>): Promise<Partial<IUser>> {
    try {
      // Prevent updating sensitive fields through profile
      const safeData = { ...data };
      delete safeData.password;
      delete safeData.role;
      delete safeData.isActive;
      delete safeData.isVerified;

      const user = await UserModel.findByIdAndUpdate(
        id,
        { $set: safeData },
        { new: true, runValidators: true }
      ).select('-password -verificationToken -passwordResetToken');

      if (!user) {
        throw new NotFoundError('User not found');
      }

      return user.toJSON();
    } catch (error: any) {
      if (error.name === 'CastError') {
        throw new ValidationError('Invalid user ID');
      }
      if (error instanceof AppError) throw error;
      throw new ValidationError(error.message);
    }
  }
}

// Singleton instance
export const userService = new UserService();
export default userService;
