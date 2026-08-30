/**
 * User Service Tests
 * Unit tests for UserService
 */

import { userService } from '../src/server/services/UserService';
import UserModel from '../src/server/models/User';
import { connectMongoDB, disconnectMongoDB } from '../src/server/config/database';
import { AuthenticationError, ValidationError, ConflictError, NotFoundError } from '../src/server/middleware/errorHandler';

// Mock the email service
jest.mock('../src/server/utils/email', () => ({
  sendWelcomeEmail: jest.fn().mockResolvedValue({ success: true }),
  sendVerificationEmail: jest.fn().mockResolvedValue({ success: true }),
  sendPasswordResetEmail: jest.fn().mockResolvedValue({ success: true }),
  sendNotificationEmail: jest.fn().mockResolvedValue({ success: true }),
}));

// Setup MongoDB Memory Server for testing
let mongoServer: any;

beforeAll(async () => {
  // In a real test environment, you would use MongoDB Memory Server
  // For now, we'll use the regular MongoDB connection
  try {
    await connectMongoDB();
  } catch (error) {
    console.warn('Could not connect to MongoDB for tests');
  }
});

afterAll(async () => {
  await disconnectMongoDB();
});

afterEach(async () => {
  // Clear all data after each test
  await UserModel.deleteMany({});
});

