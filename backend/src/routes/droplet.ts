import { Router, Request, Response } from 'express'
import axios from 'axios'
import { FluidApiService } from '../services/fluidApi'
import { getDatabaseService } from '../services/database'
import { DropletConfig } from '../types'
import { validateDropletConfig } from '../middleware/validation'
import { requireTenantAuth, optionalTenantAuth } from '../middleware/tenantAuth'
import { rateLimits } from '../middleware/rateLimiting'
import { logger } from '../services/logger'

/**
 * Generate realistic simulated webhook data for different webhook types
 */
function generateSimulatedWebhookData(webhookType: string, testData: any = {}) {
  const timestamp = new Date().toISOString()
  const id = `sim_${Date.now()}_${Math.random().toString(36).substring(7)}`
  
  const baseData = {
    id,
    type: webhookType,
    simulated: true,
    created_at: timestamp,
    updated_at: timestamp,
    ...testData
  }

  switch (webhookType) {
    case 'cart_abandoned':
    case 'cart_updated':
      return {
        ...baseData,
        cart_token: `cart_${Date.now()}`,
        total_amount: testData.total_amount || 159.98,
        currency: testData.currency || 'USD',
        items_count: testData.items_count || 2,
        customer_email: testData.customer_email || `cart-${Date.now()}@test.com`,
        abandoned_at: webhookType === 'cart_abandoned' ? timestamp : null
      }

    case 'subscription_started':
    case 'subscription_paused':
    case 'subscription_cancelled':
      return {
        ...baseData,
        subscription_id: `sub_${Date.now()}`,
        customer_email: testData.customer_email || `sub-${Date.now()}@test.com`,
        plan_name: testData.plan_name || 'Monthly Premium Plan',
        amount: testData.amount || 29.99,
        status: webhookType.split('_')[1]
      }

    case 'popup_submitted':
    case 'webchat_submitted':
      return {
        ...baseData,
        visitor_email: testData.visitor_email || `visitor-${Date.now()}@test.com`,
        message: testData.message || 'Test message via webhook',
        page_url: testData.page_url || 'https://example.com'
      }

    default:
      return {
        ...baseData,
        message: `Simulated ${webhookType} webhook event`,
        details: testData
      }
  }
}

const router = Router()
const Database = getDatabaseService()

// Apply general rate limiting to all routes
router.use(rateLimits.general)

/**
 * POST /api/droplet/configure
 * Handle droplet configuration submission
 */
