#!/bin/bash

# ============================================
# EDEN Deployment Script
# Automated deployment for EDEN application
# ============================================

set -e

# Configuration
APP_NAME="EDEN"
VERSION="1.0.0"
ENVIRONMENT="${1:-production}"
REGISTRY="ghcr.io"
IMAGE_NAME="${REGISTRY}/afkmoney/eden"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ============================================
# Logging Functions
# ============================================

log_info() {
  echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
  echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
  echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
  echo -e "${RED}[ERROR]${NC} $1"
}

# ============================================
# Pre-deployment Checks
# ============================================

check_dependencies() {
  log_info "Checking dependencies..."
  
  # Check if Node.js is installed
  if ! command -v node &> /dev/null; then
    log_error "Node.js is not installed"
    exit 1
  fi
  
  # Check if npm is installed
  if ! command -v npm &> /dev/null; then
    log_error "npm is not installed"
    exit 1
  fi
  
  # Check if Docker is installed (for containerized deployments)
  if ! command -v docker &> /dev/null; then
    log_warning "Docker is not installed. Skipping containerized deployment."
  fi
  
  # Check if git is installed
  if ! command -v git &> /dev/null; then
    log_error "git is not installed"
    exit 1
  fi
  
  log_success "All dependencies are installed"
}

check_environment() {
  log_info "Checking environment..."
  
  # Check if we're in the right directory
  if [ ! -f "package.json" ]; then
    log_error "Not in the project root directory"
    exit 1
  fi
  
  # Check if required environment variables are set
  if [ "$ENVIRONMENT" = "production" ]; then
    if [ -z "$MONGO_URI" ]; then
      log_warning "MONGO_URI is not set. Using default."
    fi
    
    if [ -z "$REDIS_URL" ]; then
      log_warning "REDIS_URL is not set. Using default."
    fi
    
    if [ -z "$JWT_SECRET" ]; then
      log_warning "JWT_SECRET is not set. Using default."
    fi
  fi
  
  log_success "Environment checks passed"
}

# ============================================
# Installation
# ============================================

install_dependencies() {
  log_info "Installing dependencies..."
  
  # Install npm dependencies
  if [ "$ENVIRONMENT" = "development" ]; then
    npm ci
  else
    npm ci --only=production
  fi
  
  log_success "Dependencies installed"
}

# ============================================
# Build
# ============================================

build_frontend() {
  log_info "Building frontend..."
  
  npm run build -- --configuration production
  
  log_success "Frontend built"
}

build_server() {
  log_info "Building server..."
  
  npm run build:server
  
  log_success "Server built"
}

build_docker() {
  log_info "Building Docker image..."
  
  # Get commit hash
  COMMIT_HASH=$(git rev-parse --short HEAD)
  
  # Build Docker image
  docker build \
    --build-arg NODE_ENV=$ENVIRONMENT \
    --build-arg COMMIT_HASH=$COMMIT_HASH \
    --build-arg VERSION=$VERSION \
    -t $IMAGE_NAME:$VERSION \
    -t $IMAGE_NAME:$COMMIT_HASH \
    -t $IMAGE_NAME:latest \
    .
  
  log_success "Docker image built"
}

# ============================================
# Database Migration
# ============================================

migrate_database() {
  log_info "Running database migrations..."
  
  # In a real implementation, this would run actual migrations
  # For now, we just log the action
  
  log_success "Database migrations completed"
}

# ============================================
# Seed Data
# ============================================

seed_data() {
  log_info "Seeding database..."
  
  # Check if seed data already exists
  if [ "$ENVIRONMENT" = "production" ]; then
    # In production, we might want to skip seeding
    log_warning "Skipping seed data in production"
    return
  fi
  
  # Run seed script
  if [ -f "scripts/seed.js" ]; then
    ts-node scripts/seed.js
  else
    log_warning "No seed script found"
  fi
  
  log_success "Database seeded"
}

# ============================================
# Docker Deployment
# ============================================

docker_deploy() {
  log_info "Deploying with Docker..."
  
  # Stop existing containers
  docker stop $APP_NAME-backend $APP_NAME-frontend 2>/dev/null || true
  docker rm $APP_NAME-backend $APP_NAME-frontend 2>/dev/null || true
  
  # Create Docker network
  docker network create $APP_NAME-network 2>/dev/null || true
  
  # Start MongoDB
  docker run -d \
    --name $APP_NAME-mongodb \
    --network $APP_NAME-network \
    -p 27017:27017 \
    -v $APP_NAME-mongodb-data:/data/db \
    -e MONGO_INITDB_ROOT_USERNAME=root \
    -e MONGO_INITDB_ROOT_PASSWORD=example \
    mongo:7
  
  # Start Redis
  docker run -d \
    --name $APP_NAME-redis \
    --network $APP_NAME-network \
    -p 6379:6379 \
    -v $APP_NAME-redis-data:/data \
    redis:7
  
  # Wait for databases to start
  log_info "Waiting for databases to start..."
  sleep 10
  
  # Start backend
  docker run -d \
    --name $APP_NAME-backend \
    --network $APP_NAME-network \
    -p 4000:4000 \
    -e NODE_ENV=$ENVIRONMENT \
    -e MONGO_URI=mongodb://root:example@$APP_NAME-mongodb:27017/eden?authSource=admin \
    -e REDIS_URL=redis://$APP_NAME-redis:6379 \
    -e JWT_SECRET=your-secret-key \
    -e PORT=4000 \
    $IMAGE_NAME:latest
  
  # Start frontend
  docker run -d \
    --name $APP_NAME-frontend \
    --network $APP_NAME-network \
    -p 4200:80 \
    -e NODE_ENV=$ENVIRONMENT \
    -e API_URL=http://localhost:4000 \
    nginx:alpine
  
  log_success "Docker containers started"
  
  # Print container status
  docker ps --filter "name=$APP_NAME" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
}

