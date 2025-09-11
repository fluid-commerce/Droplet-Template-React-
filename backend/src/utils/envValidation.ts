import { logger } from '../services/logger'

interface RequiredEnvVars {
  DATABASE_URL: string
  FLUID_API_KEY: string
  DROPLET_ID: string
  FLUID_API_URL: string
  FRONTEND_URL: string
  NODE_ENV: string
}

interface OptionalEnvVars {
  FLUID_WEBHOOK_SECRET?: string
  ENCRYPTION_KEY?: string
  JWT_SECRET?: string
  PORT?: string
  LOG_LEVEL?: string
}

/**
 * Validate that all required environment variables are set
 * Log warnings for missing optional variables
 */
export function validateEnvironmentVariables(): void {
  const missing: string[] = []
  const warnings: string[] = []

  // Check required variables
  const required: (keyof RequiredEnvVars)[] = [
    'DATABASE_URL',
    'FLUID_API_KEY', 
    'DROPLET_ID',
    'FLUID_API_URL',
    'FRONTEND_URL',
    'NODE_ENV'
  ]

  for (const envVar of required) {
    if (!process.env[envVar]) {
      missing.push(envVar)
    }
  }

  // Check optional but recommended variables
  const optional: (keyof OptionalEnvVars)[] = [
    'FLUID_WEBHOOK_SECRET',
    'ENCRYPTION_KEY',
    'JWT_SECRET'
  ]

  for (const envVar of optional) {
    if (!process.env[envVar]) {
      warnings.push(envVar)
    }
  }

  // Log results
  if (missing.length > 0) {
    logger.error('Missing required environment variables', {
      missing,
      nodeEnv: process.env.NODE_ENV,
      hasDatabase: !!process.env.DATABASE_URL,
      hasFluidKey: !!process.env.FLUID_API_KEY
    })
    
    console.error('❌ Missing required environment variables:')
    missing.forEach(envVar => console.error(`  - ${envVar}`))
    console.error('\nPlease set these variables in your .env file or environment')
    
    if (process.env.NODE_ENV === 'production') {
      process.exit(1)
    }
  }

  if (warnings.length > 0) {
    logger.warn('Missing optional environment variables - some features may not work properly', {
      warnings,
      nodeEnv: process.env.NODE_ENV
    })
    
    console.warn('⚠️  Missing optional environment variables:')
    warnings.forEach(envVar => console.warn(`  - ${envVar}`))
    console.warn('\nThese are optional but recommended for security')
  }

  // Validate specific formats
  validateDatabaseUrl()
  validateApiUrls()
  validateSecretFormats()

  logger.info('Environment validation completed', {
    required: required.length,
    missing: missing.length,
    warnings: warnings.length,
    nodeEnv: process.env.NODE_ENV
  })
}

function validateDatabaseUrl(): void {
  const dbUrl = process.env.DATABASE_URL
  if (dbUrl && !dbUrl.startsWith('postgresql://') && !dbUrl.startsWith('postgres://')) {
    logger.warn('DATABASE_URL may not be valid PostgreSQL connection string', {
      urlPrefix: dbUrl.substring(0, 20) + '...'
    })
  }
}

function validateApiUrls(): void {
  const fluidUrl = process.env.FLUID_API_URL
  const frontendUrl = process.env.FRONTEND_URL

  if (fluidUrl && !fluidUrl.startsWith('http://') && !fluidUrl.startsWith('https://')) {
    logger.warn('FLUID_API_URL should start with http:// or https://', {
      url: fluidUrl
    })
  }

  if (frontendUrl && !frontendUrl.startsWith('http://') && !frontendUrl.startsWith('https://')) {
    logger.warn('FRONTEND_URL should start with http:// or https://', {
      url: frontendUrl
    })
  }
}

function validateSecretFormats(): void {
  const webhookSecret = process.env.FLUID_WEBHOOK_SECRET
  const encryptionKey = process.env.ENCRYPTION_KEY
  const jwtSecret = process.env.JWT_SECRET

  if (webhookSecret && webhookSecret.length < 16) {
    logger.warn('FLUID_WEBHOOK_SECRET should be at least 16 characters for security')
  }

  if (encryptionKey && encryptionKey.length < 32) {
    logger.warn('ENCRYPTION_KEY should be at least 32 characters for AES-256')
  }

  if (jwtSecret && jwtSecret.length < 16) {
    logger.warn('JWT_SECRET should be at least 16 characters for security')
  }
}

/**
 * Get environment variable with fallback and validation
 */
export function getEnvVar(name: string, fallback?: string, required: boolean = false): string {
  const value = process.env[name] || fallback

  if (required && !value) {
    throw new Error(`Required environment variable ${name} is not set`)
  }

  return value || ''
}

/**
 * Check if running in production
 */
export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production'
}

/**
 * Check if running in development
 */
export function isDevelopment(): boolean {
  return process.env.NODE_ENV === 'development' || !process.env.NODE_ENV
}