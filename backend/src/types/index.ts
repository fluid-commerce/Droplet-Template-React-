// Backend types for droplet template

export interface DropletConfig {
  integrationName: string
  companyName: string
  environment: 'production' | 'staging' | 'development'
  fluidApiKey: string
}

export interface DropletInstallation {
  id: string
  dropletId: string
  companyId: string
  authenticationToken: string
  configuration: DropletConfig
  status: 'pending' | 'active' | 'failed' | 'inactive'
  createdAt: string
  updatedAt: string
}

export interface FluidApiResponse<T = any> {
  data: T
  message?: string
  success: boolean
}

export interface FluidDropletInstallation {
  id: string
  droplet_id: string
  company_id: string
  authentication_token: string
  status: string
  created_at: string
  updated_at: string
  configuration?: DropletConfig
}

export interface WebhookEvent {
  id?: string
  type?: string
  event_name?: string
  data: Record<string, any>
  timestamp?: string
  source?: string
}

export interface ApiError {
  error: string
  message: string
  details?: Record<string, any>
  statusCode: number
}
