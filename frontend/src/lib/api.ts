import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://droplet-template-backend.onrender.com'

// Debug logging
console.log('API_BASE_URL:', API_BASE_URL)
console.log('VITE_API_BASE_URL env var:', import.meta.env.VITE_API_BASE_URL)

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Add request interceptor for error handling
apiClient.interceptors.request.use(
  (config) => {
    return config
  },
  (error) => {
    console.error('API Request Error:', error)
    return Promise.reject(error)
  }
)

// Add response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => {
    return response
  },
  (error) => {
    console.error('API Response Error:', error.response?.status, error.config?.url, error.response?.data)
    return Promise.reject(error)
  }
)
