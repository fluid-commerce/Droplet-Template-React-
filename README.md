# Fluid Droplet Template - React + TypeScript

A React + TypeScript template for creating Fluid droplet services. This template provides iframe-embedded configuration interfaces for third-party integrations with the Fluid platform.

## Overview

Droplets are integrations between third-party services and Fluid. This template provides iframe-embedded configuration pages that appear when users install your droplet in the Fluid portal. The pages collect credentials and configure the integration between your service and Fluid.

## Prerequisites

- Node.js 18.0+ (recommended: 20.x)
- npm 8.0+ or yarn 1.22+
- Git
- PostgreSQL 15+ (for database features)

## Key Features

- **React 18** with TypeScript for type safety
- **Vite** for fast development and efficient bundling
- **Tailwind CSS 4.0** for modern styling
- **Font Awesome 6.7.2** for icons
- **Jest** and **Testing Library** for comprehensive testing
- **ESLint** and **TypeScript** for code quality
- **React Router** for client-side routing
- **Axios** for HTTP client functionality
- **PostgreSQL** with migrations for persistent data storage
- **Database migrations** for schema management

## Project Structure

```
├── frontend/           # React frontend application
│   ├── entrypoints/    # Iframe-embedded configuration pages
│   │   ├── DropletConfig.tsx  # Main configuration form
│   │   └── DropletSetup.tsx   # Setup progress page
│   ├── components/     # Reusable React components
│   │   ├── Button.tsx  # Button component
│   │   └── Card.tsx    # Card components
│   ├── clients/        # API client libraries
│   │   ├── fluidClient.ts  # Main Fluid platform client
│   │   ├── droplets.ts     # Droplet resource handler
│   │   └── index.ts        # Client factory
│   ├── lib/            # Utility functions and helpers
│   │   ├── utils.ts    # Common utilities
│   │   └── fontawesome.ts  # Font Awesome configuration
│   ├── types/          # TypeScript type definitions
│   │   └── index.ts    # Core types
│   ├── hooks/          # Custom React hooks
│   ├── utils/          # Additional utilities
│   └── test/           # Test setup and utilities
│       └── setup.ts    # Jest test setup
├── backend/            # Node.js backend API
│   ├── src/
│   │   ├── routes/     # API route handlers
│   │   │   ├── droplet.ts    # Droplet configuration routes
│   │   │   └── webhook.ts    # Webhook handling routes
│   │   ├── services/   # Business logic services
│   │   │   └── fluidApi.ts   # Fluid API integration
│   │   ├── middleware/ # Express middleware
│   │   │   ├── validation.ts # Request validation
│   │   │   └── errorHandler.ts # Error handling
│   │   ├── types/      # Backend type definitions
│   │   │   └── index.ts
│   │   └── index.ts    # Express app setup
│   ├── package.json    # Backend dependencies
│   └── tsconfig.json   # Backend TypeScript config
├── database/           # PostgreSQL database setup
│   ├── migrations/     # Database migration files
│   │   ├── 001_create_droplet_installations.sql
│   │   ├── 002_create_activity_logs.sql
│   │   ├── 003_create_webhook_events.sql
│   │   └── 004_create_custom_data.sql
│   ├── config.js       # Database configuration
│   ├── migrate.cjs     # Migration runner script
│   └── README.md       # Database setup guide
├── setup-database.sh   # Database setup script
├── render.yaml         # Render deployment configuration
└── package.json        # Root package.json with scripts
```

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd fluid-droplet-template
```

2. Install dependencies:
```bash
npm run install:all
# This installs dependencies for both frontend and backend
```

3. Set up the database (optional but recommended):
```bash
# Option 1: Use the automated setup script
npm run setup:db

# Option 2: Manual setup
# Install PostgreSQL, create database, then run migrations
npm run migrate
```

4. Start the development servers:
```bash
# Start both frontend and backend
npm run dev:full

# Or start them separately:
npm run dev          # Frontend only (port 3000)
npm run dev:backend  # Backend only (port 3001)
```

This will start:
- **Frontend**: Vite development server on `http://localhost:3000`
- **Backend**: Express API server on `http://localhost:3001`

## Available Scripts

### Frontend Scripts
- `npm run dev` - Start frontend development server
- `npm run build` - Build frontend for production
- `npm run preview` - Preview frontend production build
- `npm run test` - Run frontend tests
- `npm run test:watch` - Run frontend tests in watch mode
- `npm run test:coverage` - Run frontend tests with coverage
- `npm run lint` - Run ESLint on frontend
- `npm run lint:fix` - Fix ESLint errors in frontend
- `npm run type-check` - Run TypeScript type checking

### Backend Scripts
- `npm run dev:backend` - Start backend development server
- `npm run build:backend` - Build backend for production
- `npm run test:backend` - Run backend tests
- `npm run lint:backend` - Run ESLint on backend
- `npm run start:backend` - Start backend production server

### Full Stack Scripts
- `npm run dev:full` - Start both frontend and backend
- `npm run build:full` - Build both frontend and backend
- `npm run test:full` - Run tests for both frontend and backend
- `npm run lint:full` - Run ESLint on both frontend and backend
- `npm run install:all` - Install dependencies for both projects

### Database Scripts
- `npm run migrate` - Run all pending database migrations
- `npm run migrate:status` - Check migration status
- `npm run setup:db` - Run automated database setup script

## Database Setup

The template includes PostgreSQL with a complete migration system for persistent data storage.

### Quick Setup

**Option 1: Automated Setup (Recommended)**
```bash
npm run setup:db
```

