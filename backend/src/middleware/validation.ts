import { Request, Response, NextFunction } from 'express'
import Joi from 'joi'
import { DropletConfig } from '../types'

// Validation schema for droplet configuration
const dropletConfigSchema = Joi.object({
  integrationName: Joi.string().min(1).max(100).required(),
  companyName: Joi.string().min(1).max(100).required(),
  environment: Joi.string().valid('production', 'staging', 'development').required(),
  fluidApiKey: Joi.string().min(1).required(), // User provides their own Fluid API key
  webhookUrl: Joi.string().uri().allow('').optional()
})

/**
 * Validate droplet configuration
 */
export function validateDropletConfig(req: Request, res: Response, next: NextFunction) {
  const { error, value } = dropletConfigSchema.validate(req.body, {
    abortEarly: false,
    stripUnknown: true
  })

  if (error) {
    const errors = error.details.map(detail => ({
      field: detail.path.join('.'),
      message: detail.message
    }))

    return res.status(400).json({
      error: 'Validation failed',
      message: 'Invalid configuration data',
      details: errors
    })
  }

  // Replace req.body with validated and sanitized data
  req.body = value
  return next()
}

/**
 * Validate webhook event
 */
export function validateWebhookEvent(req: Request, res: Response, next: NextFunction) {
  // More flexible webhook validation - Fluid may send different formats
  const webhookSchema = Joi.object({
    id: Joi.string().optional(),
    type: Joi.string().optional(),
    data: Joi.object().optional(),
    timestamp: Joi.string().optional(),
    source: Joi.string().optional(),
    // Allow any additional fields that Fluid might send
    // This makes the validation more permissive
  }).unknown(true)

  const { error, value } = webhookSchema.validate(req.body, {
    abortEarly: false,
    stripUnknown: false // Don't strip unknown fields
  })

  if (error) {
    console.log('Webhook validation error:', error.details)
    console.log('Webhook payload:', JSON.stringify(req.body, null, 2))
    return res.status(400).json({
      error: 'Invalid webhook event',
      message: 'Webhook payload validation failed',
      details: error.details
    })
  }

  req.body = value
  return next()
}
