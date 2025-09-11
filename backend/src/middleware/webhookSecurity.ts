import { Request, Response, NextFunction } from 'express'
import { createHmacSignature, verifyHmacSignature } from '../utils/encryption'
import { logger } from '../services/logger'

/**
 * Middleware to verify webhook signatures from Fluid platform
 * Ensures webhooks are authentic and haven't been tampered with
 */
export function verifyWebhookSignature(req: Request, res: Response, next: NextFunction) {
  try {
    const webhookSecret = process.env.FLUID_WEBHOOK_SECRET
    
    if (!webhookSecret) {
      logger.warn('FLUID_WEBHOOK_SECRET not configured - webhook signature verification disabled')
      return next()
    }

    // Get signature from headers (try different possible header names)
    const signature = req.headers['x-fluid-signature'] || 
                     req.headers['x-webhook-signature'] || 
                     req.headers['x-signature'] ||
                     req.headers['auth-token'] // Fluid might use auth-token

    if (!signature) {
      logger.warn('Webhook received without signature', {
        headers: req.headers,
        hasSecret: !!webhookSecret,
        possibleSignatureHeaders: [
          req.headers['x-fluid-signature'],
          req.headers['x-webhook-signature'], 
          req.headers['x-signature'],
          req.headers['auth-token']
        ].filter(Boolean)
      })
      
      // In development or if webhook secret not configured, allow unsigned webhooks
      if (process.env.NODE_ENV === 'development' || !webhookSecret) {
        logger.warn('Allowing unsigned webhook (development mode or no secret configured)')
        return next()
      }
      
      return res.status(401).json({
        error: 'Webhook signature required',
        message: 'Webhooks must include a valid signature header'
      })
    }

    // Get raw body for signature verification
    const rawBody = JSON.stringify(req.body)
    
    // Extract signature value (handle formats like "sha256=abcdef" or just "abcdef")
    let signatureValue = signature as string
    if (signatureValue.includes('=')) {
      signatureValue = signatureValue.split('=')[1]
    }

    // Verify the signature
    const isValid = verifyHmacSignature(rawBody, signatureValue, webhookSecret)
    
    if (!isValid) {
      logger.warn('Invalid webhook signature', {
        providedSignature: signatureValue.substring(0, 10) + '...',
        bodyLength: rawBody.length,
        headers: req.headers
      })
      
      return res.status(401).json({
        error: 'Invalid webhook signature',
        message: 'Webhook signature verification failed'
      })
    }

    logger.debug('Webhook signature verified successfully')
    next()
  } catch (error: any) {
    logger.error('Webhook signature verification error', {}, error)
    
    // In development, allow webhooks even if verification fails
    if (process.env.NODE_ENV === 'development') {
      logger.warn('Allowing webhook in development mode despite verification error')
      return next()
    }
    
    return res.status(500).json({
      error: 'Signature verification failed',
      message: 'An error occurred while verifying webhook signature'
    })
  }
}

/**
 * Middleware to capture raw body for signature verification
 * Must be applied before express.json() middleware
 */
export function captureRawBody(req: Request, res: Response, next: NextFunction) {
  let data = ''
  
  req.setEncoding('utf8')
  
  req.on('data', (chunk) => {
    data += chunk
  })
  
  req.on('end', () => {
    req.body = data
    next()
  })
}

/**
 * Validate webhook payload structure and tenant context
 */
export function validateWebhookPayload(req: Request, res: Response, next: NextFunction): void {
  try {
    const payload = req.body
    
    if (!payload || typeof payload !== 'object') {
      res.status(400).json({
        error: 'Invalid webhook payload',
        message: 'Webhook payload must be a valid JSON object'
      })
      return
    }

    // Extract installation/company information from different possible locations
    const installationId = payload.droplet_installation_uuid || 
                          payload.installation_id || 
                          payload.company?.droplet_installation_uuid ||
                          payload.data?.droplet_installation_uuid

    const companyId = payload.company_id || 
                     payload.fluid_company_id || 
                     payload.company?.fluid_company_id ||
                     payload.data?.company_id

    const eventType = payload.type || payload.event_name || payload.event_type

    // Log webhook details for debugging
    logger.info('Webhook payload validated', {
      eventType,
      installationId: installationId || 'not_found',
      companyId: companyId || 'not_found',
      hasCompanyData: !!payload.company,
      payloadKeys: Object.keys(payload)
    })

    // Add extracted info to request for easy access
    req.webhookContext = {
      installationId,
      companyId,
      eventType,
      originalPayload: payload
    }

    next()
  } catch (error: any) {
    logger.error('Webhook payload validation error', {}, error)
    res.status(400).json({
      error: 'Webhook validation failed',
      message: 'Failed to validate webhook payload structure'
    })
  }
}

// Extend Express Request to include webhook context
declare global {
  namespace Express {
    interface Request {
      webhookContext?: {
        installationId?: string
        companyId?: string
        eventType?: string
        originalPayload: any
      }
    }
  }
}