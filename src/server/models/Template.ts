/**
 * Template Model
 * MongoDB schema for shareable agent templates
 */

import mongoose, { Document, Schema, Model, Types } from 'mongoose';

// Ensure NODE_ENV is defined
const NODE_ENV = process.env["NODE_ENV"] || 'development';

// Category type
export type TemplateCategory = 
  | 'automation'
  | 'data-processing'
  | 'ai-assistants'
  | 'web-scraping'
  | 'chatbots'
  | 'analysis'
  | 'creative'
  | 'productivity'
  | 'other';

// Template interface
export interface ITemplate extends Document {
  name: string;
  description: string;
  author: Types.ObjectId;
  authorName: string;
  nodes: Record<string, any>;
  connections: any[];
  metadata: {
    version: string;
    category: TemplateCategory;
    tags: string[];
    isPublic: boolean;
    isFeatured: boolean;
    difficulty: 'beginner' | 'intermediate' | 'advanced';
    estimatedTime: number; // in minutes
    thumbnail?: string;
    previewImage?: string;
    videoUrl?: string;
  };
  stats: {
    downloadCount: number;
    likeCount: number;
    viewCount: number;
    ratingCount: number;
    ratingTotal: number;
    reviewCount: number;
    forkCount: number;
  };
  content: {
    readme: string;
    changelog: string;
    usage: string;
    dependencies: string[];
    examples: string[];
  };
  isActive: boolean;
  isApproved: boolean;
  approvedBy: Types.ObjectId;
  approvedAt: Date;
  rejectionReason: string;
  createdAt: Date;
  updatedAt: Date;

  publicData: any;

  publicData: any;

  // Methods
  getRating(): number;
  incrementDownload(): Promise<ITemplate>;
  incrementLike(): Promise<ITemplate>;
  incrementView(): Promise<ITemplate>;
  addReview(rating: number, review: string): Promise<ITemplate>;
  fork(newAuthor: Types.ObjectId, newAuthorName: string): Promise<ITemplate>;
}

// Template schema
const TemplateSchema = new Schema<ITemplate>(
  {
    name: {
      type: String,
      required: [true, 'Template name is required'],
      trim: true,
      maxlength: [200, 'Template name cannot exceed 200 characters'],
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
      maxlength: [5000, 'Description cannot exceed 5000 characters'],
    },
    author: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Author is required'],
    },
    authorName: {
      type: String,
      required: [true, 'Author name is required'],
      trim: true,
    },
    nodes: {
      type: Map,
      of: Schema.Types.Mixed,
      required: [true, 'Nodes are required'],
      default: new Map(),
    },
    connections: {
      type: [Schema.Types.Mixed],
      required: [true, 'Connections are required'],
      default: [],
    },
    metadata: {
      type: {
        version: {
          type: String,
          default: '1.0.0',
        },
        category: {
          type: String,
          enum: [
            'automation',
            'data-processing',
            'ai-assistants',
            'web-scraping',
            'chatbots',
            'analysis',
            'creative',
            'productivity',
            'other',
          ] as TemplateCategory[],
          default: 'other',
        },
        tags: {
          type: [String],
          default: [],
        },
        isPublic: {
          type: Boolean,
          default: false,
        },
        isFeatured: {
          type: Boolean,
          default: false,
        },
        difficulty: {
          type: String,
          enum: ['beginner', 'intermediate', 'advanced'] as ITemplate['metadata']['difficulty'][],
          default: 'beginner',
        },
        estimatedTime: {
          type: Number,
          default: 10,
        },
        thumbnail: {
          type: String,
          trim: true,
        },
        previewImage: {
          type: String,
          trim: true,
        },
        videoUrl: {
          type: String,
          trim: true,
        },
      },
      default: () => ({}),
    },
    stats: {
      type: {
        downloadCount: {
          type: Number,
          default: 0,
        },
        likeCount: {
          type: Number,
          default: 0,
        },
        viewCount: {
          type: Number,
          default: 0,
        },
        ratingCount: {
          type: Number,
          default: 0,
        },
        ratingTotal: {
          type: Number,
          default: 0,
        },
        reviewCount: {
          type: Number,
          default: 0,
        },
        forkCount: {
          type: Number,
          default: 0,
        },
      },
      default: () => ({}),
    },
    content: {
      type: {
        readme: {
          type: String,
          trim: true,
          maxlength: [10000, 'Readme cannot exceed 10000 characters'],
        },
        changelog: {
          type: String,
          trim: true,
          maxlength: [5000, 'Changelog cannot exceed 5000 characters'],
        },
        usage: {
          type: String,
          trim: true,
          maxlength: [5000, 'Usage cannot exceed 5000 characters'],
        },
        dependencies: {
          type: [String],
          default: [],
        },
        examples: {
          type: [String],
          default: [],
        },
      },
      default: () => ({}),
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isApproved: {
      type: Boolean,
      default: NODE_ENV === 'production' ? false : true, // Auto-approve in development
    },
    approvedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    approvedAt: {
      type: Date,
    },
    rejectionReason: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (doc, ret) => {
        // Convert Map to plain object
        if (ret.nodes && ret.nodes instanceof Map) {
          ret.nodes = Object.fromEntries(ret.nodes);
        }
        return ret;
      },
    },
    toObject: {
      virtuals: true,
      transform: (doc, ret) => {
        if (ret.nodes && ret.nodes instanceof Map) {
          ret.nodes = Object.fromEntries(ret.nodes);
        }
        return ret;
      },
    },
  }
);

