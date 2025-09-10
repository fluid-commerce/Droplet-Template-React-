import { apiClient } from './api'

interface ApiResponse<T = any> {
  success: boolean
  message?: string
  data?: T
  error?: string
  details?: any
}

interface DropletConfig {
  integrationName: string
  companyName: string
  environment: 'production' | 'staging' | 'development'
  fluidApiKey: string
  webhookUrl?: string
}

interface DashboardData {
  companyName: string
  totalUsers: number
  activeUsers: number
  recentActivity: Array<{
    description: string
    timestamp: string
    details?: string
  }>
  customers: Array<{
    id: string
    name: string
    email: string
    phone?: string
    status: string
    lastActivity: string
    company: string
    role: string
  }>
}


class DropletsApiClient {
  async configure(config: DropletConfig & { installationId?: string }): Promise<ApiResponse> {
    try {
      const response = await apiClient.post('/api/droplet/configure', config)
      return response.data
    } catch (error: any) {
      throw new Error(error.response?.data?.message || error.message || 'Configuration failed')
    }
  }

  async getStatus(installationId: string, fluidApiKey: string): Promise<ApiResponse> {
    try {
      const response = await apiClient.get(`/api/droplet/status/${installationId}`, {
        params: { fluidApiKey }
      })
      return response.data
    } catch (error: any) {
      throw new Error(error.response?.data?.message || error.message || 'Status check failed')
    }
  }

  async testConnection(fluidApiKey: string): Promise<ApiResponse> {
    try {
      const response = await apiClient.post('/api/droplet/test-connection', {
        fluidApiKey
      })
      return response.data
    } catch (error: any) {
      throw new Error(error.response?.data?.message || error.message || 'Connection test failed')
    }
  }

  async getDashboard(installationId: string, fluidApiKey: string): Promise<ApiResponse<DashboardData>> {
    try {
      const response = await apiClient.get(`/api/droplet/dashboard/${installationId}`, {
        params: { fluidApiKey }
      })
      return response.data
    } catch (error: any) {
      throw new Error(error.response?.data?.message || error.message || 'Dashboard load failed')
    }
  }

  async sync(installationId: string, fluidApiKey: string): Promise<ApiResponse> {
    try {
      const response = await apiClient.post('/api/droplet/sync', {
        installationId,
        fluidApiKey
      })
      return response.data
    } catch (error: any) {
      throw new Error(error.response?.data?.message || error.message || 'Sync failed')
    }
  }

  async disconnect(installationId: string): Promise<ApiResponse> {
    try {
      const response = await apiClient.post('/api/droplet/disconnect', {
        installationId
      })
      return response.data
    } catch (error: any) {
      throw new Error(error.response?.data?.message || error.message || 'Disconnect failed')
    }
  }


}

export const dropletsClient = new DropletsApiClient()
export type { DropletConfig, DashboardData, ApiResponse }