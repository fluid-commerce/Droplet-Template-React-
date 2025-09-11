import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import dotenv from 'dotenv'
import { dropletRoutes } from './routes/droplet'
import { webhookRoutes } from './routes/webhook'
import { errorHandler } from './middleware/errorHandler'
import { rateLimits } from './middleware/rateLimiting'
import { validateEnvironmentVariables, isDevelopment } from './utils/envValidation'
import { logger } from './services/logger'

// Load environment variables
dotenv.config()

// Validate environment variables on startup
validateEnvironmentVariables()

const app = express()
const PORT = process.env.PORT || 3001

// Configure trust proxy for production deployment (Render, Cloudflare, etc.)
if (process.env.NODE_ENV === 'production') {
  // Trust first proxy (Render) and specific IPs for Cloudflare
  app.set('trust proxy', 1)
} else {
  // In development, don't trust proxies
  app.set('trust proxy', false)
}

// Security middleware
app.use(helmet({
  contentSecurityPolicy: isDevelopment() ? false : undefined,
  crossOriginEmbedderPolicy: false // Allow embedding in Fluid platform
}))

// CORS configuration with environment-based origins
const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:3000',
  'https://fluid.app',
  'https://app.fluid.app'
]

if (isDevelopment()) {
  allowedOrigins.push('http://localhost:3000', 'http://localhost:5173')
}

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}))

// Request logging
app.use(morgan(isDevelopment() ? 'dev' : 'combined'))

// Body parsing with size limits
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// Apply general rate limiting
app.use(rateLimits.general)

// Routes
app.use('/api/droplet', dropletRoutes)
app.use('/api/webhook', webhookRoutes)
app.use('/api/webhooks', webhookRoutes) // Fluid uses plural "webhooks"

// Health check (with database connectivity test)
app.get('/health', async (req, res) => {
  const healthData: {
    status: string
    timestamp: string
    environment: string
    version: string
    uptime: number
    database?: { status: string; message: string }
  } = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    version: process.env.npm_package_version || '1.0.0',
    uptime: process.uptime()
  }

  try {
    // Test database connectivity
    const { getDatabaseService } = await import('./services/database')
    const database = getDatabaseService()
    const dbHealth = await database.healthCheck()
    
    healthData.database = dbHealth
    
    if (dbHealth.status === 'error') {
      healthData.status = 'degraded'
      return res.status(503).json(healthData)
    }
  } catch (error) {
    healthData.database = { status: 'error', message: 'Database check failed' }
    healthData.status = 'degraded'
    return res.status(503).json(healthData)
  }

  return res.json(healthData)
})

// Error handling
app.use(errorHandler)

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' })
})

app.listen(PORT, () => {
  logger.info(`🚀 Backend server running on port ${PORT}`)
  logger.info(`📊 Health check: http://localhost:${PORT}/health`)
  logger.info(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`)
  logger.info(`🔒 Security: Helmet enabled, CORS configured`)
  logger.info(`⚡ Rate limiting: Enabled for all endpoints`)
  logger.info(`🔐 Encryption: ${process.env.ENCRYPTION_KEY ? 'Enabled' : 'Disabled (using fallback)'}`)
  logger.info(`🪝 Webhook security: ${process.env.FLUID_WEBHOOK_SECRET ? 'Enabled' : 'Disabled'}`)
  
  if (isDevelopment()) {
    logger.warn('🔧 Running in development mode - some security features are relaxed')
  }
})

export default app
