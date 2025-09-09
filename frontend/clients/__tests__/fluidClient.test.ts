import { FluidClient } from '../fluidClient'
import { FluidConfig } from '@/types'
import axios from 'axios'

// Mock axios
jest.mock('axios')
const mockedAxios = axios as jest.Mocked<typeof axios>

describe('FluidClient', () => {
  let client: FluidClient
  let config: FluidConfig
  let mockAxiosInstance: any

  beforeEach(() => {
    config = {
      apiUrl: 'https://api.fluid.com',
      apiKey: 'test-api-key',
      environment: 'development',
    }
    
    // Create a mock axios instance
    mockAxiosInstance = {
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      patch: jest.fn(),
      delete: jest.fn(),
      interceptors: {
        request: { use: jest.fn() },
        response: { use: jest.fn() },
      },
      defaults: { headers: {} },
    }
    
    // Reset mocks first
    jest.clearAllMocks()
    
    // Set up the mock
    mockedAxios.create.mockReturnValue(mockAxiosInstance)
    
    client = new FluidClient(config)
  })

  describe('initialization', () => {
    it('creates client with correct configuration', () => {
      expect(client.getConfig()).toEqual(config)
    })

    it('sets up axios instance with correct base URL and headers', () => {
      expect(mockedAxios.create).toHaveBeenCalledWith({
        baseURL: config.apiUrl,
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        timeout: 30000,
      })
    })
  })

  describe('HTTP methods', () => {
    const mockResponse = {
      data: { success: true, data: { id: '1', name: 'test' } },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
    }

    beforeEach(() => {
      mockAxiosInstance.get.mockResolvedValue(mockResponse)
      mockAxiosInstance.post.mockResolvedValue(mockResponse)
      mockAxiosInstance.put.mockResolvedValue(mockResponse)
      mockAxiosInstance.patch.mockResolvedValue(mockResponse)
      mockAxiosInstance.delete.mockResolvedValue(mockResponse)
    })

    it('performs GET request', async () => {
      const result = await client.get('/test')
      expect(result).toEqual(mockResponse.data)
    })

    it('performs POST request', async () => {
      const data = { name: 'test' }
      const result = await client.post('/test', data)
      expect(result).toEqual(mockResponse.data)
    })

    it('performs PUT request', async () => {
      const data = { name: 'updated' }
      const result = await client.put('/test/1', data)
      expect(result).toEqual(mockResponse.data)
    })

    it('performs PATCH request', async () => {
      const data = { name: 'patched' }
      const result = await client.patch('/test/1', data)
      expect(result).toEqual(mockResponse.data)
    })

    it('performs DELETE request', async () => {
      const result = await client.delete('/test/1')
      expect(result).toEqual(mockResponse.data)
    })
  })

  describe('configuration management', () => {
    it('updates API key', () => {
      const newApiKey = 'new-api-key'
      client.updateApiKey(newApiKey)
      
      const updatedConfig = client.getConfig()
      expect(updatedConfig.apiKey).toBe(newApiKey)
    })
  })

  describe('error handling', () => {
    it('handles network errors', async () => {
      const networkError = new Error('Network Error')
      mockAxiosInstance.get.mockRejectedValue(networkError)

      await expect(client.get('/test')).rejects.toThrow()
    })

    it('handles API errors', async () => {
      const apiError = {
        response: {
          data: {
            error: 'Validation Error',
            message: 'Invalid input',
            details: { field: 'name' },
          },
        },
      }

      mockAxiosInstance.get.mockRejectedValue(apiError)

      await expect(client.get('/test')).rejects.toMatchObject({
        response: {
          data: {
            error: 'Validation Error',
            message: 'Invalid input',
            details: { field: 'name' },
          },
        },
      })
    })
  })
})
