import { Router, Request, Response } from 'express'
import { validateWebhookEvent } from '../middleware/validation'
import { WebhookEvent } from '../types'
import { logger } from '../services/logger'

const router = Router()

/**
 * POST /api/webhook/fluid
 * Handle webhooks from Fluid platform
 */
router.post('/fluid', validateWebhookEvent, async (req: Request, res: Response) => {
  try {
    const event: WebhookEvent = req.body

    logger.info('Received Fluid webhook', {
      id: event.id,
      type: event.type,
      timestamp: event.timestamp,
      source: event.source
    })

    // Handle different webhook event types
    switch (event.type) {
      case 'droplet.installed':
        await handleDropletInstalled(event)
        break
      
      case 'droplet.uninstalled':
        await handleDropletUninstalled(event)
        break
      
      case 'droplet.updated':
        await handleDropletUpdated(event)
        break
      
      case 'company.created':
        await handleCompanyCreated(event)
        break
      
      case 'company.updated':
        await handleCompanyUpdated(event)
        break
      
      default:
        logger.warn('Unhandled webhook event type', { eventType: event.type, eventId: event.id })
    }

    res.json({
      success: true,
      message: 'Webhook processed successfully'
    })

  } catch (error: any) {
    console.error('Webhook processing error:', error)
    
    res.status(500).json({
      error: 'Webhook processing failed',
      message: error.message || 'An error occurred while processing the webhook'
    })
  }
})

/**
 * Handle droplet installed event
 */
async function handleDropletInstalled(event: WebhookEvent) {
  logger.info('Processing droplet installation', { 
    eventId: event.id,
    companyId: event.data?.company_id,
    installationId: event.data?.installation_id
  })
  
  // Implementation would include:
  // - Send welcome email
  // - Initialize data sync
  // - Set up monitoring
  // - Create initial configuration
}

/**
 * Handle droplet uninstalled event
 */
async function handleDropletUninstalled(event: WebhookEvent) {
  logger.info('Processing droplet uninstallation', { 
    eventId: event.id,
    companyId: event.data?.company_id,
    installationId: event.data?.installation_id
  })
  
  // Implementation would include:
  // - Clean up data
  // - Remove webhooks
  // - Send goodbye email
  // - Update analytics
}

/**
 * Handle droplet updated event
 */
async function handleDropletUpdated(event: WebhookEvent) {
  logger.info('Processing droplet update', { 
    eventId: event.id,
    companyId: event.data?.company_id,
    installationId: event.data?.installation_id
  })
  
  // Implementation would include:
  // - Update configuration
  // - Restart services if needed
  // - Notify users of changes
}

/**
 * Handle company created event
 */
async function handleCompanyCreated(event: WebhookEvent) {
  logger.info('Processing company creation', { 
    eventId: event.id,
    companyId: event.data?.company_id
  })
  
  // Implementation would include:
  // - Set up company-specific resources
  // - Initialize billing
  // - Send onboarding materials
}

/**
 * Handle company updated event
 */
async function handleCompanyUpdated(event: WebhookEvent) {
  logger.info('Processing company update', { 
    eventId: event.id,
    companyId: event.data?.company_id
  })
  
  // Implementation would include:
  // - Update company information
  // - Sync changes to external systems
  // - Update billing if needed
}

/**
 * GET /api/webhook/health
 * Webhook health check
 */
router.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    message: 'Webhook endpoint is healthy',
    timestamp: new Date().toISOString()
  })
})

export { router as webhookRoutes }
