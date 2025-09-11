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
   * Create a test order for webhook testing
   */
  async createTestOrder(authToken: string, orderData?: any): Promise<any> {
    const fluidApiUrl = process.env.FLUID_API_URL || 'https://api.fluid.app'
    const orderClient = axios.create({
      baseURL: `${fluidApiUrl}/api`,
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      timeout: 30000,
    })

    const defaultOrderData = {
      customer_email: 'test@example.com',
      customer_name: 'Test Customer',
      total: 99.99,
      currency: 'USD',
      items: [
        {
          name: 'Test Product',
          quantity: 1,
          price: 99.99,
          sku: 'TEST-SKU-001'
        }
      ],
      billing_address: {
        street: '123 Test Street',
        city: 'Test City',
        state: 'Test State',
        zip: '12345',
        country: 'US'
      },
      metadata: {
        source: 'webhook_test',
        created_by: 'fluiddroplets_testing'
      }
    }

    const finalOrderData = { ...defaultOrderData, ...orderData }
    
    try {
      const response = await orderClient.post('/orders', { order: finalOrderData })
      return response.data
    } catch (error: any) {
      logger.error('Failed to create test order', { orderData: finalOrderData }, error)
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