describe('UserService', () => {
  describe('createUser', () => {
    it('should create a new user', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User',
      };

      const user = await userService.createUser(userData);

      expect(user).toBeDefined();
      expect(user.email).toBe(userData.email);
      expect(user.name).toBe(userData.name);
      expect(user.role).toBe('user');
      expect(user.isActive).toBe(true);
      expect(user.isVerified).toBe(false);
      expect(user.password).not.toBe(userData.password); // Password should be hashed
    });

    it('should throw ConflictError if user already exists', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User',
      };

      await userService.createUser(userData);

      await expect(userService.createUser(userData))
        .rejects
        .toThrow(ConflictError);
    });

    it('should throw ValidationError if required fields are missing', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'password123',
        // Missing name
      };

      await expect(userService.createUser(userData as any))
        .rejects
        .toThrow(ValidationError);
    });
  });

  describe('getUserById', () => {
    it('should get a user by ID', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User',
      };

      const createdUser = await userService.createUser(userData);
      const user = await userService.getUserById(createdUser._id.toString());

      expect(user).toBeDefined();
      expect(user._id.toString()).toBe(createdUser._id.toString());
    });

    it('should throw NotFoundError if user does not exist', async () => {
      const nonExistentId = '507f1f77bcf86cd799439011';

      await expect(userService.getUserById(nonExistentId))
        .rejects
        .toThrow(NotFoundError);
    });

    it('should throw ValidationError if ID is invalid', async () => {
      const invalidId = 'invalid-id';

      await expect(userService.getUserById(invalidId))
        .rejects
        .toThrow(ValidationError);
    });
  });

  describe('getUserByEmail', () => {
    it('should get a user by email', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User',
      };

      await userService.createUser(userData);
      const user = await userService.getUserByEmail(userData.email);

      expect(user).toBeDefined();
      expect(user?.email).toBe(userData.email);
    });

    it('should return null if user does not exist', async () => {
      const user = await userService.getUserByEmail('nonexistent@example.com');
      expect(user).toBeNull();
    });
  });

  describe('login', () => {
    it('should login a user with correct credentials', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User',
      };

      await userService.createUser(userData);
      const result = await userService.login(userData.email, userData.password);

      expect(result).toBeDefined();
      expect(result.user).toBeDefined();
      expect(result.token).toBeDefined();
      expect(result.user.email).toBe(userData.email);
    });

    it('should throw AuthenticationError if user does not exist', async () => {
      await expect(userService.login('nonexistent@example.com', 'password123'))
        .rejects
        .toThrow(AuthenticationError);
    });

    it('should throw AuthenticationError if password is incorrect', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User',
      };

      await userService.createUser(userData);

      await expect(userService.login(userData.email, 'wrongpassword'))
        .rejects
        .toThrow(AuthenticationError);
    });
  });

  describe('updateUser', () => {
    it('should update a user', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User',
      };

      const createdUser = await userService.createUser(userData);
      const updatedUser = await userService.updateUser(createdUser._id.toString(), {
        name: 'Updated Name',
      });

      expect(updatedUser).toBeDefined();
      expect(updatedUser.name).toBe('Updated Name');
    });

    it('should throw NotFoundError if user does not exist', async () => {
      const nonExistentId = '507f1f77bcf86cd799439011';

      await expect(userService.updateUser(nonExistentId, { name: 'New Name' }))
        .rejects
        .toThrow(NotFoundError);
    });
  });

  describe('deleteUser', () => {
    it('should delete a user', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User',
      };

      const createdUser = await userService.createUser(userData);
      await userService.deleteUser(createdUser._id.toString());

      const deletedUser = await userService.getUserById(createdUser._id.toString());
      expect(deletedUser).toBeNull();
    });

    it('should throw NotFoundError if user does not exist', async () => {
      const nonExistentId = '507f1f77bcf86cd799439011';

      await expect(userService.deleteUser(nonExistentId))
        .rejects
        .toThrow(NotFoundError);
    });
  });

  describe('getUsers', () => {
    it('should get all users with pagination', async () => {
      // Create multiple users
      for (let i = 0; i < 15; i++) {
        await userService.createUser({
          email: `user${i}@example.com`,
          password: 'password123',
          name: `User ${i}`,
        });
      }

      const result = await userService.getUsers({ page: 1, limit: 10 });

      expect(result).toBeDefined();
      expect(result.users.length).toBe(10);
      expect(result.total).toBe(15);
      expect(result.page).toBe(1);
      expect(result.pages).toBe(2);
    });

    it('should filter users by role', async () => {
      // Create admin user
      await userService.createUser({
        email: 'admin@example.com',
        password: 'password123',
        name: 'Admin User',
        role: 'admin',
      });

      // Create regular user
      await userService.createUser({
        email: 'user@example.com',
        password: 'password123',
        name: 'Regular User',
      });

      const result = await userService.getUsers({ role: 'admin' });

      expect(result.users.length).toBe(1);
      expect(result.users[0].role).toBe('admin');
    });

    it('should search users', async () => {
      await userService.createUser({
        email: 'john@example.com',
        password: 'password123',
        name: 'John Doe',
      });

      await userService.createUser({
        email: 'jane@example.com',
        password: 'password123',
        name: 'Jane Smith',
      });

      const result = await userService.getUsers({ search: 'john' });

      expect(result.users.length).toBe(1);
      expect(result.users[0].name).toContain('John');
    });
  });

  describe('verifyEmail', () => {
    it('should verify user email', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User',
      };

      const user = await userService.createUser(userData);
      const token = user.generateVerificationToken();
      await user.save();

      const verifiedUser = await userService.verifyEmail(token);

      expect(verifiedUser).toBeDefined();
      expect(verifiedUser.isVerified).toBe(true);
    });

    it('should throw AuthenticationError if token is invalid', async () => {
      await expect(userService.verifyEmail('invalid-token'))
        .rejects
        .toThrow(AuthenticationError);
    });
  });

  describe('requestPasswordReset', () => {
    it('should request password reset', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User',
      };

      await userService.createUser(userData);
      await userService.requestPasswordReset(userData.email);

      // In a real test, you would check if email was sent
      // For now, we just verify it doesn't throw
    });

    it('should not throw if user does not exist', async () => {
      await expect(userService.requestPasswordReset('nonexistent@example.com'))
        .resolves
        .not.toThrow();
    });
  });

  describe('resetPassword', () => {
    it('should reset password', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User',
      };

      const user = await userService.createUser(userData);
      const token = user.generatePasswordResetToken();
      await user.save();

      await userService.resetPassword(token, 'newpassword123');

      // Verify new password works
      const result = await userService.login(userData.email, 'newpassword123');
      expect(result).toBeDefined();
    });

    it('should throw AuthenticationError if token is invalid', async () => {
      await expect(userService.resetPassword('invalid-token', 'newpassword123'))
        .rejects
        .toThrow(AuthenticationError);
    });
  });
});