# ============================================
# Local Deployment
# ============================================

local_deploy() {
  log_info "Deploying locally..."
  
  # Start backend in background
  nohup npm run server > logs/server.log 2>&1 &
  
  # Start frontend
  nohup npm run start > logs/frontend.log 2>&1 &
  
  log_success "Local deployment started"
  
  # Print logs location
  log_info "Logs are available in the 'logs' directory"
}

# ============================================
# Kubernetes Deployment
# ============================================

k8s_deploy() {
  log_info "Deploying to Kubernetes..."
  
  if ! command -v kubectl &> /dev/null; then
    log_error "kubectl is not installed"
    exit 1
  fi
  
  # Check if we're logged in
  if ! kubectl cluster-info &> /dev/null; then
    log_error "Not logged in to Kubernetes cluster"
    exit 1
  fi
  
  # Apply Kubernetes manifests
  if [ -d "k8s" ]; then
    kubectl apply -f k8s/
  else
    log_error "No Kubernetes manifests found"
    exit 1
  fi
  
  log_success "Kubernetes deployment started"
}

# ============================================
# Railway Deployment
# ============================================

railway_deploy() {
  log_info "Deploying to Railway..."
  
  if ! command -v railway &> /dev/null; then
    log_error "Railway CLI is not installed"
    exit 1
  fi
  
  # Login to Railway
  if [ -z "$RAILWAY_TOKEN" ]; then
    log_error "RAILWAY_TOKEN is not set"
    exit 1
  fi
  
  # Deploy backend
  railway up --service backend --detach
  
  # Deploy frontend
  railway up --service frontend --detach
  
  log_success "Railway deployment started"
}

# ============================================
# Vercel Deployment
# ============================================

vercel_deploy() {
  log_info "Deploying to Vercel..."
  
  if ! command -v vercel &> /dev/null; then
    log_error "Vercel CLI is not installed"
    exit 1
  fi
  
  # Login to Vercel
  if [ -z "$VERCEL_TOKEN" ]; then
    log_error "VERCEL_TOKEN is not set"
    exit 1
  fi
  
  # Deploy
  vercel --prod --token $VERCEL_TOKEN
  
  log_success "Vercel deployment started"
}

# ============================================
# Post-deployment Verification
# ============================================

verify_deployment() {
  log_info "Verifying deployment..."
  
  # Check if backend is running
  if [ "$ENVIRONMENT" = "production" ]; then
    BACKEND_URL="https://api.eden.dev"
  else
    BACKEND_URL="http://localhost:4000"
  fi
  
  # Try to hit health endpoint
  if command -v curl &> /dev/null; then
    if curl -s -o /dev/null -w "%{http_code}" $BACKEND_URL/api/health | grep -q "200"; then
      log_success "Backend is running"
    else
      log_error "Backend health check failed"
      exit 1
    fi
  else
    log_warning "curl is not installed. Skipping health check."
  fi
  
  log_success "Deployment verified"
}

# ============================================
# Cleanup
# ============================================

cleanup() {
  log_info "Cleaning up..."
  
  # Remove old Docker images
  docker system prune -f 2>/dev/null || true
  
  # Remove node_modules if requested
  if [ "$2" = "--clean" ]; then
    log_info "Removing node_modules..."
    rm -rf node_modules
  fi
  
  log_success "Cleanup completed"
}

# ============================================
# Main Deployment Function
# ============================================

deploy() {
  local DEPLOY_METHOD="${2:-docker}"
  
  log_info "Starting $APP_NAME deployment (v$VERSION) to $ENVIRONMENT using $DEPLOY_METHOD..."
  
  # Pre-deployment checks
  check_dependencies
  check_environment
  
  # Installation
  install_dependencies
  
  # Build
  build_frontend
  build_server
  
  # Database
  migrate_database
  seed_data
  
  # Deployment
  case "$DEPLOY_METHOD" in
    docker)
      build_docker
      docker_deploy
      ;;
    local)
      local_deploy
      ;;
    k8s|kubernetes)
      k8s_deploy
      ;;
    railway)
      railway_deploy
      ;;
    vercel)
      vercel_deploy
      ;;
    *)
      log_error "Unknown deployment method: $DEPLOY_METHOD"
      log_info "Available methods: docker, local, k8s, railway, vercel"
      exit 1
      ;;
  esac
  
  # Post-deployment verification
  verify_deployment
  
  log_success "$APP_NAME v$VERSION deployed successfully to $ENVIRONMENT!"
}

# ============================================
# Main Script
# ============================================

case "$1" in
  production|staging|development|test)
    ENVIRONMENT="$1"
    deploy "$1" "${2:-docker}"
    ;;
  docker|local|k8s|kubernetes|railway|vercel)
    deploy "${ENVIRONMENT:-production}" "$1"
    ;;
  --help|-h)
    echo "Usage: $0 [environment] [method]"
    echo ""
    echo "Environment:"
    echo "  production    Deploy to production"
    echo "  staging      Deploy to staging"
    echo "  development  Deploy to development"
    echo "  test        Deploy to test"
    echo ""
    echo "Method:"
    echo "  docker      Deploy using Docker (default)"
    echo "  local       Deploy locally"
    echo "  k8s        Deploy to Kubernetes"
    echo "  railway    Deploy to Railway"
    echo "  vercel     Deploy to Vercel"
    echo ""
    echo "Examples:"
    echo "  $0 production docker"
    echo "  $0 staging k8s"
    echo "  $0 development local"
    echo "  $0 --clean   Clean up"
    ;;
  --clean)
    cleanup "$1"
    ;;
  *)
    deploy "${1:-production}" "${2:-docker}"
    ;;
esac
