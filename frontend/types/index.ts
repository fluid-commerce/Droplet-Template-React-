// Core types for the Fluid platform integration

export interface FluidConfig {
  apiUrl: string
  apiKey: string
  environment: 'development' | 'staging' | 'production'
}

export interface Droplet {
  id: string
  name: string
  description?: string
  status: 'active' | 'inactive' | 'pending'
  configuration: Record<string, any>
  createdAt: string
  updatedAt: string
}

export interface DropletCreateRequest {
  name: string
  description?: string
  configuration: Record<string, any>
}

export interface DropletUpdateRequest {
  name?: string
  description?: string
  configuration?: Record<string, any>
  status?: 'active' | 'inactive' | 'pending'
}

export interface ApiResponse<T = any> {
  data: T
  message?: string
  success: boolean
}

export interface PaginatedResponse<T = any> {
  data: T[]
  pagination: {
    page: number
    perPage: number
    total: number
    totalPages: number
  }
}

export interface ErrorResponse {
  error: string
  message: string
  details?: Record<string, any>
}

// Permission types
export interface Permission {
  action: string
  resource: string
  conditions?: Record<string, any>
}

export interface User {
  id: string
  email: string
  name: string
  role: 'admin' | 'user' | 'viewer'
  permissions: Permission[]
  createdAt: string
  updatedAt: string
}

// Event types for webhook handling
export interface WebhookEvent {
  id: string
  type: string
  data: Record<string, any>
  timestamp: string
  source: string
}

export interface WebhookSubscription {
  id: string
  url: string
  events: string[]
  secret?: string
  active: boolean
  createdAt: string
  updatedAt: string
}