router.post('/configure', rateLimits.config, validateDropletConfig, async (req: Request, res: Response) => {
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
router.get('/status/:installationId', optionalTenantAuth, async (req: Request, res: Response) => {
  try {
    const { installationId } = req.params
    const { fluidApiKey } = req.query

    // Handle new installations vs existing installations
    if (installationId === 'new-installation') {
      // For new installations, return default state
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

    // For specific installation IDs, check if we have stored data
    if (installationId) {
      try {
        const Database = getDatabaseService()
        
        // Only look for the specific installation ID - no fallback to other tenants
        const result = await Database.query(`
          SELECT installation_id, company_id, configuration, authentication_token, status, company_name, created_at, updated_at
          FROM droplet_installations 
          WHERE installation_id = $1
        `, [installationId])
        
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
        logger.warn('Failed to check for stored installation data', { 
          installationId,
          error: error.message 
        })
        
        return res.status(500).json({
          error: 'Database error',
          message: 'Failed to retrieve installation data'
        })
      }
      
      // If no stored data found for this specific installation, return 404
      return res.status(404).json({
        error: 'Installation not found',
        message: 'No installation found with the provided ID'
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
router.post('/test-connection', rateLimits.testConnection, async (req: Request, res: Response) => {
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

// Helper function to get recent activity from database
async function getRecentActivity(installationId: string) {
  try {
    const result = await Database.query(`
      SELECT 
        activity_type,
        details,
        status,
        created_at as timestamp
      FROM activity_logs 
      WHERE installation_id = $1 
      ORDER BY created_at DESC 
      LIMIT 10
    `, [installationId])

    return result.rows.map((row: any) => ({
      description: formatActivityDescription(row.activity_type, row.details),
      timestamp: row.timestamp,
      details: formatActivityDetails(row.activity_type, row.details, row.status)
    }))
  } catch (error) {
    console.error('Error fetching recent activity:', error)
    return []
  }
}

// Helper function to format activity descriptions
function formatActivityDescription(eventType: string, eventData: any) {
  switch (eventType) {
    case 'configuration':
    case 'configuration_completed':
      return 'Droplet configuration completed'
    case 'sync':
    case 'sync_completed':
      return 'Data synchronization completed'
    case 'webhook_test':
      return 'Webhook test completed'
    case 'webhook_received':
      return 'Webhook event received'
    case 'webhook_processed':
      return 'Webhook event processed'
    case 'installation_created':
      return 'Droplet installation created'
    case 'api_connection_test':
      return 'API connection tested'
    default:
      return eventType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
  }
}

// Helper function to format activity details
function formatActivityDetails(eventType: string, eventData: any, status: string) {
  const data = typeof eventData === 'string' ? JSON.parse(eventData) : eventData
  
  switch (eventType) {
    case 'configuration':
    case 'configuration_completed':
      return `Successfully connected to ${data?.companyName || 'your service'}`
    case 'sync':
    case 'sync_completed':
      return status === 'success' ? 'Data synchronized successfully' : 'Sync failed'
    case 'webhook_test':
      return status === 'success' ? `Test webhook ${data?.webhookType || 'event'} completed` : 'Webhook test failed'
    case 'webhook_received':
      return `Received ${data?.webhookType || 'webhook'} event`
    case 'webhook_processed':
      return status === 'success' ? 'Webhook processed successfully' : 'Webhook processing failed'
    case 'installation_created':
      return 'New droplet installation created'
    case 'api_connection_test':
      return status === 'success' ? 'API connection verified' : 'API connection failed'
    default:
      return status === 'success' ? 'Operation completed successfully' : 'Operation failed'
  }
}

/**
 * GET /api/droplet/dashboard/:installationId
 * Get dashboard data for an installation
 */
router.get('/dashboard/:installationId', optionalTenantAuth, rateLimits.tenant, async (req: Request, res: Response) => {
  try {
    // Handle both authenticated and query parameter scenarios
    let tenantInstallationId: string
    let tenantCompanyId: string
    let apiKey: string

    if (req.tenant) {
      // Use authenticated tenant data (preferred)
      tenantInstallationId = req.tenant.installationId
      tenantCompanyId = req.tenant.companyId
      apiKey = req.tenant.authenticationToken

      logger.info('Loading dashboard for authenticated tenant', {
        installationId: tenantInstallationId,
        companyId: tenantCompanyId
      })
    } else {
      // Fallback to query parameters for compatibility
      const { installationId } = req.params
      const { fluidApiKey } = req.query

      if (!installationId || !fluidApiKey) {
        return res.status(400).json({
          error: 'Missing required parameters',
          message: 'Installation ID and Fluid API key are required'
        })
      }

      // Verify the API key owns this installation
      const installation = await Database.getInstallation(installationId)
      if (!installation) {
        return res.status(404).json({
          error: 'Installation not found',
          message: 'No installation found with the provided ID'
        })
      }

      if (installation.authenticationToken !== fluidApiKey) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'You do not have access to this installation'
        })
      }

      tenantInstallationId = installation.id
      tenantCompanyId = installation.companyId
      apiKey = installation.authenticationToken

      logger.info('Loading dashboard via query parameters', {
        installationId: tenantInstallationId,
        companyId: tenantCompanyId
      })
    }

    // Get stored company data for this specific tenant only
    const installationResult = await Database.query(`
      SELECT company_name, company_data, configuration, installation_id, status, created_at, updated_at, customer_api_key
      FROM droplet_installations 
      WHERE installation_id = $1
    `, [tenantInstallationId])

    let companyName = 'Your Company'
    let companyData = null

    if (installationResult.rows.length === 0) {
      // This should not happen since auth middleware verified the installation exists
      logger.error('Authenticated tenant installation not found in database', {
        installationId: tenantInstallationId
      })
      
      return res.status(500).json({
        error: 'Installation data inconsistent',
        message: 'Installation authentication succeeded but data not found'
      })
    }

    const installation = installationResult.rows[0]
    
    // Extract company name from configuration or fallback
    companyName = installation.configuration?.companyName || 
                 installation.configuration?.company_name ||
                 installation.company_name || 
                 'Your Company'
    
    companyData = installation.company_data
    
    logger.info('Using company data for authenticated tenant', {
      installationId: tenantInstallationId,
      companyId: tenantCompanyId,
      companyName,
      status: installation.status
    })

    // Get real data from Fluid API using the authenticated tenant's API key
    let users = []
    let tiles = []
    let pages = []
    let brandGuidelines = null
    
    const fluidApiUrl = process.env.FLUID_API_URL || 'https://api.fluid.app'
    const companyClient = axios.create({
      baseURL: `${fluidApiUrl}/api`,
      headers: {
        'Authorization': `Bearer ${apiKey}`, // Use tenant's API key from auth
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      timeout: 30000,
    })
    
    // Fetch real data from Fluid
    const [usersResponse, tilesResponse, pagesResponse, brandGuidelinesResponse] = await Promise.allSettled([
      companyClient.get('/company/users'),
      companyClient.get('/company/tiles'),
      companyClient.get('/company/pages'),
      companyClient.get('/settings/brand_guidelines')
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
    if (brandGuidelinesResponse.status === 'fulfilled') {
      brandGuidelines = brandGuidelinesResponse.value.data
    }
    
    // Build dashboard data from real Fluid API responses
    const dashboardData = {
      companyName: companyName,
      brandGuidelines: brandGuidelines,
      recentActivity: await getRecentActivity(tenantInstallationId),
      hasCustomerApiKey: !!installation.customer_api_key,
      authenticationToken: apiKey
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
router.post('/sync', optionalTenantAuth, rateLimits.tenant, async (req: Request, res: Response) => {
  try {
    // Handle both authenticated and request body scenarios
    let tenantInstallationId: string
    let tenantApiKey: string

    if (req.tenant) {
      // Use authenticated tenant data (preferred)
      tenantInstallationId = req.tenant.installationId
      tenantApiKey = req.tenant.authenticationToken
    } else {
      // Fallback to request body for compatibility
      const { installationId, fluidApiKey } = req.body

      if (!installationId || !fluidApiKey) {
        return res.status(400).json({
          error: 'Missing required parameters',
          message: 'Installation ID and Fluid API key are required'
        })
      }

      // Verify the API key owns this installation
      const installation = await Database.getInstallation(installationId)
      if (!installation) {
        return res.status(404).json({
          error: 'Installation not found',
          message: 'No installation found with the provided ID'
        })
      }

      if (installation.authenticationToken !== fluidApiKey) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'You do not have access to this installation'
        })
      }

      tenantInstallationId = installation.id
      tenantApiKey = installation.authenticationToken
    }

    const fluidApi = new FluidApiService(tenantApiKey)
    
    // Perform data sync
    logger.info('Starting data sync for tenant', { 
      installationId: tenantInstallationId
    })
    
    // Get latest company info and update database
    const companyInfo = await fluidApi.getCompanyInfo(tenantApiKey)
    
    // Update company data in database
    await Database.updateCompanyData(tenantInstallationId, companyInfo)
    
    // Sync latest data from Fluid API
    const fluidApiUrl = process.env.FLUID_API_URL || 'https://api.fluid.app'
    const companyClient = axios.create({
      baseURL: `${fluidApiUrl}/api`,
      headers: {
        'Authorization': `Bearer ${tenantApiKey}`,
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
    let syncDetails: any = {}
    
    if (usersResponse.status === 'fulfilled') {
      const users = usersResponse.value.data
      recordsUpdated += users?.length || 0
      syncDetails.users = users?.length || 0
      
      // Store users data
      if (users && users.length > 0) {
        await Database.query(`
          INSERT INTO custom_data (installation_id, data_type, data_key, data_value, updated_at)
          VALUES ($1, $2, $3, $4, NOW())
          ON CONFLICT (installation_id, data_type, data_key) 
          DO UPDATE SET data_value = $4, updated_at = NOW()
        `, [tenantInstallationId, 'sync_data', 'users', JSON.stringify(users)])
      }
    }
    
    if (tilesResponse.status === 'fulfilled') {
      const tiles = tilesResponse.value.data
      recordsUpdated += tiles?.length || 0
      syncDetails.tiles = tiles?.length || 0
      
      // Store tiles data
      if (tiles && tiles.length > 0) {
        await Database.query(`
          INSERT INTO custom_data (installation_id, data_type, data_key, data_value, updated_at)
          VALUES ($1, $2, $3, $4, NOW())
          ON CONFLICT (installation_id, data_type, data_key) 
          DO UPDATE SET data_value = $4, updated_at = NOW()
        `, [tenantInstallationId, 'sync_data', 'tiles', JSON.stringify(tiles)])
      }
    }
    
    if (pagesResponse.status === 'fulfilled') {
      const pages = pagesResponse.value.data
      recordsUpdated += pages?.length || 0
      syncDetails.pages = pages?.length || 0
      
      // Store pages data
      if (pages && pages.length > 0) {
        await Database.query(`
          INSERT INTO custom_data (installation_id, data_type, data_key, data_value, updated_at)
          VALUES ($1, $2, $3, $4, NOW())
          ON CONFLICT (installation_id, data_type, data_key) 
          DO UPDATE SET data_value = $4, updated_at = NOW()
        `, [tenantInstallationId, 'sync_data', 'pages', JSON.stringify(pages)])
      }
    }
    
    // Log sync activity
    await Database.logActivity({
      installation_id: tenantInstallationId,
      activity_type: 'sync',
      description: 'Data synchronized with Fluid platform',
      details: syncDetails,
      status: 'success'
    })

    return res.json({
      success: true,
      message: 'Data synchronized successfully',
      data: {
        installationId: tenantInstallationId,
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
router.post('/disconnect', requireTenantAuth, rateLimits.config, async (req: Request, res: Response) => {
  try {
    // Use authenticated tenant data - no need for request body validation
    const tenantInstallationId = req.tenant!.installationId
    const tenantCompanyId = req.tenant!.companyId

    logger.info('Disconnecting authenticated tenant installation', { 
      installationId: tenantInstallationId,
      companyId: tenantCompanyId
    })

    // Delete the tenant's installation from database (and only theirs)
    const result = await Database.query(
      'DELETE FROM droplet_installations WHERE installation_id = $1',
      [tenantInstallationId]
    )

    if (result.rowCount === 0) {
      // This should not happen since auth middleware verified the installation exists
      logger.error('Authenticated installation not found for disconnection', { 
        installationId: tenantInstallationId 
      })
      return res.status(500).json({
        error: 'Installation data inconsistent',
        message: 'Installation authentication succeeded but data not found'
      })
    }

    // Also clean up related data (CASCADE should handle this, but explicit cleanup for audit)
    await Database.query(
      'DELETE FROM activity_logs WHERE installation_id = $1',
      [tenantInstallationId]
    )

    await Database.query(
      'DELETE FROM webhook_events WHERE installation_id = $1',
      [tenantInstallationId]
    )

    await Database.query(
      'DELETE FROM custom_data WHERE installation_id = $1',
      [tenantInstallationId]
    )

    logger.info('Tenant installation disconnected and cleaned up successfully', { 
      installationId: tenantInstallationId,
      companyId: tenantCompanyId,
      deletedRows: result.rowCount 
    })

    return res.json({
      success: true,
      message: 'Droplet disconnected and cleaned up successfully',
      data: {
        installationId: tenantInstallationId,
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
 * POST /api/droplet/uninstall
 * Handle manual uninstall (for cases where webhook doesn't fire)
 */
router.post('/uninstall', rateLimits.config, async (req: Request, res: Response) => {
  try {
    const { installationId, fluidApiKey } = req.body
    
    if (!installationId) {
      return res.status(400).json({
        error: 'Missing installation ID',
        message: 'Installation ID is required for uninstall'
      })
    }

    if (!fluidApiKey) {
      return res.status(400).json({
        error: 'Missing Fluid API key',
        message: 'Fluid API key is required for uninstall verification'
      })
    }

    logger.info('Processing manual uninstall request', { 
      installationId: installationId,
      hasApiKey: !!fluidApiKey
    })

    // Verify the API key owns this installation
    const installation = await Database.getInstallation(installationId)
    if (!installation) {
      return res.status(404).json({
        error: 'Installation not found',
        message: 'No installation found with the provided ID'
      })
    }

    if (installation.authenticationToken !== fluidApiKey) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have access to this installation'
      })
    }

    // Delete the installation and all related data
    const result = await Database.query(
      'DELETE FROM droplet_installations WHERE installation_id = $1',
      [installationId]
    )

    if (result.rowCount === 0) {
      return res.status(500).json({
        error: 'Uninstall failed',
        message: 'Installation could not be removed from database'
      })
    }

    // Clean up related data explicitly
    await Database.query('DELETE FROM activity_logs WHERE installation_id = $1', [installationId])
    await Database.query('DELETE FROM webhook_events WHERE installation_id = $1', [installationId])
    await Database.query('DELETE FROM custom_data WHERE installation_id = $1', [installationId])

    logger.info('Manual uninstall completed successfully', { 
      installationId: installationId,
      companyId: installation.companyId,
      deletedRows: result.rowCount 
    })

    return res.json({
      success: true,
      message: 'Droplet uninstalled successfully',
      data: {
        installationId: installationId,
        uninstalledAt: new Date().toISOString(),
        deletedRows: result.rowCount
      }
    })

  } catch (error: any) {
    logger.error('Manual uninstall error:', error)
    
    return res.status(error.statusCode || 500).json({
      error: 'Uninstall failed',
      message: error.message || 'An error occurred during uninstall'
    })
  }
})

/**
 * POST /api/droplet/cleanup
 * Clean up orphaned installations (for admin use only - requires specific admin key)
 */
router.post('/cleanup', rateLimits.config, async (req: Request, res: Response) => {
  try {
    // Require admin authorization for cleanup operations
    const adminKey = req.headers['x-admin-key']
    const expectedAdminKey = process.env.ADMIN_CLEANUP_KEY

    if (!expectedAdminKey) {
      return res.status(503).json({
        error: 'Cleanup disabled',
        message: 'Admin cleanup functionality is disabled (ADMIN_CLEANUP_KEY not configured)'
      })
    }

    if (!adminKey || adminKey !== expectedAdminKey) {
      logger.warn('Unauthorized cleanup attempt', {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        hasAdminKey: !!adminKey
      })
      
      return res.status(403).json({
        error: 'Unauthorized',
        message: 'Admin access required for cleanup operations'
      })
    }

    logger.info('Starting admin cleanup of orphaned installations', {
      adminIp: req.ip
    })

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
 * POST /api/droplet/update-customer-api-key
 * Update customer's Fluid API key for webhook testing
 */
router.post('/update-customer-api-key', requireTenantAuth, rateLimits.config, async (req: Request, res: Response) => {
  try {
    const { customerApiKey, installationId } = req.body
    const tenantInstallationId = req.tenant?.installationId || installationId

    if (!tenantInstallationId) {
      return res.status(400).json({
        error: 'Installation ID required',
        message: 'Installation ID must be provided in request body'
      })
    }

    if (!customerApiKey) {
      return res.status(400).json({
        error: 'Customer API key required',
        message: 'Please provide a valid Fluid API key'
      })
    }

    // Validate the customer API key by testing it
    const fluidApi = new FluidApiService(customerApiKey)
    try {
      const companyInfo = await fluidApi.getCompanyInfo(customerApiKey)
      logger.info('Customer API key validation successful', {
        installationId: tenantInstallationId,
        companyName: companyInfo?.name || companyInfo?.company_name
      })
    } catch (apiError: any) {
      logger.warn('Customer API key validation failed', {
        installationId: tenantInstallationId,
        error: apiError.message
      })
      return res.status(400).json({
        error: 'Invalid API key',
        message: 'The provided API key is not valid or does not have the required permissions'
      })
    }

    // Update the installation with the customer's API key
    const Database = getDatabaseService()
    const updatedInstallation = await Database.updateInstallation(tenantInstallationId, {
      customerApiKey: customerApiKey
    })

    if (!updatedInstallation) {
      return res.status(404).json({
        error: 'Installation not found',
        message: 'No installation found with the provided ID'
      })
    }

    // Log the API key update
    await Database.logActivity({
      installation_id: tenantInstallationId,
      activity_type: 'customer_api_key_updated',
      description: 'Customer API key updated for webhook testing',
      details: {
        hasApiKey: true,
        companyName: updatedInstallation.configuration?.companyName
      },
      status: 'success'
    })

    logger.info('Customer API key updated successfully', {
      installationId: tenantInstallationId,
      hasApiKey: true
    })

    return res.json({
      success: true,
      message: 'Customer API key updated successfully',
      data: {
        installationId: tenantInstallationId,
        hasCustomerApiKey: true,
        updatedAt: new Date().toISOString()
      }
    })

  } catch (error: any) {
    logger.error('Failed to update customer API key', {
      installationId: req.tenant?.installationId || req.body?.installationId,
      error: error.message
    })
    
    return res.status(500).json({
      error: 'Update failed',
      message: error.message || 'An error occurred while updating the API key'
    })
  }
})

/**
 * POST /api/droplet/test-webhook
 * Test webhook by creating a test order in Fluid
 */
router.post('/test-webhook', requireTenantAuth, rateLimits.config, async (req: Request, res: Response) => {
  try {
    const { webhookType, testData } = req.body
    const tenantInstallationId = req.tenant!.installationId
    const tenantApiKey = req.tenant!.authenticationToken

    logger.info('Starting webhook test', {
      installationId: tenantInstallationId,
      webhookType: webhookType || 'order.created'
    })

    // Get installation data to check for customer API key
    const Database = getDatabaseService()
    const installation = await Database.getInstallation(tenantInstallationId)
    
    logger.info('Webhook test - installation data retrieved', {
      installationId: tenantInstallationId,
      hasInstallation: !!installation,
      hasCustomerApiKey: !!installation?.customerApiKey,
      customerApiKeyLength: installation?.customerApiKey?.length || 0
    })
    
    if (!installation) {
      return res.status(404).json({
        error: 'Installation not found',
        message: 'No installation found for webhook testing'
      })
    }

    // Check if customer has provided their own API key
    if (!installation.customerApiKey) {
      logger.warn('Webhook test failed - no customer API key found', {
        installationId: tenantInstallationId,
        installationStatus: installation.status
      })
      return res.status(400).json({
        error: 'Customer API key required',
        message: 'Please configure your Fluid API key in the dashboard settings to test webhooks. This ensures webhook data appears in your account.',
        requiresApiKey: true
      })
    }

    // Use customer's API key for webhook testing
    const fluidApi = new FluidApiService(installation.customerApiKey)
    
    logger.info('Using customer API key for webhook testing', {
      installationId: tenantInstallationId,
      hasCustomerApiKey: true
    })
    
    let testResult: any = {}
    let webhookEventId: string | null = null

    // Handle all 47 Fluid webhook types
    try {
      switch (webhookType) {
        // Order webhooks - Create real orders
        case 'order_created':
        case 'order_completed':
        case undefined: // Default to order created
          logger.info('Creating test order in customer account', { installationId: tenantInstallationId })
          
          const orderResult = await fluidApi.createTestOrder(installation.customerApiKey, testData)
          
          testResult = {
            type: webhookType || 'order_created',
            success: true,
            resourceId: orderResult?.id || orderResult?.order?.id,
            resourceData: orderResult,
            createdAt: new Date().toISOString()
          }
          break

        // Order webhooks - Update existing orders
        case 'order_updated':
        case 'order_shipped':
        case 'order_canceled':
        case 'order_refunded':
          let orderToUpdate = null
          
          // Check if user provided an order number in the form
          if (testData.order_id || testData.order_number) {
            const orderIdentifier = testData.order_id || testData.order_number
            logger.info('Using provided order identifier for update', { 
              installationId: tenantInstallationId, 
              orderIdentifier 
            })
            orderToUpdate = orderIdentifier
          } else {
            // If no order specified, try to find existing orders in customer's account
            logger.info('No order specified, fetching existing orders from customer account', { installationId: tenantInstallationId })
            const existingOrders = await fluidApi.getOrders(installation.customerApiKey, 1)
            
            if (existingOrders && existingOrders.length > 0) {
              orderToUpdate = existingOrders[0].id
              logger.info('Found existing order to update', { 
                installationId: tenantInstallationId, 
                orderId: orderToUpdate 
              })
            } else {
              // No existing orders, create a new one
              logger.info('No existing orders found, creating new order for update test', { installationId: tenantInstallationId })
              const newOrderResult = await fluidApi.createTestOrder(installation.customerApiKey, testData)
              orderToUpdate = newOrderResult?.id || newOrderResult?.order?.id
            }
          }
          
          // Set appropriate status based on webhook type
          let orderStatus = 'processing'
          if (webhookType === 'order_shipped') orderStatus = 'shipped'
          else if (webhookType === 'order_canceled') orderStatus = 'cancelled'
          else if (webhookType === 'order_refunded') orderStatus = 'refunded'
          
          const updateResult = await fluidApi.updateTestOrder(installation.customerApiKey, orderToUpdate, { 
            ...testData, 
            status: orderStatus 
          })
          
          testResult = {
            type: webhookType,
            success: true,
            resourceId: orderToUpdate,
            resourceData: updateResult,
            createdAt: new Date().toISOString()
          }
          break

        // Product webhooks - Create real products
        case 'product_created':
          const productResult = await fluidApi.createTestProduct(installation.customerApiKey, testData)
          
          testResult = {
            type: 'product_created',
            success: true,
            resourceId: productResult?.id || productResult?.product?.id,
            resourceData: productResult,
            createdAt: new Date().toISOString()
          }
          break

        // Contact/User webhooks - Create real contacts/users
        case 'contact_created':
        case 'customer_created':
          const contactResult = await fluidApi.createTestCustomer(installation.customerApiKey, testData)
          
          testResult = {
            type: webhookType,
            success: true,
            resourceId: contactResult?.id || contactResult?.contact?.id,
            resourceData: contactResult,
            createdAt: new Date().toISOString()
          }
          break

        case 'user_created':
          const userResult = await fluidApi.createUser(installation.customerApiKey, testData)
          
          testResult = {
            type: webhookType,
            success: true,
            resourceId: userResult?.id || userResult?.user?.id,
            resourceData: userResult,
            createdAt: new Date().toISOString()
          }
          break

        // Product webhooks - Update real products  
        case 'product_updated':
          // Get a recent product to update
          const recentProductsResult = await Database.query(`
            SELECT activity_logs.details->>'resourceId' as product_id
            FROM activity_logs 
            WHERE installation_id = $1 
              AND activity_type = 'webhook_test'
              AND (details->>'webhookType' = 'product_created')
              AND status = 'success'
            ORDER BY created_at DESC 
            LIMIT 1
          `, [tenantInstallationId])

          if (recentProductsResult.rows.length === 0) {
            throw new Error('No recent products found to update. Create a product first.')
          }

          const productToUpdate = recentProductsResult.rows[0].product_id
          const productUpdateData = {
            title: testData.title || 'Updated Product Name',
            description: testData.description || 'Product updated via webhook testing',
            price: testData.price || '39.99',
            ...testData
          }
          
          const productUpdateResult = await fluidApi.updateProduct(installation.customerApiKey, productToUpdate, productUpdateData)
          
          testResult = {
            type: webhookType,
            success: true,
            resourceId: productToUpdate,
            resourceData: productUpdateResult,
            createdAt: new Date().toISOString()
          }
          break

        // Contact/Customer webhooks - Update real contacts
        case 'contact_updated':
        case 'customer_updated':
        case 'user_updated':
          // Get a recent contact to update
          const recentContactsResult = await Database.query(`
            SELECT activity_logs.details->>'resourceId' as contact_id
            FROM activity_logs 
            WHERE installation_id = $1 
              AND activity_type = 'webhook_test'
              AND (details->>'webhookType' IN ('contact_created', 'customer_created', 'user_created'))
              AND status = 'success'
            ORDER BY created_at DESC 
            LIMIT 1
          `, [tenantInstallationId])

          if (recentContactsResult.rows.length === 0) {
            throw new Error('No recent contacts found to update. Create a contact first.')
          }

          const contactToUpdate = recentContactsResult.rows[0].contact_id
          const contactUpdateData = {
            first_name: testData.first_name || 'Updated',
            last_name: testData.last_name || 'Contact',
            email: testData.email || `updated-${Date.now()}@example.com`,
            phone: testData.phone || '+1-555-0999',
            ...testData
          }
          
          const contactUpdateResult = await fluidApi.updateContact(installation.customerApiKey, contactToUpdate, contactUpdateData)
          
          testResult = {
            type: webhookType,
            success: true,
            resourceId: contactToUpdate,
            resourceData: contactUpdateResult,
            createdAt: new Date().toISOString()
          }
          break

        // All other webhooks - Simulate with realistic data
        case 'product_destroyed':
        case 'user_deactivated':
          // These are destructive operations, create activities to track them
          const destructiveActivityResult = await fluidApi.createActivity(installation.customerApiKey, {
            title: `${webhookType.replace('_', ' ')} Event`,
            description: `Resource ${webhookType.replace('_', ' ')} via webhook`,
            activity_type: webhookType,
            ...testData
          })
          
          testResult = {
            type: webhookType,
            success: true,
            resourceId: destructiveActivityResult?.id || destructiveActivityResult?.activity?.id,
            resourceData: destructiveActivityResult,
            createdAt: new Date().toISOString()
          }
          break

        case 'cart_updated':
        case 'cart_abandoned':
        case 'cart_update_address':
        case 'cart_update_cart_email':
        case 'cart_add_items':
        case 'cart_remove_items':
          // Cart operations - create activities to track them
          const cartActivityResult = await fluidApi.createActivity(installation.customerApiKey, {
            title: `Cart ${webhookType.replace('cart_', '').replace('_', ' ')}`,
            description: `Cart operation: ${webhookType}`,
            activity_type: 'cart_operation',
            cart_action: webhookType,
            ...testData
          })
          
          testResult = {
            type: webhookType,
            success: true,
            resourceId: cartActivityResult?.id || cartActivityResult?.activity?.id,
            resourceData: cartActivityResult,
            createdAt: new Date().toISOString()
          }
          break

        case 'subscription_started':
        case 'subscription_paused':
        case 'subscription_cancelled':
          // Subscription operations - create activities to track them
          const subscriptionActivityResult = await fluidApi.createActivity(installation.customerApiKey, {
            title: `Subscription ${webhookType.replace('subscription_', '').replace('_', ' ')}`,
            description: `Subscription operation: ${webhookType}`,
            activity_type: 'subscription_operation',
            subscription_action: webhookType,
            ...testData
          })
          
          testResult = {
            type: webhookType,
            success: true,
            resourceId: subscriptionActivityResult?.id || subscriptionActivityResult?.activity?.id,
            resourceData: subscriptionActivityResult,
            createdAt: new Date().toISOString()
          }
          break

        case 'event_created':
          const eventResult = await fluidApi.createEvent(installation.customerApiKey, testData)
          
          testResult = {
            type: webhookType,
            success: true,
            resourceId: eventResult?.id || eventResult?.event?.id,
            resourceData: eventResult,
            createdAt: new Date().toISOString()
          }
          break

        case 'event_updated':
        case 'event_deleted':
          // For event updates/deletes, we need to find an existing event first
          // For now, create a new event and then simulate the update/delete
          const eventForUpdate = await fluidApi.createEvent(installation.customerApiKey, testData)
          const simulatedEventData = generateSimulatedWebhookData(webhookType, { 
            ...testData, 
            event_id: eventForUpdate?.id || eventForUpdate?.event?.id 
          })
          
          testResult = {
            type: webhookType,
            success: true,
            resourceId: simulatedEventData.id,
            resourceData: simulatedEventData,
            createdAt: new Date().toISOString()
          }
          break

        case 'webchat_submitted':
        case 'popup_submitted':
          // Create a conversation for webchat/popup submissions
          const conversationResult = await fluidApi.createConversation(installation.customerApiKey, {
            title: `${webhookType.replace('_', ' ')} Submission`,
            description: `Test ${webhookType} submission via webhook`,
            ...testData
          })
          
          testResult = {
            type: webhookType,
            success: true,
            resourceId: conversationResult?.id || conversationResult?.conversation?.id,
            resourceData: conversationResult,
            createdAt: new Date().toISOString()
          }
          break

        case 'bot_message_created':
          // Create an activity for bot message
          const activityResult = await fluidApi.createActivity(installation.customerApiKey, {
            title: 'Bot Message Created',
            description: 'Test bot message created via webhook',
            activity_type: 'bot_message',
            ...testData
          })
          
          testResult = {
            type: webhookType,
            success: true,
            resourceId: activityResult?.id || activityResult?.activity?.id,
            resourceData: activityResult,
            createdAt: new Date().toISOString()
          }
          break

        case 'droplet_installed':
        case 'droplet_uninstalled':
        case 'enrollment_completed':
          // These are system events, create activities to track them
          const systemActivityResult = await fluidApi.createActivity(installation.customerApiKey, {
            title: `${webhookType.replace('_', ' ')} Event`,
            description: `System event: ${webhookType}`,
            activity_type: webhookType,
            ...testData
          })
          
          testResult = {
            type: webhookType,
            success: true,
            resourceId: systemActivityResult?.id || systemActivityResult?.activity?.id,
            resourceData: systemActivityResult,
            createdAt: new Date().toISOString()
          }
          break

        case 'mfa_missing_email':
          // Send MFA passcode via email
          const mfaSendResult = await fluidApi.sendMfaPasscode(
            installation.customerApiKey,
            testData.email || 'test@example.com',
            testData.fluid_shop || 'company.fluid.app'
          )
          
          testResult = {
            type: webhookType,
            success: true,
            resourceId: mfaSendResult?.multi_factor_authentication?.uuid,
            resourceData: mfaSendResult,
            createdAt: new Date().toISOString()
          }
          break

        case 'mfa_verified':
          // Confirm MFA passcode
          const mfaConfirmResult = await fluidApi.confirmMfaPasscode(
            installation.customerApiKey,
            testData.uuid || 'test-uuid',
            testData.verification_code || '123456'
          )
          
          testResult = {
            type: webhookType,
            success: true,
            resourceId: mfaConfirmResult?.multi_factor_authentication?.uuid,
            resourceData: mfaConfirmResult,
            createdAt: new Date().toISOString()
          }
          break

        default:
          throw new Error(`Unsupported webhook type: ${webhookType}`)
      }

      logger.info(`Test ${webhookType} webhook completed successfully`, {
        installationId: tenantInstallationId,
        resourceId: testResult.resourceId,
        webhookType
      })

      // Log test webhook activity
      await Database.logActivity({
        installation_id: tenantInstallationId,
        activity_type: 'webhook_test',
        description: `Test webhook ${webhookType} completed successfully`,
        details: {
          webhookType,
          resourceId: testResult.resourceId,
          testData: testData || 'default'
        },
        status: 'success'
      })

    } catch (webhookError: any) {
      logger.error(`Failed to test ${webhookType} webhook`, { 
        installationId: tenantInstallationId,
        webhookType 
      }, webhookError)

      testResult = {
        type: webhookType || 'order.created',
        success: false,
        error: webhookError.message || `Failed to test ${webhookType} webhook`,
        details: webhookError.data || webhookError.response?.data,
        createdAt: new Date().toISOString()
      }

      // Log failed test
      await Database.logActivity({
        installation_id: tenantInstallationId,
        activity_type: 'webhook_test',
        description: `Test webhook ${webhookType} failed`,
        details: {
          webhookType,
          error: webhookError.message,
          testData: testData || 'default'
        },
        status: 'error'
      })
    }

    // Check for recent webhook events (Fluid should send webhook back to us)
    const recentWebhooks = await Database.query(`
      SELECT id, event_type, payload, created_at, processing_status
      FROM webhook_events 
      WHERE installation_id = $1 
        AND created_at > NOW() - INTERVAL '5 minutes'
      ORDER BY created_at DESC 
      LIMIT 5
    `, [tenantInstallationId])

    const webhookEvents = recentWebhooks.rows.map((row: any) => ({
      id: row.id,
      type: row.event_type,
      data: row.payload,
      createdAt: row.created_at,
      processingStatus: row.processing_status
    }))

    return res.json({
      success: true,
      message: 'Webhook test completed',
      data: {
        test: testResult,
        recentWebhooks: webhookEvents,
        installationId: tenantInstallationId,
        testedAt: new Date().toISOString()
      }
    })

  } catch (error: any) {
    logger.error('Webhook test error:', error)
    
    return res.status(error.statusCode || 500).json({
      error: 'Webhook test failed',
      message: error.message || 'An error occurred during webhook testing'
    })
  }
})

/**
 * GET /api/droplet/webhook-logs/:installationId
 * Get webhook event logs for an installation
 */
router.get('/webhook-logs/:installationId', requireTenantAuth, rateLimits.tenant, async (req: Request, res: Response) => {
  try {
    const tenantInstallationId = req.tenant!.installationId
    const { limit = 50, offset = 0 } = req.query

    // Get webhook events for this tenant only
    const webhookLogs = await Database.query(`
      SELECT id, event_type, payload, created_at, processing_status
      FROM webhook_events 
      WHERE installation_id = $1 
      ORDER BY created_at DESC 
      LIMIT $2 OFFSET $3
    `, [tenantInstallationId, parseInt(limit as string), parseInt(offset as string)])

    // Get activity logs related to webhook testing
    const activityLogs = await Database.query(`
      SELECT id, activity_type, description, details, status, created_at
      FROM activity_logs 
      WHERE installation_id = $1 
        AND activity_type IN ('webhook_test', 'webhook')
      ORDER BY created_at DESC 
      LIMIT $2 OFFSET $3
    `, [tenantInstallationId, parseInt(limit as string), parseInt(offset as string)])

    const logs = {
      webhookEvents: webhookLogs.rows.map((row: any) => ({
        id: row.id,
        type: row.event_type,
        data: row.payload,
        createdAt: row.created_at,
        processingStatus: row.processing_status,
        retryCount: 0
      })),
      activityLogs: activityLogs.rows.map((row: any) => ({
        id: row.id,
        type: row.activity_type,
        description: row.description,
        details: row.details,
        status: row.status,
        createdAt: row.created_at
      }))
    }

    return res.json({
      success: true,
      data: logs
    })

  } catch (error: any) {
    logger.error('Failed to fetch webhook logs:', error)
    
    return res.status(error.statusCode || 500).json({
      error: 'Failed to fetch logs',
      message: error.message || 'An error occurred while fetching webhook logs'
    })
  }
})

/**
 * Get orders for the installation
 */
router.get('/orders', requireTenantAuth, rateLimits.tenant, async (req: Request, res: Response) => {
  try {
    const { limit = 10 } = req.query
    const tenantInstallationId = req.tenant!.installationId
    const tenantApiKey = req.tenant!.authenticationToken

    logger.info('Fetching orders for tenant', {
      installationId: tenantInstallationId,
      limit: parseInt(limit as string)
    })

    const Database = getDatabaseService()
    const installation = await Database.getInstallation(tenantInstallationId)

    if (!installation) {
      return res.status(404).json({
        error: 'Installation not found',
        message: 'No installation found for this tenant'
      })
    }

    // Use customer API key if available, otherwise use builder key
    const apiKey = installation.customerApiKey || tenantApiKey
    const fluidApi = new FluidApiService(apiKey)

    try {
      // Fetch orders from Fluid API
      const orders = await fluidApi.getOrders(undefined, parseInt(limit as string))
      
      logger.info('Orders fetched successfully', {
        installationId: tenantInstallationId,
        orderCount: orders.length
      })

      return res.json({
        success: true,
        data: {
          orders: orders,
          total: orders.length,
          installationId: tenantInstallationId
        }
      })
    } catch (apiError: any) {
      logger.error('Failed to fetch orders from Fluid API', {
        installationId: tenantInstallationId,
        error: apiError.message
      })

      return res.status(400).json({
        error: 'Failed to fetch orders',
        message: apiError.message || 'Unable to retrieve orders from Fluid API'
      })
    }

  } catch (error: any) {
    logger.error('Failed to fetch orders', {
      installationId: req.tenant?.installationId,
      error: error.message
    })

    return res.status(500).json({
      error: 'Internal server error',
      message: error.message || 'An error occurred while fetching orders'
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
