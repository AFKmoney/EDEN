# EDEN Dockerfile
# Multi-stage build for EDEN application

# ============================================
# Stage 1: Build Frontend
# ============================================
FROM node:20-alpine AS frontend-builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY angular.json ./

# Install dependencies
RUN npm ci --no-optional

# Copy source files
COPY src/ ./src/
COPY public/ ./public/
COPY tsconfig*.json ./

# Build frontend
RUN npm run build -- --configuration production --aot --output-hashing all

# ============================================
# Stage 2: Build Server
# ============================================
FROM node:20-alpine AS server-builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig*.json ./

# Install dependencies
RUN npm ci --only=production --no-optional

# Copy server source
COPY src/server/ ./src/server/
COPY src/app/ ./src/app/

# Build server
RUN npm run build:server

# ============================================
# Stage 3: Final Image
# ============================================
FROM node:20-alpine AS final

# Set working directory
WORKDIR /app

# Create non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

# Copy built frontend from frontend-builder
COPY --from=frontend-builder /app/dist/browser/ ./dist/browser/

# Copy built server from server-builder
COPY --from=server-builder /app/dist/server/ ./dist/server/
COPY --from=server-builder /app/node_modules/ ./node_modules/

# Copy package files
COPY --from=server-builder /app/package*.json ./

# Create logs directory
RUN mkdir -p logs && chown -R appuser:appgroup logs

# Create uploads directory
RUN mkdir -p uploads && chown -R appuser:appgroup uploads

# Expose ports
EXPOSE 4000
EXPOSE 4200

# Set environment variables
ENV NODE_ENV=production
ENV PORT=4000
ENV MONGO_URI=mongodb://localhost:27017/eden
ENV REDIS_URL=redis://localhost:6379
ENV JWT_SECRET=your-secret-key
ENV ENABLE_METRICS=true
ENV ENABLE_FILE_LOGGING=true
ENV LOG_LEVEL=info

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:4000/api/health || exit 1

# Start server
CMD ["node", "dist/server/main.js"]
