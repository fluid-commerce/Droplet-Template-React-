import { FluidClient } from './fluidClient'
import { 
  Droplet, 
  DropletCreateRequest, 
  DropletUpdateRequest, 
  PaginatedResponse,
  ApiResponse 
} from '@/types'

/**
 * Droplet resource handler for the Fluid platform
 * This is the TypeScript equivalent of the Rails fluid/droplets.rb module
 */
export class DropletsClient {
  private client: FluidClient

  constructor(client: FluidClient) {
    this.client = client
  }

  /**
   * List all droplets with pagination
   */
  async list(params?: {
    page?: number
    perPage?: number
    status?: string
    search?: string
  }): Promise<PaginatedResponse<Droplet>> {
    const response = await this.client.get<PaginatedResponse<Droplet>>('/droplets', params)
    return response.data
  }

  /**
   * Get a specific droplet by ID
   */
  async get(id: string): Promise<ApiResponse<Droplet>> {
    const response = await this.client.get<Droplet>(`/droplets/${id}`)
    return response
  }

  /**
   * Create a new droplet
   */
  async create(dropletData: DropletCreateRequest): Promise<ApiResponse<Droplet>> {
    const response = await this.client.post<Droplet>('/droplets', dropletData)
    return response
  }

  /**
   * Update an existing droplet
   */
  async update(id: string, dropletData: DropletUpdateRequest): Promise<ApiResponse<Droplet>> {
    const response = await this.client.patch<Droplet>(`/droplets/${id}`, dropletData)
    return response
  }

  /**
   * Delete a droplet
   */
  async delete(id: string): Promise<ApiResponse<void>> {
    const response = await this.client.delete<void>(`/droplets/${id}`)
    return response
  }

  /**
   * Activate a droplet
   */
  async activate(id: string): Promise<ApiResponse<Droplet>> {
    const response = await this.client.post<Droplet>(`/droplets/${id}/activate`)
    return response
  }

  /**
   * Deactivate a droplet
   */
  async deactivate(id: string): Promise<ApiResponse<Droplet>> {
    const response = await this.client.post<Droplet>(`/droplets/${id}/deactivate`)
    return response
  }

  /**
   * Test droplet configuration
   */
  async testConfiguration(id: string): Promise<ApiResponse<{ valid: boolean; errors?: string[] }>> {
    const response = await this.client.post<{ valid: boolean; errors?: string[] }>(`/droplets/${id}/test`)
    return response
  }

  /**
   * Get droplet logs
   */
  async getLogs(id: string, params?: {
    page?: number
    perPage?: number
    level?: 'debug' | 'info' | 'warn' | 'error'
    startDate?: string
    endDate?: string
  }): Promise<PaginatedResponse<{
    id: string
    level: string
    message: string
    timestamp: string
    metadata?: Record<string, any>
  }>> {
    const response = await this.client.get<PaginatedResponse<any>>(`/droplets/${id}/logs`, params)
    return response.data
  }

  /**
   * Trigger a manual sync for the droplet
   */
  async sync(id: string): Promise<ApiResponse<{ jobId: string; status: string }>> {
    const response = await this.client.post<{ jobId: string; status: string }>(`/droplets/${id}/sync`)
    return response
  }

  /**
   * Get droplet statistics
   */
  async getStats(id: string, params?: {
    startDate?: string
    endDate?: string
    granularity?: 'hour' | 'day' | 'week' | 'month'
  }): Promise<ApiResponse<{
    totalRequests: number
    successfulRequests: number
    failedRequests: number
    averageResponseTime: number
    dataPoints: Array<{
      timestamp: string
      requests: number
      errors: number
      responseTime: number
    }>
  }>> {
    const response = await this.client.get<any>(`/droplets/${id}/stats`, params)
    return response
  }
}
