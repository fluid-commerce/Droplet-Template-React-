#!/usr/bin/env node

/**
 * 🚀 Fluid Droplet Template - Auto Setup Script
 * 
 * This script automatically sets up the entire development environment:
 * - Creates environment files from templates
 * - Detects and sets up PostgreSQL database
 * - Runs database migrations
 * - Validates the setup
 * 
 * Usage: npm run setup
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logStep(step, message) {
  log(`\n${step}. ${message}`, 'cyan');
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function logInfo(message) {
  log(`ℹ️  ${message}`, 'blue');
}

// Check if a command exists
function commandExists(command) {
  try {
    execSync(`which ${command}`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

// Check if PostgreSQL is running
function isPostgreSQLRunning() {
  try {
    execSync('pg_isready', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

// Generate random string for secrets
function generateSecret(length = 32) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Create environment file from template
function createEnvFile(templatePath, outputPath, replacements = {}) {
  if (fs.existsSync(outputPath)) {
    logWarning(`${path.basename(outputPath)} already exists, skipping...`);
    return;
  }

  let content = fs.readFileSync(templatePath, 'utf8');
  
  // Apply replacements
  Object.entries(replacements).forEach(([key, value]) => {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    content = content.replace(regex, value);
  });

  fs.writeFileSync(outputPath, content);
  logSuccess(`Created ${path.basename(outputPath)}`);
}

// Setup PostgreSQL database
async function setupDatabase() {
  logStep(1, 'Setting up PostgreSQL database...');

  // Check if PostgreSQL is installed
  if (!commandExists('psql')) {
    logError('PostgreSQL is not installed!');
    logInfo('Please install PostgreSQL:');
    logInfo('  macOS: brew install postgresql');
    logInfo('  Ubuntu: sudo apt install postgresql postgresql-contrib');
    logInfo('  Windows: Download from https://www.postgresql.org/download/');
    return false;
  }

  // Check if PostgreSQL is running
  if (!isPostgreSQLRunning()) {
    logWarning('PostgreSQL is not running. Attempting to start...');
    try {
      if (process.platform === 'darwin') {
        execSync('brew services start postgresql', { stdio: 'inherit' });
      } else if (process.platform === 'linux') {
        execSync('sudo systemctl start postgresql', { stdio: 'inherit' });
      }
      
      // Wait a moment for PostgreSQL to start
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      if (!isPostgreSQLRunning()) {
        logError('Failed to start PostgreSQL. Please start it manually.');
        return false;
      }
    } catch (error) {
      logError('Failed to start PostgreSQL automatically.');
      logInfo('Please start PostgreSQL manually and run this script again.');
      return false;
    }
  }

  // Create database if it doesn't exist
  const dbName = 'fluid_droplet_db';
  try {
    execSync(`createdb ${dbName}`, { stdio: 'ignore' });
    logSuccess(`Database '${dbName}' created successfully`);
  } catch (error) {
    // Database might already exist, which is fine
    logInfo(`Database '${dbName}' already exists or creation failed (this is usually fine)`);
  }

  return true;
}

// Run database migrations
function runMigrations() {
  logStep(2, 'Running database migrations...');
  
  try {
    execSync('npm run migrate', { 
      stdio: 'inherit',
      cwd: projectRoot 
    });
    logSuccess('Database migrations completed successfully');
    return true;
  } catch (error) {
    logError('Database migrations failed');
    logInfo('You may need to run migrations manually: npm run migrate');
    return false;
  }
}

// Create environment files
function createEnvironmentFiles() {
  logStep(3, 'Creating environment files...');

  const secrets = {
    JWT_SECRET: generateSecret(64),
    ENCRYPTION_KEY: generateSecret(32),
    FLUID_WEBHOOK_SECRET: generateSecret(32)
  };

  // Frontend environment file
  const frontendTemplate = path.join(projectRoot, 'env.example');
  const frontendEnv = path.join(projectRoot, '.env.local');
  
  if (fs.existsSync(frontendTemplate)) {
    createEnvFile(frontendTemplate, frontendEnv, {
      API_BASE_URL: 'http://localhost:3001',
      FLUID_API_URL: 'http://localhost:3001',
      FLUID_ENVIRONMENT: 'development',
      APP_NAME: 'Fluid Droplet Template'
    });
  }

  // Backend environment file
  const backendTemplate = path.join(projectRoot, 'backend', 'env.example');
  const backendEnv = path.join(projectRoot, 'backend', '.env');
  
  if (fs.existsSync(backendTemplate)) {
    createEnvFile(backendTemplate, backendEnv, {
      DATABASE_URL: 'postgresql://user:password@localhost:5432/fluid_droplet_db',
      JWT_SECRET: secrets.JWT_SECRET,
      ENCRYPTION_KEY: secrets.ENCRYPTION_KEY,
      FLUID_WEBHOOK_SECRET: secrets.FLUID_WEBHOOK_SECRET,
      PORT: '3001',
      NODE_ENV: 'development',
      FRONTEND_URL: 'http://localhost:3000'
    });
  }

  logSuccess('Environment files created with secure random secrets');
  return true;
}

// Validate setup
function validateSetup() {
  logStep(4, 'Validating setup...');

  const checks = [
    {
      name: 'Frontend dependencies',
      check: () => fs.existsSync(path.join(projectRoot, 'node_modules'))
    },
    {
      name: 'Backend dependencies', 
      check: () => fs.existsSync(path.join(projectRoot, 'backend', 'node_modules'))
    },
    {
      name: 'Frontend environment file',
      check: () => fs.existsSync(path.join(projectRoot, '.env.local'))
    },
    {
      name: 'Backend environment file',
      check: () => fs.existsSync(path.join(projectRoot, 'backend', '.env'))
    },
    {
      name: 'PostgreSQL connection',
      check: () => {
        try {
          execSync('psql -d fluid_droplet_db -c "SELECT 1;"', { stdio: 'ignore' });
          return true;
        } catch {
          return false;
        }
      }
    }
  ];

  let allPassed = true;
  checks.forEach(check => {
    if (check.check()) {
      logSuccess(check.name);
    } else {
      logError(check.name);
      allPassed = false;
    }
  });

  return allPassed;
}

// Main setup function
async function main() {
  log('🚀 Fluid Droplet Template - Auto Setup', 'bright');
  log('=====================================', 'bright');

  try {
    // Setup database
    const dbSetup = await setupDatabase();
    
    // Create environment files
    createEnvironmentFiles();
    
    // Run migrations if database setup was successful
    if (dbSetup) {
      runMigrations();
    }
    
    // Validate setup
    const isValid = validateSetup();
    
    log('\n🎉 Setup Complete!', 'bright');
    
    if (isValid) {
      logSuccess('Everything is ready to go!');
      log('\nNext steps:', 'cyan');
      log('1. Get your Fluid API key from https://fluid.app');
      log('2. Update the FLUID_API_KEY in backend/.env');
      log('3. Run: npm run dev:full');
      log('4. Create your droplet: FLUID_API_KEY=your_key EMBED_URL=http://localhost:3000/ npm run create-droplet');
    } else {
      logWarning('Setup completed with some issues. Please check the errors above.');
      logInfo('You can still proceed with development, but some features may not work.');
    }
    
  } catch (error) {
    logError(`Setup failed: ${error.message}`);
    process.exit(1);
  }
}

// Run the setup
main();
