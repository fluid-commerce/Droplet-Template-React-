import { Request, Response, NextFunction } from 'express'
import { getDatabaseService } from '../services/database'
import { logger } from '../services/logger'

// Extend Express Request to include tenant context
declare global {
  namespace Express {
    interface Request {
      tenant?: {
        installationId: string
        companyId: string
        authenticationToken: string
      }
    }
  }
}

/**
 * Middleware to authenticate and validate tenant access
 * Ensures users can only access data for their own installation
 */
export async function requireTenantAuth(req: Request, res: Response, next: NextFunction) {
  try {
    // Extract API key from Authorization header
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'Valid API key must be provided in Authorization header'
      })
    }

    const apiKey = authHeader.replace('Bearer ', '')
    if (!apiKey) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'API key cannot be empty'
      })
    }

    // Extract installation ID from route params or body
    const installationId = req.params.installationId || req.body.installationId
    if (!installationId || installationId === 'new-installation') {
      // For new installations, we'll handle this differently
      return next()
    }

    // Verify this API key owns this installation
    const Database = getDatabaseService()
    const installation = await Database.getInstallation(installationId)
    
    if (!installation) {
      return res.status(404).json({
        error: 'Installation not found',
        message: 'No installation found with the provided ID'
      })
    }

    // Compare the provided API key with the stored authentication token
    if (installation.authenticationToken !== apiKey) {
      logger.warn('Unauthorized tenant access attempt', {
        installationId,
        providedKey: apiKey.substring(0, 10) + '...',
        storedKey: installation.authenticationToken.substring(0, 10) + '...'
      })
      
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have access to this installation'
      })
    }

    // Add tenant context to request
    req.tenant = {
      installationId: installation.id,
      companyId: installation.companyId,
      authenticationToken: installation.authenticationToken
    }

    logger.debug('Tenant authentication successful', {
      installationId: req.tenant.installationId,
      companyId: req.tenant.companyId
    })

    next()
  } catch (error: any) {
    logger.error('Tenant authentication error', {}, error)
    return res.status(500).json({
      error: 'Authentication error',
      message: 'An error occurred during authentication'
    })
  }
}

/**
 * Optional tenant auth middleware for routes that can work with or without auth
 * Used for routes like status check that should handle both new and existing installations
 */
export async function optionalTenantAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization
    const installationId = req.params.installationId || req.body.installationId

    // If no auth header or new installation, skip tenant validation
    if (!authHeader || !authHeader.startsWith('Bearer ') || installationId === 'new-installation') {
      return next()
    }

    const apiKey = authHeader.replace('Bearer ', '')
    if (!apiKey || !installationId) {
      return next()
    }

    // Try to authenticate if we have both API key and installation ID
    const Database = getDatabaseService()
    const installation = await Database.getInstallation(installationId)
    
    if (installation && installation.authenticationToken === apiKey) {
      req.tenant = {
        installationId: installation.id,
        companyId: installation.companyId,
        authenticationToken: installation.authenticationToken
      }
      
      logger.debug('Optional tenant authentication successful', {
        installationId: req.tenant.installationId,
        companyId: req.tenant.companyId
      })
    }

    next()
  } catch (error: any) {
    logger.error('Optional tenant authentication error', {}, error)
    // Don't fail the request, just continue without tenant context
    next()
  }
}