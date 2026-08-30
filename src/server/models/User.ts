/**
 * User Model
 * MongoDB schema for user accounts
 */

import mongoose, { Document, Schema, Model, Types } from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

// Configuration
const JWT_SECRET = process.env["JWT_SECRET"] || 'your-secret-key';
const JWT_EXPIRES_IN = process.env["JWT_EXPIRES_IN"] || '24h';
const SALT_ROUNDS = parseInt(process.env["SALT_ROUNDS"] || '12');

// User roles
export type UserRole = 'user' | 'admin' | 'moderator';

// User interface
export interface IUser extends Document {
  email: string;
  name: string;
  password: string;
  role: UserRole;
  avatar?: string;
  bio?: string;
  website?: string;
  github?: string;
  twitter?: string;
  discord?: string;
  isActive: boolean;
  isVerified: boolean;
  verificationToken?: string;
  verificationTokenExpires?: Date;
  passwordResetToken?: string;
  passwordResetTokenExpires?: Date;
  lastLogin?: Date;
  loginCount: number;
  createdAt: Date;
  updatedAt: Date;

  publicProfile: any;

  publicProfile: any;

  // Methods
  comparePassword(candidatePassword: string): Promise<boolean>;
  generateAuthToken(): string;
  generateVerificationToken(): string;
  generatePasswordResetToken(): string;
}

// User schema
const UserSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^[\w.-]+@[\w.-]+\.[a-z]{2,}$/i,
        'Please provide a valid email address',
      ],
    },
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters'],
      select: false, // Never return password in queries
    },
    role: {
      type: String,
      enum: ['user', 'admin', 'moderator'] as UserRole[],
      default: 'user',
    },
    avatar: {
      type: String,
      trim: true,
    },
    bio: {
      type: String,
      trim: true,
      maxlength: [500, 'Bio cannot exceed 500 characters'],
    },
    website: {
      type: String,
      trim: true,
      match: [
        /^https?:\/\/(?:www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_\+.~#?&\/=]*)$/
        , 'Please provide a valid URL'],
    },
    github: {
      type: String,
      trim: true,
    },
    twitter: {
      type: String,
      trim: true,
    },
    discord: {
      type: String,
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    verificationToken: {
      type: String,
      select: false,
    },
    verificationTokenExpires: {
      type: Date,
      select: false,
    },
    passwordResetToken: {
      type: String,
      select: false,
    },
    passwordResetTokenExpires: {
      type: Date,
      select: false,
    },
    lastLogin: {
      type: Date,
    },
    loginCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (doc, ret) => {
        delete (ret as any).password;
        delete (ret as any).verificationToken;
        delete (ret as any).verificationTokenExpires;
        delete (ret as any).passwordResetToken;
        delete (ret as any).passwordResetTokenExpires;
        return ret;
      },
    },
    toObject: {
      virtuals: true,
      transform: (doc, ret) => {
        delete (ret as any).password;
        delete (ret as any).verificationToken;
        delete (ret as any).verificationTokenExpires;
        delete (ret as any).passwordResetToken;
        delete (ret as any).passwordResetTokenExpires;
        return ret;
      },
    },
  }
);

// Hash password before saving
UserSchema.pre<IUser>('save', async function (next) {
  if (!this.isModified('password')) return next();

  try {
    const salt = await bcrypt.genSalt(SALT_ROUNDS);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error: any) {
    next(error);
  }
});

// Hash password before update
UserSchema.pre<IUser>('findOneAndUpdate', async function (next) {
  const update = this.getUpdate() as any;
  
  if (!update.password) return next();

  try {
    const salt = await bcrypt.genSalt(SALT_ROUNDS);
    update.password = await bcrypt.hash(update.password, salt);
    next();
  } catch (error: any) {
    next(error);
  }
});

// Method to compare passwords
UserSchema.methods.comparePassword = async function (
  this: IUser,
  candidatePassword: string
): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

// Method to generate auth token
UserSchema.methods.generateAuthToken = function (this: IUser): string {
  const payload = {
    sub: this._id.toString(),
    email: this.email,
    name: this.name,
    role: this.role,
    iat: Math.floor(Date.now() / 1000),
  };

  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
};

// Method to generate verification token
UserSchema.methods.generateVerificationToken = function (this: IUser): string {
  const token = jwt.sign(
    { sub: this._id.toString(), type: 'verification' },
    JWT_SECRET,
    { expiresIn: '24h' }
  );

  this.verificationToken = token;
  this.verificationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
  this.save();

  return token;
};

// Method to generate password reset token
UserSchema.methods.generatePasswordResetToken = function (this: IUser): string {
  const token = jwt.sign(
    { sub: this._id.toString(), type: 'password-reset' },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  this.passwordResetToken = token;
  this.passwordResetTokenExpires = new Date(Date.now() + 60 * 60 * 1000);
  this.save();

  return token;
};

// Indexes
UserSchema.index({ email: 1 }, { unique: true });
UserSchema.index({ role: 1 });
UserSchema.index({ createdAt: -1 });
UserSchema.index({ updatedAt: -1 });

// Virtual for user's public profile
type PublicProfile = {
  id: string;
  name: string;
  email: string;
  avatar: string | undefined;
  bio: string | undefined;
  role: UserRole;
  isVerified: boolean;
  github: string | undefined;
  twitter: string | undefined;
  discord: string | undefined;
  website: string | undefined;
  createdAt: Date;
};

UserSchema.virtual('publicProfile').get(function (this: IUser): PublicProfile {
  return {
    id: this._id.toString(),
    name: this.name,
    email: this.email,
    avatar: this.avatar,
    bio: this.bio,
    role: this.role,
    isVerified: this.isVerified,
    github: this.github,
    twitter: this.twitter,
    discord: this.discord,
    website: this.website,
    createdAt: this.createdAt,
  };
});

// Virtual for user stats
type UserStats = {
  agentCount: number;
  templateCount: number;
  likeCount: number;
  downloadCount: number;
};

UserSchema.virtual('stats').get(function (this: IUser): UserStats {
  // These would be populated from actual data in a real implementation
  return {
    agentCount: 0,
    templateCount: 0,
    likeCount: 0,
    downloadCount: 0,
  };
});

// Create and export model
const UserModel: Model<IUser> = mongoose.models.User || mongoose.model<IUser>('User', UserSchema);

export default UserModel;

// Export utilities
export { JWT_SECRET, JWT_EXPIRES_IN, SALT_ROUNDS };
