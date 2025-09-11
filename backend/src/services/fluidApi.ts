import axios, { AxiosInstance } from 'axios'
import { FluidApiResponse, FluidDropletInstallation } from '../types'
import { logger } from './logger'

export class FluidApiService {
  private client: AxiosInstance

  constructor(apiKey: string, baseUrl?: string) {
    // Use environment variable or fallback to Fluid platform API
    const fluidApiUrl = baseUrl || process.env.FLUID_API_URL || 'https://api.fluid.app'
    
    this.client = axios.create({
      baseURL: `${fluidApiUrl}/api`,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      timeout: 30000,
    })

    this.setupInterceptors()
  }

  private setupInterceptors(): void {
    this.client.interceptors.request.use(
      (config) => {
        logger.debug('Making Fluid API request', {
          method: config.method?.toUpperCase(),
          url: config.url,
          baseURL: config.baseURL
        })
        return config
      },
      (error) => {
        logger.error('Fluid API request setup failed', {}, error)
        return Promise.reject(error)
      }
    )

    this.client.interceptors.response.use(
      (response) => {
        logger.fluidApiCall(response.config.url || 'unknown', true)
        return response
      },
      (error) => {
        logger.fluidApiCall(error.config?.url || 'unknown', false, error)
        return Promise.reject(this.handleError(error))
      }
    )
  }

  private handleError(error: any): any {
    if (error.response) {
      return {
        ...error,
        message: error.response.data?.message || error.message,
        statusCode: error.response.status,
        data: error.response.data
      }
    }
    return error
  }

  /**
   * Get droplet installation details
   */
  async getDropletInstallation(installationId: string): Promise<FluidDropletInstallation> {
    const response = await this.client.get<FluidApiResponse<FluidDropletInstallation>>(
      `/droplet_installations/${installationId}`
    )
    return response.data.data
  }

  /**
   * List companies using a droplet
   */
  async getDropletCompanies(dropletId: string, page: number = 0, perPage: number = 100): Promise<any> {
    const response = await this.client.get(
      `/droplets/${dropletId}/companies?page=${page}&per_page=${perPage}`
    )
    return response.data
  }

  /**
   * Create a new droplet
   */
  async createDroplet(dropletData: any): Promise<any> {
    const response = await this.client.post('/droplets', { droplet: dropletData })
    return response.data
  }

  /**
   * Update a droplet
   */
  async updateDroplet(dropletId: string, dropletData: any): Promise<any> {
    const response = await this.client.put(`/droplets/${dropletId}`, { droplet: dropletData })
    return response.data
  }

  /**
   * Create a new droplet installation
   */
  async createDropletInstallation(installationData: any): Promise<any> {
    const response = await this.client.post('/droplet_installations', installationData)
    
    // Handle different possible response structures
    if (response.data.data) {
      return response.data.data
    } else if (response.data.droplet_installation) {
      return response.data.droplet_installation
    } else if (response.data) {
      return response.data
    } else {
      throw new Error('Unexpected response structure from Fluid API')
    }
  }

  /**
   * Get company information using authentication token
   */
  async getCompanyInfo(authToken: string): Promise<any> {
    // Create a new client instance with the user's API key for company-specific requests
    // Use the Fluid platform API URL, not the droplet's domain
    const fluidApiUrl = process.env.FLUID_API_URL || 'https://api.fluid.app'
    const companyClient = axios.create({
      baseURL: `${fluidApiUrl}/api`,
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      timeout: 30000,
    })

    try {
      // Try to get company users first (this endpoint exists according to API docs)
      const response = await companyClient.get('/company/users')
      
      // If successful, return company info
      // Try to extract company name from the response
      const companyName = response.data?.company?.name || 
                         response.data?.company_name || 
                         response.data?.name || 
                         'Your Company'
      
      return {
        id: response.data?.company?.id || response.data?.company_id || 'company-verified',
        name: companyName,
        company_name: companyName,
        status: 'active',
        users_count: response.data?.length || 0,
        verified: true
      }
    } catch (error) {
      // If users endpoint fails, try company tiles
      try {
        const response = await companyClient.get('/company/tiles')
        
        // Try to extract company name from the response
        const companyName = response.data?.company?.name || 
                           response.data?.company_name || 
                           response.data?.name || 
                           'Your Company'
        
        return {
          id: response.data?.company?.id || response.data?.company_id || 'company-verified',
          name: companyName,
          company_name: companyName,
          status: 'active',
          tiles_count: response.data?.length || 0,
          verified: true
        }
      } catch (tilesError) {
        // If both fail, try company pages as a fallback
        try {
          const response = await companyClient.get('/company/pages')
          
          // Try to extract company name from the response
          const companyName = response.data?.company?.name || 
                             response.data?.company_name || 
                             response.data?.name || 
                             'Your Company'
          
          return {
            id: response.data?.company?.id || response.data?.company_id || 'company-verified',
            name: companyName,
            company_name: companyName,
            status: 'active',
            pages_count: response.data?.length || 0,
            verified: true
          }
        } catch (pagesError) {
          // If all endpoints fail, throw the original error
          throw error
        }
      }
    }
  }

