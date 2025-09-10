import { Router, Request, Response } from 'express'
import { validateWebhookEvent } from '../middleware/validation'
import { WebhookEvent } from '../types'
import { logger } from '../services/logger'
import { getDatabaseService } from '../services/database'

const router = Router()

/**
 * POST /api/webhook/fluid
 * Handle webhooks from Fluid platform
 */
router.post('/fluid', validateWebhookEvent, async (req: Request, res: Response) => {
  try {
    // Log the raw webhook payload for debugging
    logger.info('Received Fluid webhook', {
      headers: req.headers,
      body: req.body,
      method: req.method,
      url: req.url
    })

    const event: WebhookEvent = req.body

    logger.info('Parsed Fluid webhook event', {
      id: event.id,
      type: event.type,
      timestamp: event.timestamp,
      source: event.source
    })

    // Handle different webhook event types
    switch (event.type) {
      case 'droplet_installed':
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
  
  try {
    const Database = getDatabaseService()
    
    // Extract company information from the webhook payload
    const companyData = event.data?.company || {}
    const installationId = event.data?.droplet_installation_uuid || event.data?.installation_id
    const companyId = event.data?.company_id || event.data?.fluid_company_id
    const companyName = companyData.name || 'Your Company'
    const authToken = companyData.authentication_token
    
    logger.info('Storing company information from webhook', {
      installationId,
      companyId,
      companyName,
      hasAuthToken: !!authToken
    })
    
    // Store the company information in the database
    await Database.query(`
      INSERT INTO droplet_installations (
        id, 
        company_id, 
        config, 
        authentication_token, 
        status, 
        created_at, 
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
      ON CONFLICT (id) DO UPDATE SET
        company_id = EXCLUDED.company_id,
        config = EXCLUDED.config,
        authentication_token = EXCLUDED.authentication_token,
        updated_at = NOW()
    `, [
      installationId,
      companyId,
      JSON.stringify({
        companyName: companyName,
        integrationName: `${companyName} Integration`,
        environment: 'production',
        webhookUrl: '',
        fluidApiKey: authToken
      }),
      authToken,
      'pending'
    ])
    
    logger.info('Successfully stored company information', {
      installationId,
      companyName
    })
    
  } catch (error: any) {
    logger.error('Failed to store company information from webhook', {
      eventId: event.id,
      error: error.message
    })
  }
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
