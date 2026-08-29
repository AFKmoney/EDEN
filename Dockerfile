# EDEN - Visual AI Graph IDE
# Multi-stage build for Angular SSR + Express Backend

# ============================================
# Stage 1: Builder
# ============================================
FROM node:20-alpine AS builder

WORKDIR /app

# Install git (needed for npm packages)
RUN apk add --no-cache git

# Copy package files
COPY package*.json ./
COPY angular.json ./

# Install all dependencies
RUN npm install

# Copy all source files
COPY . .

# Build Angular application
RUN npm run build

# ============================================
# Stage 2: Production
# ============================================
FROM node:20-alpine AS production

WORKDIR /app

# Install production dependencies only
COPY package*.json ./
RUN npm install --only=production

# Copy built files from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules

# Copy server configuration
COPY --from=builder /app/src/server.ts ./dist/server.js
COPY --from=builder /app/tsconfig.json ./

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Change ownership
RUN chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 4000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:4000/api/health || exit 1

# Start server
CMD ["node", "dist/server.js"]
