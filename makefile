# Fluid Droplet Template Makefile

.PHONY: help install dev build test lint clean

# Default target
help:
	@echo "Available commands:"
	@echo "  setup      - 🚀 One-command auto-setup (recommended)"
	@echo "  install    - Install dependencies"
	@echo "  dev        - Start development server"
	@echo "  dev-auto   - Setup + start development servers"
	@echo "  build      - Build for production"
	@echo "  test       - Run tests"
	@echo "  lint       - Run linter"
	@echo "  clean      - Clean build artifacts"

# One-command auto-setup
setup:
	@echo "🚀 Running one-command auto-setup..."
	npm run setup:full

# Install dependencies
install:
	npm install

# Start development server
dev:
	npm run dev

# Setup + start development servers
dev-auto:
	@echo "🚀 Auto-setup + starting development servers..."
	npm run dev:auto

# Build for production
build:
	npm run build

# Run tests
test:
	npm run test

# Run tests with coverage
test-coverage:
	npm run test:coverage

# Run linter
lint:
	npm run lint

# Fix linting issues
lint-fix:
	npm run lint:fix

# Type check
type-check:
	npm run type-check

# Clean build artifacts
clean:
	rm -rf dist
	rm -rf node_modules/.vite
	rm -rf coverage

# Install and start development server (legacy)
setup-legacy: install dev