**Option 2: Manual Setup**
```bash
# 1. Install PostgreSQL
# macOS: brew install postgresql
# Ubuntu: sudo apt install postgresql postgresql-contrib

# 2. Start PostgreSQL service
# macOS: brew services start postgresql
# Ubuntu: sudo systemctl start postgresql

# 3. Create database
createdb -U postgres fluid_droplet_db

# 4. Run migrations
npm run migrate
```

**Option 3: Docker Setup**
```bash
# Start PostgreSQL in Docker
docker run --name postgres-droplet -e POSTGRES_PASSWORD=password -e POSTGRES_DB=fluid_droplet_db -p 5432:5432 -d postgres:15

# Run migrations
npm run migrate
```

### Database Schema

The template creates these tables:
- **`droplet_installations`** - Stores installation data and configurations
- **`activity_logs`** - Tracks all activities and events
- **`webhook_events`** - Stores incoming webhook events
- **`custom_data`** - Flexible storage for custom data

### Migration Commands

```bash
# Run all pending migrations
npm run migrate

# Check migration status
npm run migrate:status

# View detailed database documentation
cat database/README.md
```

## Configuration

### Environment Variables

Create a `.env.local` file in the root directory:

```env
# Frontend Configuration
VITE_FLUID_API_URL=https://api.fluid.com
VITE_FLUID_API_KEY=your-api-key-here
VITE_FLUID_ENVIRONMENT=development

# Backend Configuration (create backend/.env)
DATABASE_URL=postgresql://postgres:password@localhost:5432/fluid_droplet_db
FLUID_API_KEY=your-builder-api-key
FLUID_API_URL=https://your-org.fluid.app
```

### Fluid Client Configuration

The Fluid client is configured through the `FluidClientFactory`:

```typescript
import { fluidClientFactory } from '@/clients'

const config = {
  apiUrl: process.env.VITE_FLUID_API_URL,
  apiKey: process.env.VITE_FLUID_API_KEY,
  environment: process.env.VITE_FLUID_ENVIRONMENT
}

fluidClientFactory.initialize(config)
```

## Usage

### How Droplets Work

1. **Create your droplet** using the Fluid API with an `embed_url` pointing to your configuration page
2. **Users install your droplet** in the Fluid portal
3. **Fluid opens an iframe** pointing to your `embed_url` with the company ID appended
4. **Your configuration page** collects credentials and sets up the integration
5. **Your backend** uses the Fluid API to complete the droplet installation

### Configuration Pages

The template includes two main entrypoints:

- **`/` (DropletConfig)** - Main configuration form for collecting API credentials, database settings, etc.
- **`/setup` (DropletSetup)** - Setup progress page showing the configuration steps

### Using the Fluid Client

```typescript
import { getDropletsClient } from '@/clients'

const dropletsClient = getDropletsClient()

// Get droplet installation details
const installation = await dropletsClient.getInstallation(installationId)

// Use the authentication token to make API calls as the company
const authToken = installation.authentication_token
```

## Testing

The template includes comprehensive testing setup with Jest and Testing Library:

```bash
# Run all tests
npm run test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### Writing Tests

```typescript
import { render, screen } from '@testing-library/react'
import { Button } from '@/components/Button'

test('renders button with text', () => {
  render(<Button>Click me</Button>)
  expect(screen.getByText('Click me')).toBeInTheDocument()
})
```

## Styling

The template uses Tailwind CSS 4.0 for styling. Custom styles are defined in `src/index.css` and component-specific styles use Tailwind utility classes.

### Custom Components

The template includes several pre-built components:
- `Button` - Various button styles and sizes
- `Card` - Card layout components
- `Layout` - Main application layout
- `Navigation` - Sidebar navigation
- `Header` - Top header component

## Deployment

### Build for Production

```bash
npm run build
```

This creates a `dist` folder with optimized production files.

### Environment Configuration

Make sure to set the correct environment variables for your deployment:

- `VITE_FLUID_API_URL` - Your Fluid API URL
- `VITE_FLUID_API_KEY` - Your API key
- `VITE_FLUID_ENVIRONMENT` - Environment (development/staging/production)

## Development

### Code Style

The project uses ESLint and Prettier for code formatting. Run `npm run lint:fix` to automatically fix formatting issues.

### Type Safety

TypeScript is configured with strict mode enabled. Run `npm run type-check` to verify type safety.

### Adding New Features

1. Create new components in `src/components/`
2. Add new pages in `src/pages/`
3. Extend the API client in `src/clients/`
4. Add types in `src/types/`
5. Write tests for new functionality

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Run the test suite
6. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Troubleshooting

### Database Issues

**PostgreSQL Connection Refused**
```bash
# Check if PostgreSQL is running
brew services list | grep postgresql  # macOS
sudo systemctl status postgresql      # Ubuntu

# Start PostgreSQL if not running
brew services start postgresql        # macOS
sudo systemctl start postgresql       # Ubuntu
```

**Migration Errors**
```bash
# Check migration status
npm run migrate:status

# Check database connection
node -e "require('./database/config').Database.testConnection()"
```

**Permission Issues**
```bash
# Create database with proper permissions
sudo -u postgres createdb fluid_droplet_db
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE fluid_droplet_db TO $USER;"
```

### Development Issues

**Port Already in Use**
```bash
# Kill processes on ports 3000 and 3001
lsof -ti:3000 | xargs kill -9
lsof -ti:3001 | xargs kill -9
```

**Module Not Found Errors**
```bash
# Reinstall all dependencies
rm -rf node_modules backend/node_modules
npm run install:all
```

## Support

For questions and support, please refer to the Fluid platform documentation or contact the development team.
