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
   * Get brand guidelines settings
   */
  async getBrandGuidelines(authToken: string): Promise<any> {
    const fluidApiUrl = process.env.FLUID_API_URL || 'https://api.fluid.app'
    const brandClient = axios.create({
      baseURL: `${fluidApiUrl}/api`,
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      timeout: 30000,
    })

    try {
      const response = await brandClient.get('/settings/brand_guidelines')
      return response.data
    } catch (error: any) {
      logger.error('Failed to get brand guidelines', { error: error.message })
      throw error
    }
  }

  /**
   * Create a test order for webhook testing using customer's API key
   */
  async createTestOrder(customerApiKey: string, orderData?: any): Promise<any> {
    const fluidApiUrl = process.env.FLUID_API_URL || 'https://api.fluid.app'
    
    // Use customer's API key for order creation (ensures orders appear in customer's account)
    if (!customerApiKey) {
      throw new Error('Customer API key not provided')
    }
    
    const orderClient = axios.create({
      baseURL: `${fluidApiUrl}/api`,
      headers: {
        'Authorization': `Bearer ${customerApiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      timeout: 30000,
    })

    const orderNumber = `TEST-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`
    
    const defaultOrderData = {
      order_number: orderNumber,
      customer_email: 'jane.doe@testmail.com',
      customer_firstname: 'Jane',
      customer_lastname: 'Doe',
      affiliate: {
        email: 'partner@businessmail.com'
      },
      ship_to: {
        address1: '456 Commerce Way',
        city: 'Business City',
        state: 'CA',
        postal_code: '90210'
      },
      items: [
        {
          sku: 'DEMO-PRODUCT-123',
          name: 'Sample Business Item',
          image_url: 'https://via.placeholder.com/150',
          quantity: 2,
          unit_price: 89.95
        }
      ],
      amount_paid: 179.90
    }

    const finalOrderData = { 
      ...defaultOrderData, 
      ...orderData,
      order_number: orderData?.order_number || orderNumber
    }
    
    try {
      // Create order using customer's API key (ensures orders appear in customer's account)
      logger.info('Creating order using customer API key', { 
        orderNumber: finalOrderData.order_number,
        endpoint: '/company/orders.json'
      })
      
      const response = await orderClient.post('/company/orders.json', { 
        order: finalOrderData 
      })
      
      logger.info('Test order created successfully in customer account', {
        orderNumber: finalOrderData.order_number,
        response: response.data
      })
      
      return response.data
    } catch (error: any) {
      logger.error('Failed to create test order in customer account', { 
        orderData: finalOrderData,
        endpoint: '/company/orders.json',
        error: error.response?.data || error.message,
        statusCode: error.response?.status
      }, error)
      
      // If we get a 401, it means the customer API key doesn't have the right permissions
      if (error.response?.status === 401) {
        throw new Error('Customer API key authorization failed. Please check if your API key has order creation permissions.')
      }
      
      throw error
    }
  }

  /**
   * Update an existing order for webhook testing
   */
  async updateTestOrder(customerApiKey: string, orderId: string, updateData?: any): Promise<any> {
    const fluidApiUrl = process.env.FLUID_API_URL || 'https://api.fluid.app'
    
    if (!customerApiKey) {
      throw new Error('Customer API key not provided')
    }
    
    const orderClient = axios.create({
      baseURL: `${fluidApiUrl}/api`,
      headers: {
        'Authorization': `Bearer ${customerApiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      timeout: 30000,
    })

    const defaultUpdateData = {
      status: 'processing',
      tracking_number: `TRK-${Date.now()}`,
      ...updateData
    }

    try {
      logger.info('Updating order using customer API key', { 
        orderId,
        endpoint: `/company/orders/${orderId}.json`
      })
      
      const response = await orderClient.put(`/company/orders/${orderId}.json`, { 
        order: defaultUpdateData 
      })
      
      logger.info('Test order updated successfully in customer account', {
        orderId,
        response: response.data
      })
      
      return response.data
    } catch (error: any) {
      logger.error('Failed to update order in customer account', { 
        orderId,
        error: error.response?.data || error.message,
        statusCode: error.response?.status
      }, error)

      if (error.response?.status === 401) {
        throw new Error('Customer API key authorization failed. Please check if your API key has order update permissions.')
      }

      throw error
    }
  }

  /**
   * Create a test product for webhook testing
   */
  async createTestProduct(customerApiKey: string, productData?: any): Promise<any> {
    const fluidApiUrl = process.env.FLUID_API_URL || 'https://api.fluid.app'
    
    if (!customerApiKey) {
      throw new Error('Customer API key not provided')
    }
    
    const productClient = axios.create({
      baseURL: `${fluidApiUrl}/api`,
      headers: {
        'Authorization': `Bearer ${customerApiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      timeout: 30000,
    })

    const productNumber = `PROD-${Date.now()}`
    const defaultProductData = {
      title: 'Test Product',
      description: 'Test product created for webhook testing',
      price: '29.99',
      sku: productNumber,
      active: true,
      ...productData
    }

    try {
      logger.info('Creating product using customer API key', { 
        productNumber,
        endpoint: '/company/v1/products'
      })
      
      const response = await productClient.post('/company/v1/products', { 
        product: defaultProductData 
      })
      
      return response.data
    } catch (error: any) {
      logger.error('Failed to create product in Fluid', { 
        productData: defaultProductData,
        error: error.response?.data || error.message 
      }, error)
      throw error
    }
  }

  /**
   * Create a test customer for webhook testing
   */
  async createTestCustomer(customerApiKey: string, customerData?: any): Promise<any> {
    const fluidApiUrl = process.env.FLUID_API_URL || 'https://api.fluid.app'
    
    if (!customerApiKey) {
      throw new Error('Customer API key not provided')
    }
    
    const customerClient = axios.create({
      baseURL: `${fluidApiUrl}/api`,
      headers: {
        'Authorization': `Bearer ${customerApiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      timeout: 30000,
    })

    const customerNumber = `CUST-${Date.now()}`
    const defaultCustomerData = {
      first_name: 'Test',
      last_name: 'Customer',
      email: `test-${Date.now()}@example.com`,
      phone: '555-0123',
      ...customerData
    }

    try {
      logger.info('Creating contact using customer API key', { 
        customerNumber,
        endpoint: '/company/contacts'
      })
      
      const response = await customerClient.post('/company/contacts', { 
        contact: defaultCustomerData 
      })
      
      return response.data
    } catch (error: any) {
      logger.error('Failed to create customer in Fluid', { 
        customerData: defaultCustomerData,
        error: error.response?.data || error.message 
      }, error)
      throw error
    }
  }

  /**
   * UPDATE METHODS FOR REAL RESOURCE MODIFICATION
   */

  /**
   * Update existing product by ID
   */
  async updateProduct(customerApiKey: string, productId: string, updateData: any): Promise<any> {
    const fluidApiUrl = process.env.FLUID_API_URL || 'https://api.fluid.app'
    
    if (!customerApiKey) {
      throw new Error('Customer API key not provided')
    }
    
    const client = axios.create({
      baseURL: `${fluidApiUrl}/api`,
      headers: {
        'Authorization': `Bearer ${customerApiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      timeout: 30000,
    })

    try {
      const response = await client.put(`/company/v1/products/${productId}`, {
        product: updateData
      })
      return response.data
    } catch (error: any) {
      logger.error('Failed to update product in Fluid', { 
        productId,
        updateData,
        error: error.response?.data || error.message 
      }, error)
      throw error
    }
  }

  /**
   * Update existing contact by ID  
   */
  async updateContact(customerApiKey: string, contactId: string, updateData: any): Promise<any> {
    const fluidApiUrl = process.env.FLUID_API_URL || 'https://api.fluid.app'
    
    if (!customerApiKey) {
      throw new Error('Customer API key not provided')
    }
    
    const client = axios.create({
      baseURL: `${fluidApiUrl}/api`,
      headers: {
        'Authorization': `Bearer ${customerApiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      timeout: 30000,
    })

    try {
      const response = await client.put(`/company/contacts/${contactId}`, {
        contact: updateData
      })
      return response.data
    } catch (error: any) {
      logger.error('Failed to update contact in Fluid', { 
        contactId,
        updateData,
        error: error.response?.data || error.message 
      }, error)
      throw error
    }
  }

  /**
   * Create a real event in Fluid
   */
  async createEvent(customerApiKey: string, eventData?: any): Promise<any> {
    const fluidApiUrl = process.env.FLUID_API_URL || 'https://api.fluid.app'
    
    if (!customerApiKey) {
      throw new Error('Customer API key not provided')
    }
    
    const customerClient = axios.create({
      baseURL: `${fluidApiUrl}/api`,
      headers: {
        'Authorization': `Bearer ${customerApiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      timeout: 30000,
    })

    const defaultEventData = {
      title: 'Test Event',
      description: 'Test event created via webhook',
      start_date: new Date().toISOString().split('T')[0],
      end_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      start_time: '09:00:00',
      end_time: '17:00:00',
      time_zone: 'UTC',
      url: 'https://example.com',
      active: true,
      venue: 'Test Venue',
      available_countries: ['us'],
      ...eventData
    }

    try {
      logger.info('Creating event using customer API key', { 
        title: defaultEventData.title,
        endpoint: '/company/events'
      })
      
      const response = await customerClient.post('/company/events', { 
        event: defaultEventData 
      })
      
      return response.data
    } catch (error: any) {
      logger.error('Failed to create event in Fluid', { 
        eventData: defaultEventData,
        error: error.response?.data || error.message 
      }, error)
      throw error
    }
  }

  /**
   * Create a real user in Fluid
   */
  async createUser(customerApiKey: string, userData?: any): Promise<any> {
    const fluidApiUrl = process.env.FLUID_API_URL || 'https://api.fluid.app'
    
    if (!customerApiKey) {
      throw new Error('Customer API key not provided')
    }
    
    const customerClient = axios.create({
      baseURL: `${fluidApiUrl}/api`,
      headers: {
        'Authorization': `Bearer ${customerApiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      timeout: 30000,
    })

    const defaultUserData = {
      first_name: 'Test',
      last_name: 'User',
      email: `test-user-${Date.now()}@example.com`,
      phone: '555-0123',
      role: 'rep', // or 'admin', 'customer'
      status: 'active',
      ...userData
    }

    try {
      logger.info('Creating user using customer API key', { 
        email: defaultUserData.email,
        role: defaultUserData.role,
        endpoint: '/company/users'
      })
      
      const response = await customerClient.post('/company/users', { 
        user: defaultUserData 
      })
      
      return response.data
    } catch (error: any) {
      logger.error('Failed to create user in Fluid', { 
        userData: defaultUserData,
        error: error.response?.data || error.message 
      }, error)
      throw error
    }
  }

  /**
   * Create a real conversation in Fluid
   */
  async createConversation(customerApiKey: string, conversationData?: any): Promise<any> {
    const fluidApiUrl = process.env.FLUID_API_URL || 'https://api.fluid.app'
    
    if (!customerApiKey) {
      throw new Error('Customer API key not provided')
    }
    
    const customerClient = axios.create({
      baseURL: `${fluidApiUrl}/api`,
      headers: {
        'Authorization': `Bearer ${customerApiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      timeout: 30000,
    })

    const defaultConversationData = {
      title: 'Test Conversation',
      description: 'Test conversation created via webhook',
      ...conversationData
    }

    try {
      logger.info('Creating conversation using customer API key', { 
        title: defaultConversationData.title,
        endpoint: '/company/messaging/conversations.json'
      })
      
      const response = await customerClient.post('/company/messaging/conversations.json', { 
        conversation: defaultConversationData 
      })
      
      return response.data
    } catch (error: any) {
      logger.error('Failed to create conversation in Fluid', { 
        conversationData: defaultConversationData,
        error: error.response?.data || error.message 
      }, error)
      throw error
    }
  }

  /**
   * Create a real activity in Fluid
   */
  async createActivity(customerApiKey: string, activityData?: any): Promise<any> {
    const fluidApiUrl = process.env.FLUID_API_URL || 'https://api.fluid.app'
    
    if (!customerApiKey) {
      throw new Error('Customer API key not provided')
    }
    
    const customerClient = axios.create({
      baseURL: `${fluidApiUrl}/api`,
      headers: {
        'Authorization': `Bearer ${customerApiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      timeout: 30000,
    })

    const defaultActivityData = {
      title: 'Test Activity',
      description: 'Test activity created via webhook',
      activity_type: 'webhook_test',
      ...activityData
    }

    try {
      logger.info('Creating activity using customer API key', { 
        title: defaultActivityData.title,
        endpoint: '/company/activities'
      })
      
      const response = await customerClient.post('/company/activities', { 
        activity: defaultActivityData 
      })
      
      return response.data
    } catch (error: any) {
      logger.error('Failed to create activity in Fluid', { 
        activityData: defaultActivityData,
        error: error.response?.data || error.message 
      }, error)
      throw error
    }
  }

  /**
   * Get orders from Fluid API
   */
  async getOrders(customerApiKey?: string, limit: number = 10): Promise<any[]> {
    const fluidApiUrl = process.env.FLUID_API_URL || 'https://api.fluid.app'

    try {
      logger.info('Fetching orders from Fluid API', {
        limit,
        endpoint: '/company/orders.json',
        usingCustomerKey: !!customerApiKey
      })

      // Use customer API key if provided, otherwise use default client
      const client = customerApiKey ? axios.create({
        baseURL: fluidApiUrl,
        headers: {
          'Authorization': `Bearer ${customerApiKey}`,
          'Content-Type': 'application/json'
        }
      }) : this.client

      const response = await client.get('/company/orders.json', {
        params: {
          limit: limit
        }
      })

      logger.info('Orders fetched successfully', {
        orderCount: response.data?.orders?.length || 0
      })

      return response.data?.orders || []
    } catch (error: any) {
      logger.error('Failed to fetch orders from Fluid API', {
        limit,
        endpoint: '/company/orders.json',
        error: error.response?.data || error.message,
        statusCode: error.response?.status
      }, error)

      if (error.response?.status === 401) {
        throw new Error('API key authorization failed. Please check if your API key has order read permissions.')
      }

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
