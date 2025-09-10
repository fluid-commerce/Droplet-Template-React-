import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import dotenv from 'dotenv'
import { dropletRoutes } from './routes/droplet'
import { webhookRoutes } from './routes/webhook'
import { errorHandler } from './middleware/errorHandler'

// Load environment variables
dotenv.config()

const app = express()
const PORT = process.env.PORT || 3001

// Middleware
app.use(helmet())
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}))
app.use(morgan('combined'))
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))

// Routes
app.use('/api/droplet', dropletRoutes)
app.use('/api/webhook', webhookRoutes)
app.use('/api/webhooks', webhookRoutes) // Fluid uses plural "webhooks"

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  })
})

// Error handling
app.use(errorHandler)

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' })
})

app.listen(PORT, () => {
  logger.info(`Backend server running on port ${PORT}`)
  logger.info(`Health check: http://localhost:${PORT}/health`)
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`)
})

export default app
