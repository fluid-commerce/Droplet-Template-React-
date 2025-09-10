#!/bin/bash

# 🚀 Fluid Droplet Template - One-Command Setup
# This script does EVERYTHING needed to get the project running

set -e  # Exit on any error

echo "🚀 Fluid Droplet Template - One-Command Setup"
echo "============================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

success() {
    echo -e "${GREEN}✅ $1${NC}"
}

warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    error "Node.js is not installed!"
    log "Please install Node.js 18+ from https://nodejs.org/"
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    error "Node.js version 18+ is required. You have version $(node -v)"
    log "Please upgrade Node.js from https://nodejs.org/"
    exit 1
fi

success "Node.js $(node -v) detected"

# Install dependencies
log "Installing dependencies..."
npm install
success "Dependencies installed"

# Run the auto-setup script
log "Running auto-setup..."
npm run setup
success "Auto-setup completed"

# Final success message
echo ""
success "🎉 Setup Complete! Your Fluid Droplet Template is ready!"
echo ""
log "Next steps:"
echo "1. Get your Fluid API key from https://fluid.app"
echo "2. Update FLUID_API_KEY in backend/.env"
echo "3. Run: npm run dev:full"
echo "4. Create your droplet: FLUID_API_KEY=your_key EMBED_URL=http://localhost:3000/ npm run create-droplet"
echo ""
log "Happy coding! 🚀"
