import axios, { AxiosInstance } from 'axios'
import { FluidApiResponse, FluidDropletInstallation } from '../types'

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
        console.log(`Making Fluid API request: ${config.method?.toUpperCase()} ${config.url}`)
        return config
      },
      (error) => {
        console.error('Fluid API request error:', error)
        return Promise.reject(error)
      }
    )

    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        console.error('Fluid API response error:', error.response?.data || error.message)
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
    const response = await this.client.post('/droplet_installations', { 
      droplet_installation: installationData 
    })
    return response.data.data
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
      return {
        id: 'company-verified',
        name: 'Your Company',
        company_name: 'Your Company',
        status: 'active',
        users_count: response.data?.length || 0,
        verified: true
      }
    } catch (error) {
      // If users endpoint fails, try company tiles
      try {
        const response = await companyClient.get('/company/tiles')
        
        return {
          id: 'company-verified',
          name: 'Your Company',
          company_name: 'Your Company',
          status: 'active',
          tiles_count: response.data?.length || 0,
          verified: true
        }
      } catch (tilesError) {
        // If both fail, try company pages as a fallback
        try {
          const response = await companyClient.get('/company/pages')
          
          return {
            id: 'company-verified',
            name: 'Your Company',
            company_name: 'Your Company',
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
   * Health check
   */
  async healthCheck(): Promise<{ status: string; timestamp: string }> {
    const response = await this.client.get('/health')
    return response.data
  }
}