  /**
   * Get brand guidelines settings
   */
  async getBrandGuidelines(authToken: string): Promise<any> {
    const fluidApiUrl = process.env.FLUID_API_URL || 'https://api.fluid.app'
    const brandClient = axios.create({
      baseURL: `${fluidApiUrl}/api`,
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      timeout: 30000,
    })

    try {
      const response = await brandClient.get('/settings/brand_guidelines')
      return response.data
    } catch (error: any) {
      logger.error('Failed to get brand guidelines', { error: error.message })
      throw error
    }
  }

  /**
   * Create a test order for webhook testing using builder's API key with installation context
   */
  async createTestOrder(installationId: string, orderData?: any): Promise<any> {
    const fluidApiUrl = process.env.FLUID_API_URL || 'https://api.fluid.app'
    
    // Use builder's API key instead of customer's API key for order creation
    const builderApiKey = process.env.FLUID_API_KEY
    if (!builderApiKey) {
      throw new Error('Builder API key not configured')
    }
    
    const orderClient = axios.create({
      baseURL: `${fluidApiUrl}/api`,
      headers: {
        'Authorization': `Bearer ${builderApiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-Droplet-Installation-ID': installationId, // Specify which customer installation this is for
      },
      timeout: 30000,
    })

    const orderNumber = `TEST-${Date.now()}-${installationId.slice(-6)}`
    
    const defaultOrderData = {
      order_number: orderNumber,
      customer_email: 'jane.doe@testmail.com',
      customer_firstname: 'Jane',
      customer_lastname: 'Doe',
      affiliate: {
        email: 'partner@businessmail.com'
      },
      ship_to: {
        address1: '456 Commerce Way',
        city: 'Business City',
        state: 'CA',
        postal_code: '90210'
      },
      items: [
        {
          sku: 'DEMO-PRODUCT-123',
          name: 'Sample Business Item',
          image_url: 'https://via.placeholder.com/150',
          quantity: 2,
          unit_price: 89.95
        }
      ],
      amount_paid: 179.90
    }

    const finalOrderData = { 
      ...defaultOrderData, 
      ...orderData,
      order_number: orderData?.order_number || orderNumber
    }
    
    try {
      // Create order using builder's API key with installation context
      logger.info('Creating order using builder API key with installation context', { 
        orderNumber: finalOrderData.order_number,
        installationId: installationId,
        endpoint: '/company/orders.json'
      })
      
      const response = await orderClient.post('/company/orders.json', { 
        order: finalOrderData 
      })
      
      logger.info('Test order created successfully in Fluid', {
        orderNumber: finalOrderData.order_number,
        installationId: installationId,
        response: response.data
      })
      
      return response.data
    } catch (error: any) {
      logger.error('Failed to create test order in Fluid using builder API key', { 
        orderData: finalOrderData,
        installationId: installationId,
        endpoint: '/company/orders.json',
        error: error.response?.data || error.message,
        statusCode: error.response?.status
      }, error)
      
      // If we get a 401, it might mean the builder API key doesn't have the right permissions
      // or the installation context isn't working properly
      if (error.response?.status === 401) {
        throw new Error('Builder API key authorization failed. Check if the API key has order creation permissions and the installation context is correct.')
      }
      
      throw error
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{ status: string; timestamp: string }> {
    const response = await this.client.get('/health')
    return response.data
  }
}
