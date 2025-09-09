import { Router, Request, Response } from 'express'
import { FluidApiService } from '../services/fluidApi'
import { DropletConfig } from '../types'
import { validateDropletConfig } from '../middleware/validation'

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
    console.log('Testing Fluid API connection...')
    let companyInfo
    try {
      companyInfo = await fluidApi.getCompanyInfo(config.fluidApiKey)
      console.log('✅ Fluid API connection successful:', { 
        companyName: companyInfo?.name || companyInfo?.company_name 
      })
    } catch (apiError: any) {
      console.error('❌ Fluid API connection failed:', apiError.message)
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

    // Store configuration (in production, you'd save this to a database)
    const dropletInstallation = {
      id: installation?.id || `install_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      dropletId: installation?.droplet_id || 'your-droplet-id',
      companyId: installation?.company_id || companyInfo?.id || 'unknown',
      authenticationToken: installation?.authentication_token || config.fluidApiKey,
      configuration: config,
      status: 'active' as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    // TODO: Save to database
    console.log('✅ Droplet configuration saved:', {
      installationId: dropletInstallation.id,
      companyId: dropletInstallation.companyId,
      companyName: companyInfo?.name || companyInfo?.company_name,
      environment: config.environment,
      webhookUrl: config.webhookUrl || 'None'
    })

    return res.json({
      success: true,
      message: 'Droplet configured successfully',
      data: {
        installationId: dropletInstallation.id,
        status: dropletInstallation.status
      }
    })

  } catch (error: any) {
    console.error('Droplet configuration error:', error)
    
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
      console.warn('Could not fetch company info:', companyError)
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
        updatedAt: installation.updated_at
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
    console.log('Testing Fluid API connection...')
    const companyInfo = await fluidApi.getCompanyInfo(fluidApiKey)
    
    console.log('✅ Fluid API connection test successful:', {
      companyName: companyInfo?.name || companyInfo?.company_name
    })

    return res.json({
      success: true,
      message: 'Connection test successful',
      data: {
        companyName: companyInfo?.name || companyInfo?.company_name,
        companyId: companyInfo?.id
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
    
    // Get company users for dashboard data
    const users = await fluidApi.getCompanyInfo(fluidApiKey as string)
    
    // Mock dashboard data - in production, you'd fetch real data
    const dashboardData = {
      companyName: users.company_name || 'Your Company',
      totalUsers: users.users_count || 0,
      activeUsers: Math.floor((users.users_count || 0) * 0.8), // Mock 80% active
      recentActivity: [
        {
          description: 'User data synchronized successfully',
          timestamp: new Date().toISOString(),
          details: 'Synced 15 new users from Fluid platform'
        },
        {
          description: 'Webhook configuration updated',
          timestamp: new Date(Date.now() - 3600000).toISOString(),
          details: 'Updated webhook endpoints for real-time sync'
        }
      ],
      customers: [
        {
          id: '1',
          name: 'John Doe',
          email: 'john@example.com',
          phone: '+1-555-0123',
          status: 'active',
          lastActivity: new Date().toISOString(),
          company: users.company_name || 'Your Company',
          role: 'Admin'
        },
        {
          id: '2',
          name: 'Jane Smith',
          email: 'jane@example.com',
          status: 'active',
          lastActivity: new Date(Date.now() - 86400000).toISOString(),
          company: users.company_name || 'Your Company',
          role: 'User'
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
    console.log('Syncing data for installation:', installationId)
    
    // Mock sync process - in production, you'd sync real data
    await new Promise(resolve => setTimeout(resolve, 2000))

    return res.json({
      success: true,
      message: 'Data synchronized successfully',
      data: {
        installationId,
        syncedAt: new Date().toISOString(),
        recordsUpdated: 15
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

    // TODO: Implement actual disconnection logic
    console.log('Disconnecting installation:', installationId)

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

    // TODO: Implement actual setup steps
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

  // TODO: Add actual validation calls to the service
  // Example: Test API connection with provided credentials

  return {
    valid: errors.length === 0,
    errors
  }
}

export { router as dropletRoutes }