// Method to get average rating
TemplateSchema.methods.getRating = function (this: ITemplate): number {
  if (this.stats.ratingCount === 0) return 0;
  return this.stats.ratingTotal / this.stats.ratingCount;
};

// Method to increment download count
TemplateSchema.methods.incrementDownload = async function (this: ITemplate): Promise<ITemplate> {
  this.stats.downloadCount += 1;
  this.markModified('stats');
  await this.save();
  return this;
};

// Method to increment like count
TemplateSchema.methods.incrementLike = async function (this: ITemplate): Promise<ITemplate> {
  this.stats.likeCount += 1;
  this.markModified('stats');
  await this.save();
  return this;
};

// Method to increment view count
TemplateSchema.methods.incrementView = async function (this: ITemplate): Promise<ITemplate> {
  this.stats.viewCount += 1;
  this.markModified('stats');
  await this.save();
  return this;
};

// Method to add a review
TemplateSchema.methods.addReview = async function (
  this: ITemplate,
  rating: number,
  review: string
): Promise<ITemplate> {
  if (rating < 1 || rating > 5) {
    throw new Error('Rating must be between 1 and 5');
  }

  this.stats.ratingCount += 1;
  this.stats.ratingTotal += rating;
  this.stats.reviewCount += 1;
  this.markModified('stats');

  // In a real implementation, you would also save the review text
  // For now, we just update the stats

  await this.save();
  return this;
};

// Method to fork a template
TemplateSchema.methods.fork = async function (
  this: ITemplate,
  newAuthor: Types.ObjectId,
  newAuthorName: string
): Promise<ITemplate> {
  const forkedData = this.toObject();
  delete (forkedData as any)._id;
  delete (forkedData as any).createdAt;
  delete (forkedData as any).updatedAt;
  delete (forkedData as any).stats;
  delete (forkedData as any).isApproved;
  delete (forkedData as any).approvedBy;
  delete (forkedData as any).approvedAt;
  delete (forkedData as any).rejectionReason;

  // Update fork-specific fields
  forkedData.name = `${forkedData.name} (Fork)`;
  forkedData.author = newAuthor;
  forkedData.authorName = newAuthorName;
  forkedData.metadata.isPublic = false;
  forkedData.metadata.isFeatured = false;

  // Create new template
  const forkedTemplate = new TemplateModel(forkedData);
  await forkedTemplate.save();

  // Increment fork count on original
  this.stats.forkCount += 1;
  this.markModified('stats');
  await this.save();

  return forkedTemplate;
};

// Indexes
TemplateSchema.index({ author: 1, createdAt: -1 });
TemplateSchema.index({ author: 1, name: 1 });
TemplateSchema.index({ 'metadata.isPublic': 1 });
TemplateSchema.index({ 'metadata.category': 1 });
TemplateSchema.index({ 'metadata.tags': 1 });
TemplateSchema.index({ 'metadata.isFeatured': 1 });
TemplateSchema.index({ 'stats.downloadCount': -1 });
TemplateSchema.index({ 'stats.likeCount': -1 });
TemplateSchema.index({ 'stats.ratingCount': -1 });
TemplateSchema.index({ createdAt: -1 });
TemplateSchema.index({ updatedAt: -1 });

// Virtual for rating
TemplateSchema.virtual('rating').get(function (this: ITemplate): number {
  return this.getRating();
});

// Virtual for public template data
TemplateSchema.virtual('publicData').get(function (this: ITemplate) {
  const nodes = this.nodes as any;
  const publicNodes: Record<string, any> = {};

  // Create public versions of nodes
  for (const [key, node] of Object.entries(nodes)) {
    publicNodes[key] = {
      id: node.id,
      type: node.type,
      position: node.position,
      metadata: node.metadata,
      ternaryState: node.ternaryState,
    };
  }

  return {
    id: this._id.toString(),
    name: this.name,
    description: this.description,
    author: this.author.toString(),
    authorName: this.authorName,
    nodes: publicNodes,
    connections: this.connections,
    metadata: this.metadata,
    stats: this.stats,
    rating: this.getRating(),
    createdAt: this.createdAt,
  };
});

// Create and export model
const TemplateModel: Model<ITemplate> = mongoose.models.Template || mongoose.model<ITemplate>('Template', TemplateSchema);

export default TemplateModel;
