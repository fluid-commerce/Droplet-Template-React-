import rateLimit, { ipKeyGenerator } from 'express-rate-limit'
import { Request } from 'express'
import { logger } from '../services/logger'

// Helper function to properly handle IPv6 addresses and trust proxy
const getClientIdentifier = (req: Request): string => {
  // Use tenant installation ID if available (preferred for tenant-scoped limiting)
  if (req.tenant?.installationId) {
    return `tenant:${req.tenant.installationId}`
  }
  
  // For production with proxy, use the trusted forwarded IP
  let clientIP = req.ip || req.socket.remoteAddress || 'unknown'
  
  if (process.env.NODE_ENV === 'production') {
    // Get the real client IP from X-Forwarded-For or CF-Connecting-IP
    const cfIp = req.headers['cf-connecting-ip'] as string
    const forwardedFor = req.headers['x-forwarded-for'] as string
    const trueClientIp = req.headers['true-client-ip'] as string
    
    // Prefer Cloudflare's connecting IP, then true client IP, then forwarded for
    if (cfIp) clientIP = cfIp
    else if (trueClientIp) clientIP = trueClientIp
    else if (forwardedFor) {
      clientIP = forwardedFor.split(',')[0].trim()
    }
  }
  
  // Use express-rate-limit's IPv6-safe IP key generator with our resolved IP
  return ipKeyGenerator(clientIP)
}

/**
 * Rate limiting configuration for different endpoint types
 */

// General API rate limit - per IP
export const generalRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    error: 'Rate limit exceeded',
    message: 'Too many requests from this IP, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: getClientIdentifier, // Use our custom IP resolver
  handler: (req, res) => {
    logger.warn('Rate limit exceeded', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      path: req.path,
      method: req.method
    })
    res.status(429).json({
      error: 'Rate limit exceeded',
      message: 'Too many requests, please try again later'
    })
  }
})

// Tenant-specific rate limit - per tenant (installation_id)
export const tenantRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // Limit each tenant to 200 requests per windowMs (higher than IP limit)
  message: {
    error: 'Tenant rate limit exceeded',
    message: 'Too many requests for this installation, please try again later'
  },
  keyGenerator: getClientIdentifier,
  handler: (req, res) => {
    logger.warn('Tenant rate limit exceeded', {
      installationId: req.tenant?.installationId,
      companyId: req.tenant?.companyId,
      ip: req.ip,
      path: req.path,
      method: req.method
    })
    res.status(429).json({
      error: 'Tenant rate limit exceeded',
      message: 'Too many requests for this installation, please try again later'
    })
  }
})

// Configuration endpoint rate limit (more restrictive)
export const configRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit configuration changes to 10 per windowMs
  message: {
    error: 'Configuration rate limit exceeded',
    message: 'Too many configuration requests, please try again later'
  },
  keyGenerator: getClientIdentifier,
  handler: (req, res) => {
    logger.warn('Configuration rate limit exceeded', {
      installationId: req.tenant?.installationId,
      companyId: req.tenant?.companyId,
      ip: req.ip,
      path: req.path
    })
    res.status(429).json({
      error: 'Configuration rate limit exceeded',
      message: 'Too many configuration requests, please slow down'
    })
  }
})

// Webhook rate limit (per IP, more permissive for automated systems)
export const webhookRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 500, // Allow up to 500 webhook requests per 5 minutes
  message: {
    error: 'Webhook rate limit exceeded',
    message: 'Too many webhook requests, please check your webhook configuration'
  },
  keyGenerator: getClientIdentifier, // Use our custom IP resolver
  handler: (req, res) => {
    logger.warn('Webhook rate limit exceeded', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      contentType: req.get('Content-Type'),
      bodySize: req.get('Content-Length')
    })
    res.status(429).json({
      error: 'Webhook rate limit exceeded',
      message: 'Too many webhook requests, please check configuration'
    })
  }
})

// Test connection rate limit (more restrictive to prevent API key brute force)
export const testConnectionRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Limit test connections to 20 per windowMs
  message: {
    error: 'Test connection rate limit exceeded',
    message: 'Too many test connection requests, please try again later'
  },
  keyGenerator: getClientIdentifier, // Use our custom IP resolver
  handler: (req, res) => {
    logger.warn('Test connection rate limit exceeded', {
      ip: req.ip,
      hasApiKey: !!req.body.fluidApiKey,
      apiKeyPrefix: req.body.fluidApiKey?.substring(0, 10) + '...'
    })
    res.status(429).json({
      error: 'Test connection rate limit exceeded', 
      message: 'Too many test connection attempts, please wait before trying again'
    })
  }
})

// Export all rate limiters for easy use
export const rateLimits = {
  general: generalRateLimit,
  tenant: tenantRateLimit,
  config: configRateLimit,
  webhook: webhookRateLimit,
  testConnection: testConnectionRateLimit
}