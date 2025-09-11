import axios, { AxiosInstance, AxiosResponse } from 'axios'
import { FluidConfig, ApiResponse, ErrorResponse, BrandGuidelines } from '@/types'

/**
 * Main client for communicating with the Fluid platform
 * This is the TypeScript equivalent of the Rails fluid_client.rb
 */
export class FluidClient {
  private client: AxiosInstance
  private config: FluidConfig

  constructor(config: FluidConfig) {
    this.config = config
    this.client = axios.create({
      baseURL: config.apiUrl,
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      timeout: 30000,
    })

    this.setupInterceptors()
  }

  private setupInterceptors(): void {
    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        if (import.meta.env.DEV) {
          // Request logging handled by interceptor
        }
        return config
      },
      (error) => {
        console.error('Request error:', error)
        return Promise.reject(error)
      }
    )

    // Response interceptor
    this.client.interceptors.response.use(
      (response: AxiosResponse) => {
        return response
      },
      (error) => {
        console.error('Response error:', error.response?.data || error.message)
        return Promise.reject(this.handleError(error))
      }
    )
  }

  private handleError(error: any): ErrorResponse {
    if (error.response) {
      // Server responded with error status
      return {
        error: error.response.data?.error || 'API Error',
        message: error.response.data?.message || error.message,
        details: error.response.data?.details,
      }
    } else if (error.request) {
      // Request was made but no response received
      return {
        error: 'Network Error',
        message: 'Unable to connect to the Fluid platform',
      }
    } else {
      // Something else happened
      return {
        error: 'Client Error',
        message: error.message,
      }
    }
  }

  /**
   * Generic GET request
   */
  async get<T = any>(endpoint: string, params?: Record<string, any>): Promise<ApiResponse<T>> {
    const response = await this.client.get(endpoint, { params })
    return response.data
  }

  /**
   * Generic POST request
   */
  async post<T = any>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
    const response = await this.client.post(endpoint, data)
    return response.data
  }

  /**
   * Generic PUT request
   */
  async put<T = any>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
    const response = await this.client.put(endpoint, data)
    return response.data
  }

  /**
   * Generic PATCH request
   */
  async patch<T = any>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
    const response = await this.client.patch(endpoint, data)
    return response.data
  }

  /**
   * Generic DELETE request
   */
  async delete<T = any>(endpoint: string): Promise<ApiResponse<T>> {
    const response = await this.client.delete(endpoint)
    return response.data
  }

  /**
   * Get the current configuration
   */
  getConfig(): FluidConfig {
    return { ...this.config }
  }

  /**
   * Update the API key
   */
  updateApiKey(apiKey: string): void {
    this.config.apiKey = apiKey
    this.client.defaults.headers['Authorization'] = `Bearer ${apiKey}`
  }

  /**
   * Health check endpoint
   */
  async healthCheck(): Promise<ApiResponse<{ status: string; timestamp: string }>> {
    return this.get('/health')
  }

  /**
   * Get brand guidelines settings
   */
  async getBrandGuidelines(): Promise<BrandGuidelines> {
    const response = await this.get<BrandGuidelines>('/api/settings/brand_guidelines')
    return response.data
  }
}
