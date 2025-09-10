import axios from 'axios'

// Configure axios base URL for API calls
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001'

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor - only log in development
apiClient.interceptors.request.use(
  (config) => {
    if (import.meta.env.DEV) {
      // Request logging handled by interceptor
    }
    return config
  },
  (error) => {
    console.error('API request error:', error)
    return Promise.reject(error)
  }
)

// Response interceptor
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API response error:', error.response?.data || error.message)
    return Promise.reject(error)
  }
)

export default apiClient
