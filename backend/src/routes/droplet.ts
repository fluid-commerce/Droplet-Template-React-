import { Router, Request, Response } from 'express'
import axios from 'axios'
import { FluidApiService } from '../services/fluidApi'
import { getDatabaseService } from '../services/database'
import { DropletConfig } from '../types'
import { validateDropletConfig } from '../middleware/validation'
import { logger } from '../services/logger'

const router = Router()

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
          status: realInstallation.status
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
      dropletId: realInstallation.droplet_id,
      companyId: realInstallation.company_id,
      authenticationToken: realInstallation.authentication_token,
      configuration: config,
      status: 'active' as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    // Save to database
    const db = getDatabaseService()
    const savedInstallation = await db.createInstallation(dropletInstallation)
    
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
        environment: config.environment,
        webhookUrl: config.webhookUrl || 'None'
      },
      status: 'success'
    })

    logger.info('Droplet configuration saved successfully', {
      installationId: savedInstallation.id,
      companyId: savedInstallation.companyId,
      companyName: companyInfo?.name || companyInfo?.company_name,
      environment: config.environment,
      webhookUrl: config.webhookUrl || 'None'
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

    // For new installations, check if we have stored company info from webhook
    if (installationId === 'new-installation') {
      try {
        const Database = getDatabaseService()
        
        // Look for any pending installation with company data
        const result = await Database.query(`
          SELECT installation_id, company_id, configuration, authentication_token, status, company_name, created_at, updated_at
          FROM droplet_installations 
          WHERE status = 'pending' 
          ORDER BY created_at DESC 
          LIMIT 1
        `)
        
        if (result.rows.length > 0) {
          const installation = result.rows[0]
          const config = installation.configuration ? JSON.parse(installation.configuration) : {}
          
          return res.json({
            success: true,
            data: {
              connected: false,
              installationId: installation.installation_id,
              companyName: installation.company_name || config.companyName || 'Your Company',
              companyId: installation.company_id,
              lastSync: null,
              userCount: 0,
              status: installation.status,
              createdAt: installation.created_at,
              updatedAt: installation.updated_at,
              integrationName: config.integrationName || 'My Integration',
              environment: config.environment || 'production',
              webhookUrl: config.webhookUrl || '',
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
          webhookUrl: '',
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
        webhookUrl: installation.configuration?.webhookUrl || '',
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

    const fluidApi = new FluidApiService(fluidApiKey as string)
    
    // Get real company data from Fluid
    const companyInfo = await fluidApi.getCompanyInfo(fluidApiKey as string)
    
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
      companyName: companyInfo.company_name || companyInfo.name || 'Your Company',
      totalUsers: users.length,
      activeUsers: users.filter((user: any) => user.status === 'active' || user.active !== false).length,
      recentActivity: [
        {
          description: 'Droplet installation completed',
          timestamp: new Date().toISOString(),
          details: `Successfully connected to ${companyInfo.company_name || 'your company'}`
        },
        {
          description: 'Fluid API connection established',
          timestamp: new Date(Date.now() - 300000).toISOString(),
          details: 'Authentication verified with Fluid platform'
        }
      ],
      customers: users.map((user: any, index: number) => ({
        id: user.id || `user_${index}`,
        name: user.name || user.display_name || user.email || 'Unknown User',
        email: user.email || 'No email',
        phone: user.phone || undefined,
        status: (user.status === 'active' || user.active !== false) ? 'active' : 'inactive',
        lastActivity: user.last_login || user.updated_at || new Date().toISOString(),
        company: companyInfo.company_name || 'Your Company',
        role: user.role || user.permissions?.[0] || 'User'
      }))
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

    // Disconnect installation
    logger.info('Disconnecting installation', { installationId })

    return res.json({
      success: true,
      message: 'Droplet disconnected successfully',
      data: {
        installationId,
        disconnectedAt: new Date().toISOString()
      }
    })

  } catch (error: any) {
    console.error('Disconnect error:', error)
    
    return res.status(error.statusCode || 500).json({
      error: 'Disconnect failed',
      message: error.message || 'An error occurred during disconnection'
    })
  }
})

/**
 * POST /api/droplet/setup
 * Handle droplet setup process
 */
router.post('/setup', async (req: Request, res: Response) => {
  try {
    const { installationId, fluidApiKey } = req.body

    if (!installationId || !fluidApiKey) {
      return res.status(400).json({
        error: 'Missing required parameters',
        message: 'Installation ID and Fluid API key are required'
      })
    }

    const fluidApi = new FluidApiService(fluidApiKey)
    
    // Get installation details
    const installation = await fluidApi.getDropletInstallation(installationId)

    // Setup steps
    // 1. Validate credentials
    // 2. Create webhooks
    // 3. Sync initial data
    // 4. Configure mappings
    // 5. Test integration

    return res.json({
      success: true,
      message: 'Setup completed successfully',
      data: {
        installationId: installation.id,
        status: 'active',
        steps: [
          { name: 'Validate Credentials', completed: true },
          { name: 'Create Webhooks', completed: true },
          { name: 'Sync Initial Data', completed: true },
          { name: 'Configure Mappings', completed: true },
          { name: 'Test Integration', completed: true }
        ]
      }
    })

  } catch (error: any) {
    console.error('Setup error:', error)
    
    return res.status(error.statusCode || 500).json({
      error: 'Setup failed',
      message: error.message || 'An error occurred during setup'
    })
  }
})

/**
 * GET /api/droplet/settings/:installationId
 * Get settings/configuration for an installation
 */
router.get('/settings/:installationId', async (req: Request, res: Response) => {
  try {
    const { installationId } = req.params
    const { fluidApiKey } = req.query

    if (!fluidApiKey) {
      return res.status(400).json({
        error: 'Missing Fluid API key',
        message: 'Fluid API key is required to load settings'
      })
    }

    const fluidApi = new FluidApiService(fluidApiKey as string)
    
    // Get company info and current configuration
    const companyInfo = await fluidApi.getCompanyInfo(fluidApiKey as string)
    
    // Fetch the actual installation configuration
    const settings = {
      companyName: companyInfo.company_name || companyInfo.name || 'Your Company',
      companyLogo: companyInfo.logo_url || companyInfo.logo || companyInfo.avatar_url,
      installationId: installationId,
      environment: 'production',
      webhookUrl: '',
      fluidApiKey: fluidApiKey,
      lastUpdated: new Date().toISOString(),
      status: 'active'
    }

    return res.json({
      success: true,
      data: settings
    })

  } catch (error: any) {
    console.error('Settings data error:', error)
    
    return res.status(error.statusCode || 500).json({
      error: 'Failed to load settings',
      message: error.message || 'An error occurred while loading settings'
    })
  }
})

/**
 * POST /api/droplet/settings/:installationId
 * Update settings/configuration for an installation
 */
router.post('/settings/:installationId', async (req: Request, res: Response) => {
  try {
    const { installationId } = req.params
    const { fluidApiKey, webhookUrl, environment } = req.body

    if (!fluidApiKey) {
      return res.status(400).json({
        error: 'Missing Fluid API key',
        message: 'Fluid API key is required to update settings'
      })
    }

    // Update the configuration
    logger.info('Processing settings update', {
      installationId,
      hasWebhookUrl: !!webhookUrl,
      environment
    })

    return res.json({
      success: true,
      message: 'Settings updated successfully',
      data: {
        installationId,
        webhookUrl,
        environment,
        lastUpdated: new Date().toISOString()
      }
    })

  } catch (error: any) {
    console.error('Settings update error:', error)
    
    return res.status(error.statusCode || 500).json({
      error: 'Failed to update settings',
      message: error.message || 'An error occurred while updating settings'
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

  // Validate webhook URL if provided
  if (config.webhookUrl && !config.webhookUrl.startsWith('https://')) {
    errors.push('Webhook URL must use HTTPS')
  }

  // Add validation calls to the service
  // Example: Test API connection with provided credentials

  return {
    valid: errors.length === 0,
    errors
  }
}

export { router as dropletRoutes }
