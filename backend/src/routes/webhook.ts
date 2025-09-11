import { Router, Request, Response } from 'express'
import { validateWebhookEvent } from '../middleware/validation'
import { verifyWebhookSignature, validateWebhookPayload } from '../middleware/webhookSecurity'
import { rateLimits } from '../middleware/rateLimiting'
import { WebhookEvent } from '../types'
import { logger } from '../services/logger'
import { getDatabaseService } from '../services/database'

const router = Router()

// Apply webhook-specific rate limiting
router.use(rateLimits.webhook)

/**
 * POST /api/webhook/fluid
 * Handle webhooks from Fluid platform
 */
router.post('/fluid', verifyWebhookSignature, validateWebhookPayload, validateWebhookEvent, async (req: Request, res: Response) => {
  try {
    // Use webhook context from validation middleware
    const webhookContext = req.webhookContext
    const eventType = webhookContext?.eventType || req.body.type || req.body.event_name
    
    // Log the verified webhook for debugging (without sensitive data)
    logger.info('Processing verified Fluid webhook', {
      eventType,
      installationId: webhookContext?.installationId || 'not_found',
      companyId: webhookContext?.companyId || 'not_found',
      hasSignature: !!req.headers['x-fluid-signature'] || !!req.headers['x-webhook-signature'],
      ip: req.ip
    })

    // Use the validated webhook context
    const event: WebhookEvent = {
      id: req.body.id || `webhook_${Date.now()}`,
      type: eventType,
      event_name: eventType,
      data: req.body,
      timestamp: req.body.timestamp || new Date().toISOString(),
      source: req.body.source || 'fluid_platform'
    }

    // Handle different webhook event types
    switch (eventType) {
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
        logger.warn('Unhandled webhook event type', { 
          eventType: eventType, 
          eventId: event.id,
          installationId: webhookContext?.installationId,
          companyId: webhookContext?.companyId
        })
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
    
    // Debug: Log the full event data structure
    logger.info('Full webhook event data', { 
      eventData: event.data,
      companyData: event.data?.company,
      topLevelFields: Object.keys(event.data || {})
    })
    
    // Extract company information from the webhook payload
    const companyData = event.data?.company || {}
    const installationId = companyData.droplet_installation_uuid || event.data?.droplet_installation_uuid || event.data?.installation_id
    const companyId = event.data?.company_id || event.data?.fluid_company_id || companyData.fluid_company_id
    const companyName = companyData.name || 'Your Company'
    const authToken = companyData.authentication_token
    
    logger.info('Storing company information from webhook', {
      installationId,
      companyId,
      companyName,
      hasAuthToken: !!authToken
    })
    
    // Validate required data
    if (!installationId) {
      logger.error('Missing installation ID in webhook payload', { eventData: event.data })
      return
    }
    
    if (!companyName || companyName === 'Your Company') {
      logger.error('Missing or invalid company name in webhook payload', { companyData })
      return
    }
    
    // Store the company information in the database using the database service
    const installationData = {
      id: installationId,
      dropletId: event.data?.droplet_uuid || 'unknown',
      companyId: companyId,
      authenticationToken: authToken,
      configuration: {
        companyName: companyName,
        integrationName: `${companyName} Integration`,
        environment: 'production' as const,
        fluidApiKey: authToken
      },
      status: 'active' as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    // Try to create or update the installation
    try {
      await Database.createInstallation(installationData)
    } catch (error: any) {
      // If it already exists, update it
      if (error.code === '23505') { // unique constraint violation
        await Database.updateInstallation(installationId, {
          configuration: installationData.configuration,
          authenticationToken: authToken,
          status: 'active'
        })
      } else {
        throw error
      }
    }
    
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
  
  try {
    const Database = getDatabaseService()
    
    // Extract installation information from the webhook payload
    const companyData = event.data?.company || {}
    const installationId = companyData.droplet_installation_uuid || event.data?.droplet_installation_uuid || event.data?.installation_id
    const companyId = event.data?.company_id || event.data?.fluid_company_id || companyData.fluid_company_id
    
    if (!installationId) {
      logger.error('Missing installation ID in uninstall webhook payload', { eventData: event.data })
      return
    }

    logger.info('Removing installation from database', {
      installationId,
      companyId,
      eventId: event.id
    })

    // Delete the installation and all related data (CASCADE should handle related data)
    const result = await Database.query(
      'DELETE FROM droplet_installations WHERE installation_id = $1',
      [installationId]
    )

    if (result.rowCount > 0) {
      logger.info('Installation successfully removed from database', {
        installationId,
        companyId,
        deletedRows: result.rowCount
      })
    } else {
      logger.warn('Installation not found in database during uninstall', {
        installationId,
        companyId
      })
    }

    // Clean up any remaining related data explicitly (belt and suspenders approach)
    await Database.query('DELETE FROM activity_logs WHERE installation_id = $1', [installationId])
    await Database.query('DELETE FROM webhook_events WHERE installation_id = $1', [installationId])
    await Database.query('DELETE FROM custom_data WHERE installation_id = $1', [installationId])

    // Log the uninstallation activity (to a separate log table if needed)
    logger.info('Droplet uninstallation completed successfully', {
      installationId,
      companyId,
      eventId: event.id,
      timestamp: new Date().toISOString()
    })

  } catch (error: any) {
    logger.error('Failed to process droplet uninstallation', {
      eventId: event.id,
      error: error.message,
      installationId: event.data?.installation_id || event.data?.droplet_installation_uuid
    })
  }
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
