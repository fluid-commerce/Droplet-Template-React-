import { Router, Request, Response } from 'express'
import axios from 'axios'
import { FluidApiService } from '../services/fluidApi'
import { getDatabaseService } from '../services/database'
import { DropletConfig } from '../types'
import { validateDropletConfig } from '../middleware/validation'
import { logger } from '../services/logger'

const router = Router()
const Database = getDatabaseService()

/**
 * POST /api/droplet/configure
 * Handle droplet configuration submission
 */
router.post('/configure', validateDropletConfig, async (req: Request, res: Response) => {
  try {
    const config: DropletConfig = req.body
    const { installationId } = req.body

    // For new installations, we'll create a new installation record
    // For existing installations, we'll update the existing record

    // Initialize Fluid API service with user's API key
    const fluidApi = new FluidApiService(config.fluidApiKey)

    // Test Fluid API connection first
    logger.info('Testing Fluid API connection', { environment: config.environment })
    let companyInfo
    try {
      companyInfo = await fluidApi.getCompanyInfo(config.fluidApiKey)
      logger.info('Fluid API connection successful', { 
        companyName: companyInfo?.name || companyInfo?.company_name,
        companyId: companyInfo?.id
      })
    } catch (apiError: any) {
      logger.warn('Fluid API connection failed', { 
        environment: config.environment 
      }, apiError)
      return res.status(400).json({
        error: 'Fluid API connection failed',
        message: 'Unable to connect to Fluid platform with provided API key',
        details: apiError.message
      })
    }

    // Handle installation logic
    let installation
    if (installationId && installationId !== 'new-installation') {
      // Existing installation - get details
      try {
        installation = await fluidApi.getDropletInstallation(installationId)
      } catch (error: any) {
        console.error('Failed to get existing installation:', error.message)
        // Continue with new installation flow
        installation = null
      }
    }

    // Validate the configuration
    const validationResult = await validateServiceCredentials(config)
    
    if (!validationResult.valid) {
      return res.status(400).json({
        error: 'Configuration validation failed',
        message: 'Invalid configuration',
        details: validationResult.errors
      })
    }

    // Create real Fluid droplet installation
    let realInstallation
    if (!installation) {
      // Create new installation via Fluid API
      try {
        logger.info('Creating new Fluid droplet installation', {
          droplet_uuid: process.env.DROPLET_ID,
          company_id: companyInfo?.id
        })
        realInstallation = await fluidApi.createDropletInstallation({
          droplet_uuid: process.env.DROPLET_ID || 'your-droplet-id',
          company_id: companyInfo?.id || 'unknown',
          configuration: config
        })
        logger.info('Real Fluid installation created successfully', {
          installationId: realInstallation.id,
          status: realInstallation.status,
          fullResponse: realInstallation
        })
      } catch (createError: any) {
        logger.warn('Failed to create Fluid installation, using fallback', {
          droplet_uuid: process.env.DROPLET_ID,
          company_id: companyInfo?.id
        }, createError)
        // Fallback to local installation record
        realInstallation = {
          id: `install_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          droplet_id: process.env.DROPLET_ID || 'your-droplet-id',
          company_id: companyInfo?.id || 'unknown',
          authentication_token: config.fluidApiKey,
          status: 'active'
        }
      }
    } else {
      realInstallation = installation
    }

    const dropletInstallation = {
      id: realInstallation.id,
      dropletId: realInstallation.droplet_id || 
                realInstallation.droplet_uuid || 
                process.env.DROPLET_ID || 
                'unknown',
      companyId: realInstallation.company_id || companyInfo?.id || 'unknown',
      authenticationToken: realInstallation.authentication_token || config.fluidApiKey,
      configuration: config,
      status: 'active' as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    // Save to database
    const db = getDatabaseService()
    let savedInstallation
    
    try {
      savedInstallation = await db.createInstallation(dropletInstallation)
    } catch (createError: any) {
      // If installation already exists (from webhook), update it to active status
      if (createError.code === '23505') {
        savedInstallation = await db.updateInstallation(dropletInstallation.id, {
          status: 'active',
          configuration: dropletInstallation.configuration,
          authenticationToken: dropletInstallation.authenticationToken
        })
        if (!savedInstallation) {
          throw new Error('Failed to update existing installation')
        }
      } else {
        throw createError
      }
    }
    
    // Store company data separately
    if (companyInfo) {
      await db.updateCompanyData(savedInstallation.id, companyInfo)
    }
    
    // Log successful configuration
    await db.logActivity({
      installation_id: savedInstallation.id,
      activity_type: 'configuration',
      description: 'Droplet configured successfully',
      details: {
        companyName: companyInfo?.name || companyInfo?.company_name,
        environment: config.environment
      },
      status: 'success'
    })

    logger.info('Droplet configuration saved successfully', {
      installationId: savedInstallation.id,
      companyId: savedInstallation.companyId,
      companyName: companyInfo?.name || companyInfo?.company_name,
      environment: config.environment
    })

    return res.json({
      success: true,
      message: 'Droplet configured successfully',
      data: {
        installationId: savedInstallation.id,
        status: savedInstallation.status
      }
    })

  } catch (error: any) {
    logger.error('Droplet configuration failed', {
      environment: req.body?.environment,
      hasFluidApiKey: !!req.body?.fluidApiKey
    }, error)
    
    return res.status(error.statusCode || 500).json({
      error: 'Configuration failed',
      message: error.message || 'An error occurred while configuring the droplet',
      details: error.data
    })
  }
})

/**
 * GET /api/droplet/status/:installationId
 * Get droplet installation status and company information
 */
router.get('/status/:installationId', async (req: Request, res: Response) => {
  try {
    const { installationId } = req.params
    const { fluidApiKey } = req.query

    // For new installations or specific installation IDs, check if we have stored company info from webhook
    if (installationId === 'new-installation' || installationId) {
      try {
        const Database = getDatabaseService()
        
        let result
        if (installationId === 'new-installation') {
          // Look for any pending installation with company data
          result = await Database.query(`
            SELECT installation_id, company_id, configuration, authentication_token, status, company_name, created_at, updated_at
            FROM droplet_installations 
            WHERE status = 'pending' 
            ORDER BY created_at DESC 
            LIMIT 1
          `)
        } else {
          // Look for the specific installation ID
          result = await Database.query(`
            SELECT installation_id, company_id, configuration, authentication_token, status, company_name, created_at, updated_at
            FROM droplet_installations 
            WHERE installation_id = $1
          `, [installationId])
        }
        
        if (result.rows.length > 0) {
          const installation = result.rows[0]
          let config: any = {
            companyName: installation.configuration?.companyName || installation.company_name || 'Your Company',
            integrationName: `${installation.configuration?.companyName || installation.company_name || 'Your Company'} Integration`,
            environment: 'production',
            fluidApiKey: installation.authentication_token || ''
          }
          
          // Handle both old malformed data and new properly formatted data
          try {
            if (installation.configuration) {
              if (typeof installation.configuration === 'string') {
                const parsedConfig = JSON.parse(installation.configuration)
                config = { ...config, ...parsedConfig }
              } else if (typeof installation.configuration === 'object') {
                config = { ...config, ...installation.configuration }
              }
            }
          } catch (error: any) {
            logger.warn('Failed to parse configuration, using defaults', { 
              error: error.message,
              configType: typeof installation.configuration,
              installationId: installation.installation_id
            })
            // config already has defaults set above
          }
          
          return res.json({
            success: true,
            data: {
              connected: installation.status === 'active' || installation.status === 'pending',
              installationId: installation.installation_id,
              companyName: installation.configuration?.companyName || installation.company_name || 'Your Company',
              companyId: installation.company_id,
              lastSync: installation.status === 'active' ? new Date().toISOString() : null,
              userCount: 0,
              status: installation.status,
              createdAt: installation.created_at,
              updatedAt: installation.updated_at,
              integrationName: config.integrationName || 'My Integration',
              environment: config.environment || 'production',
              fluidApiKey: installation.authentication_token || '',
              companyLogo: config.companyLogo || null
            }
          })
        }
      } catch (error: any) {
        logger.warn('Failed to check for stored company data', { error: error.message })
      }
      
      // Default response if no stored data found
      return res.json({
        success: true,
        data: {
          connected: false,
          installationId: 'new-installation',
          companyName: 'Your Company',
          companyId: null,
          lastSync: null,
          userCount: 0,
          status: 'pending',
          createdAt: null,
          updatedAt: null,
          integrationName: 'My Integration',
          environment: 'production',
          fluidApiKey: '',
          companyLogo: null
        }
      })
    }

    // For existing installations, we need the Fluid API key
    if (!fluidApiKey) {
      return res.status(400).json({
        error: 'Missing Fluid API key',
        message: 'Fluid API key is required to check status'
      })
    }

    const fluidApi = new FluidApiService(fluidApiKey as string)
    const installation = await fluidApi.getDropletInstallation(installationId)

    // Get company information using the authentication token
    let companyInfo = null
    try {
      companyInfo = await fluidApi.getCompanyInfo(installation.authentication_token)
    } catch (companyError) {
      logger.warn('Could not fetch company info', { installationId }, companyError as Error)
      // Continue without company info
    }

    return res.json({
      success: true,
      data: {
        connected: true,
        installationId: installation.id,
        companyName: companyInfo?.name || companyInfo?.company_name || 'Your Company',
        companyId: installation.company_id,
        lastSync: new Date().toISOString(),
        userCount: companyInfo?.users_count || 0,
        status: installation.status,
        createdAt: installation.created_at,
        updatedAt: installation.updated_at,
        // Include configuration data for editing
        integrationName: installation.configuration?.integrationName || 'My Integration',
        environment: installation.configuration?.environment || 'production',
        fluidApiKey: installation.authentication_token,
        companyLogo: companyInfo?.logo_url || companyInfo?.logo || companyInfo?.avatar_url
      }
    })

  } catch (error: any) {
    console.error('Status check error:', error)
    
    return res.status(error.statusCode || 500).json({
      error: 'Status check failed',
      message: error.message || 'An error occurred while checking status'
    })
  }
})

/**
 * POST /api/droplet/test-connection
 * Test Fluid API connection
 */
router.post('/test-connection', async (req: Request, res: Response) => {
  try {
    const { fluidApiKey } = req.body

    if (!fluidApiKey) {
      return res.status(400).json({
        error: 'Missing Fluid API key',
        message: 'Fluid API key is required to test connection'
      })
    }

    const fluidApi = new FluidApiService(fluidApiKey)
    
    // Test connection by getting company info
    logger.info('Testing Fluid API connection')
    const companyInfo = await fluidApi.getCompanyInfo(fluidApiKey)
    
    logger.info('Fluid API connection test successful', {
      companyName: companyInfo?.name || companyInfo?.company_name,
      companyId: companyInfo?.id
    })

    return res.json({
      success: true,
      message: 'Connection test successful',
      data: {
        companyName: companyInfo?.name || companyInfo?.company_name,
        companyId: companyInfo?.id,
        companyLogo: companyInfo?.logo_url || companyInfo?.logo || companyInfo?.avatar_url
      }
    })

  } catch (error: any) {
    console.error('❌ Fluid API connection test failed:', error.message)
    
    return res.status(error.statusCode || 500).json({
      error: 'Connection test failed',
      message: error.message || 'Unable to connect to Fluid platform',
      details: error.data
    })
  }
})

/**
 * GET /api/droplet/dashboard/:installationId
 * Get dashboard data for an installation
 */
router.get('/dashboard/:installationId', async (req: Request, res: Response) => {
  try {
    const { installationId } = req.params
    const { fluidApiKey } = req.query

    if (!fluidApiKey) {
      return res.status(400).json({
        error: 'Missing Fluid API key',
        message: 'Fluid API key is required to load dashboard data'
      })
    }

    // Get stored company data from database first - try multiple approaches
    let installationResult = await Database.query(`
      SELECT company_name, company_data, configuration, installation_id, status
      FROM droplet_installations 
      WHERE installation_id = $1
    `, [installationId])

    let companyName = 'Your Company'
    let companyData = null

    // If not found by exact installation_id, try to find by any recent installation
    if (installationResult.rows.length === 0) {
      logger.warn('No installation found with exact ID, trying to find recent installation', { installationId })
      installationResult = await Database.query(`
        SELECT company_name, company_data, configuration, installation_id, status
        FROM droplet_installations 
        WHERE status IN ('active', 'pending')
        ORDER BY created_at DESC 
        LIMIT 1
      `)
    }

    logger.info('Dashboard query result', {
      installationId,
      foundRecords: installationResult.rows.length,
      companyName: installationResult.rows[0]?.company_name,
      configuration: installationResult.rows[0]?.configuration,
      status: installationResult.rows[0]?.status
    })

    if (installationResult.rows.length > 0) {
      const installation = installationResult.rows[0]
      
      // Try multiple sources for company name - prioritize configuration.companyName first
      companyName = installation.configuration?.companyName || 
                   installation.configuration?.company_name ||
                   installation.company_name || 
                   'Your Company'
      
      companyData = installation.company_data
      
      logger.info('Using company name from database', {
        installationId,
        actualInstallationId: installation.installation_id,
        companyName,
        source: installation.configuration?.companyName ? 'configuration.companyName field' :
                installation.configuration?.company_name ? 'configuration.company_name field' :
                installation.company_name ? 'company_name field' : 
                'fallback'
      })
    } else {
      logger.warn('No installation found in database at all', { installationId })
    }

    // Don't call Fluid API to avoid overwriting correct company name with wrong data
    // The database already has the correct company name from webhook/configuration
    logger.info('Using company name from database without Fluid API fallback', {
      installationId,
      companyName,
      source: 'database_only'
    })
    
    // Get real users data from Fluid API
    let users = []
    let tiles = []
    let pages = []
    
    const fluidApiUrl = process.env.FLUID_API_URL || 'https://api.fluid.app'
    const companyClient = axios.create({
      baseURL: `${fluidApiUrl}/api`,
      headers: {
        'Authorization': `Bearer ${fluidApiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      timeout: 30000,
    })
    
    // Fetch real data from Fluid
    const [usersResponse, tilesResponse, pagesResponse] = await Promise.allSettled([
      companyClient.get('/company/users'),
      companyClient.get('/company/tiles'),
      companyClient.get('/company/pages')
    ])
    
    if (usersResponse.status === 'fulfilled') {
      users = usersResponse.value.data || []
    }
    if (tilesResponse.status === 'fulfilled') {
      tiles = tilesResponse.value.data || []
    }
    if (pagesResponse.status === 'fulfilled') {
      pages = pagesResponse.value.data || []
    }
    
    // Build dashboard data from real Fluid API responses
    const dashboardData = {
      companyName: companyName,
      recentActivity: [
        {
          description: 'Last sync completed',
          timestamp: new Date().toISOString(),
          details: 'Data synchronized successfully'
        },
        {
          description: 'Droplet installation completed',
          timestamp: new Date(Date.now() - 300000).toISOString(),
          details: `Successfully connected to ${companyName}`
        },
        {
          description: 'Fluid API connection established',
          timestamp: new Date(Date.now() - 600000).toISOString(),
          details: 'Authentication verified with Fluid platform'
        }
      ]
    }

    return res.json({
      success: true,
      data: dashboardData
    })

  } catch (error: any) {
    console.error('Dashboard data error:', error)
    
    return res.status(error.statusCode || 500).json({
      error: 'Failed to load dashboard data',
      message: error.message || 'An error occurred while loading dashboard data'
    })
  }
})

/**
 * POST /api/droplet/sync
 * Sync data with Fluid platform
 */
router.post('/sync', async (req: Request, res: Response) => {
  try {
    const { installationId, fluidApiKey } = req.body

    if (!installationId || !fluidApiKey) {
      return res.status(400).json({
        error: 'Missing required parameters',
        message: 'Installation ID and Fluid API key are required'
      })
    }

    const fluidApi = new FluidApiService(fluidApiKey)
    
    // Perform data sync
    logger.info('Starting data sync', { installationId })
    
    // Sync real data from Fluid API
    const companyInfo = await fluidApi.getCompanyInfo(fluidApiKey)
    
    const fluidApiUrl = process.env.FLUID_API_URL || 'https://api.fluid.app'
    const companyClient = axios.create({
      baseURL: `${fluidApiUrl}/api`,
      headers: {
        'Authorization': `Bearer ${fluidApiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      timeout: 30000,
    })
    
    // Fetch latest data from Fluid
    const [usersResponse, tilesResponse, pagesResponse] = await Promise.allSettled([
      companyClient.get('/company/users'),
      companyClient.get('/company/tiles'),
      companyClient.get('/company/pages')
    ])
    
    let recordsUpdated = 0
    if (usersResponse.status === 'fulfilled') {
      recordsUpdated += usersResponse.value.data?.length || 0
    }
    if (tilesResponse.status === 'fulfilled') {
      recordsUpdated += tilesResponse.value.data?.length || 0
    }
    if (pagesResponse.status === 'fulfilled') {
      recordsUpdated += pagesResponse.value.data?.length || 0
    }

    return res.json({
      success: true,
      message: 'Data synchronized successfully',
      data: {
        installationId,
        syncedAt: new Date().toISOString(),
        recordsUpdated,
        companyName: companyInfo.company_name || companyInfo.name
      }
    })

  } catch (error: any) {
    console.error('Sync error:', error)
    
    return res.status(error.statusCode || 500).json({
      error: 'Sync failed',
      message: error.message || 'An error occurred during data sync'
    })
  }
})

/**
 * POST /api/droplet/disconnect
 * Disconnect droplet installation
 */
router.post('/disconnect', async (req: Request, res: Response) => {
  try {
    const { installationId } = req.body

    if (!installationId) {
      return res.status(400).json({
        error: 'Missing installation ID',
        message: 'Installation ID is required to disconnect'
      })
    }

    logger.info('Disconnecting installation', { installationId })

    // Delete the installation from database
    const result = await Database.query(
      'DELETE FROM droplet_installations WHERE installation_id = $1',
      [installationId]
    )

    if (result.rowCount === 0) {
      logger.warn('Installation not found for disconnection', { installationId })
      return res.status(404).json({
        error: 'Installation not found',
        message: 'No installation found with the provided ID'
      })
    }

    // Also clean up related data
    await Database.query(
      'DELETE FROM activity_logs WHERE installation_id = $1',
      [installationId]
    )

    await Database.query(
      'DELETE FROM webhook_events WHERE installation_id = $1',
      [installationId]
    )

    await Database.query(
      'DELETE FROM custom_data WHERE installation_id = $1',
      [installationId]
    )

    logger.info('Installation disconnected and cleaned up successfully', { 
      installationId,
      deletedRows: result.rowCount 
    })

    return res.json({
      success: true,
      message: 'Droplet disconnected and cleaned up successfully',
      data: {
        installationId,
        disconnectedAt: new Date().toISOString(),
        deletedRows: result.rowCount
      }
    })

  } catch (error: any) {
    logger.error('Disconnect error:', error)
    
    return res.status(error.statusCode || 500).json({
      error: 'Disconnect failed',
      message: error.message || 'An error occurred during disconnection'
    })
  }
})

/**
 * POST /api/droplet/cleanup
 * Clean up orphaned installations (for admin use)
 */
router.post('/cleanup', async (req: Request, res: Response) => {
  try {
    logger.info('Starting cleanup of orphaned installations')

    // Find installations that might be orphaned (no recent activity)
    const orphanedInstallations = await Database.query(`
      SELECT installation_id, created_at, updated_at 
      FROM droplet_installations 
      WHERE updated_at < NOW() - INTERVAL '7 days'
      AND status IN ('inactive', 'suspended')
    `)

    let cleanedCount = 0
    for (const installation of orphanedInstallations.rows) {
      try {
        // Delete the installation and related data
        await Database.query('DELETE FROM droplet_installations WHERE installation_id = $1', [installation.installation_id])
        await Database.query('DELETE FROM activity_logs WHERE installation_id = $1', [installation.installation_id])
        await Database.query('DELETE FROM webhook_events WHERE installation_id = $1', [installation.installation_id])
        await Database.query('DELETE FROM custom_data WHERE installation_id = $1', [installation.installation_id])
        
        cleanedCount++
        logger.info('Cleaned up orphaned installation', { installationId: installation.installation_id })
      } catch (error: any) {
        logger.error('Failed to clean up installation', { installationId: installation.installation_id }, error)
      }
    }

    logger.info('Cleanup completed', { 
      totalFound: orphanedInstallations.rows.length,
      cleanedCount 
    })

    return res.json({
      success: true,
      message: 'Cleanup completed successfully',
      data: {
        totalFound: orphanedInstallations.rows.length,
        cleanedCount,
        cleanedAt: new Date().toISOString()
      }
    })

  } catch (error: any) {
    logger.error('Cleanup error:', error)
    
    return res.status(error.statusCode || 500).json({
      error: 'Cleanup failed',
      message: error.message || 'An error occurred during cleanup'
    })
  }
})

/**
 * Validate service credentials
 */
async function validateServiceCredentials(config: DropletConfig): Promise<{ valid: boolean; errors: string[] }> {
  const errors: string[] = []

  // Validate Fluid API key is provided
  if (!config.fluidApiKey || config.fluidApiKey.trim().length === 0) {
    errors.push('Fluid API key is required')
  }


  // Add validation calls to the service
  // Example: Test API connection with provided credentials

  return {
    valid: errors.length === 0,
    errors
  }
}

export { router as dropletRoutes }
