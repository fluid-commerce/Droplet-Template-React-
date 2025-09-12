import { useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { apiClient } from '@/lib/api'

interface WebhookEvent {
  id: string
  type: string
  data: any
  createdAt: string
  processingStatus?: string
  retryCount?: number
}

interface WebhookTestResult {
  type: string
  success: boolean
  resourceId?: string
  resourceData?: any
  error?: string
  details?: any
  createdAt: string
}

interface WebhookTesterProps {
  installationId: string | null
  fluidApiKey: string | null
  brandGuidelines?: any
}

export function WebhookTester({ installationId, fluidApiKey, brandGuidelines }: WebhookTesterProps) {
  const [loadingStates, setLoadingStates] = useState<{ [key: string]: boolean }>({})
  const [testResults, setTestResults] = useState<{ [key: string]: WebhookTestResult }>({})
  const [recentWebhooks, setRecentWebhooks] = useState<WebhookEvent[]>([])
  const [expandedLogs, setExpandedLogs] = useState<{ [key: string]: boolean }>({})
  const [showJsonData, setShowJsonData] = useState<{ [key: string]: boolean }>({})
  const [expandedCategories, setExpandedCategories] = useState<{ [key: string]: boolean }>({})
  
  // Modal state for Swagger-style dynamic forms
  const [showModal, setShowModal] = useState(false)
  const [currentWebhookType, setCurrentWebhookType] = useState('')
  const [formData, setFormData] = useState<{ [key: string]: any }>({})
  const [availableResources, setAvailableResources] = useState<any[]>([])

  const formatColor = (color: string | null | undefined) => {
    if (!color) return undefined
    return color.startsWith('#') ? color : `#${color}`
  }

  // Check if webhook needs modal (UPDATE/DELETE operations)
  const needsModal = (webhookType: string) => {
    return webhookType.includes('updated') || 
           webhookType.includes('refunded') || 
           webhookType.includes('canceled') ||
           webhookType.includes('shipped') ||
           webhookType.includes('destroyed')
  }

  // Get form fields for each webhook type
  const getFormFields = (webhookType: string) => {
    switch (webhookType) {
      case 'order_refunded':
        return [
          { name: 'refund_amount', label: 'Refund Amount', type: 'number', placeholder: '199.99' },
          { name: 'refund_reason', label: 'Refund Reason', type: 'text', placeholder: 'Customer request' },
          { name: 'partial_refund', label: 'Partial Refund', type: 'checkbox' }
        ]
      case 'order_shipped':
        return [
          { name: 'tracking_number', label: 'Tracking Number', type: 'text', placeholder: 'UPS123456789' },
          { name: 'carrier', label: 'Shipping Carrier', type: 'text', placeholder: 'UPS' },
          { name: 'estimated_delivery', label: 'Estimated Delivery', type: 'date' }
        ]
      case 'customer_updated':
      case 'contact_updated':
        return [
          { name: 'first_name', label: 'First Name', type: 'text', placeholder: 'John' },
          { name: 'last_name', label: 'Last Name', type: 'text', placeholder: 'Doe' },
          { name: 'email', label: 'Email', type: 'email', placeholder: 'john@example.com' },
          { name: 'phone', label: 'Phone', type: 'tel', placeholder: '+1-555-0123' }
        ]
      case 'product_updated':
        return [
          { name: 'title', label: 'Product Title', type: 'text', placeholder: 'Updated Product Name' },
          { name: 'price', label: 'Price', type: 'number', placeholder: '29.99' },
          { name: 'description', label: 'Description', type: 'textarea', placeholder: 'Product description...' }
        ]
      default:
        return []
    }
  }

  // Fetch available resources for selection
  const fetchResources = async (webhookType: string) => {
    if (!installationId || !fluidApiKey) return
    
    try {
      let endpoint = ''
      if (webhookType.includes('order')) endpoint = '/api/droplet/orders?limit=10'
      else if (webhookType.includes('product')) endpoint = '/api/droplet/products?limit=10'  
      else if (webhookType.includes('customer') || webhookType.includes('contact')) endpoint = '/api/droplet/contacts?limit=10'
      
      if (endpoint) {
        const response = await apiClient.get(endpoint, {
          headers: { 'Authorization': `Bearer ${fluidApiKey}` }
        })
        setAvailableResources(response.data.data.orders || response.data.data.products || response.data.data.contacts || [])
      }
    } catch (error) {
      console.error('Failed to fetch resources:', error)
      setAvailableResources([])
    }
  }

  // Open modal for webhook testing
  const openModal = async (webhookType: string) => {
    setCurrentWebhookType(webhookType)
    setFormData({})
    setShowModal(true)
    await fetchResources(webhookType)
  }

  // Handle form submission
  const handleModalSubmit = async () => {
    await executeWebhookTest(currentWebhookType, formData)
    setShowModal(false)
    setFormData({})
  }

  // Execute the webhook test with form data
  const executeWebhookTest = async (webhookType: string, testData: any = {}) => {
    if (!installationId || !fluidApiKey) {
      alert('Missing installation ID or API key')
      return
    }

    setLoadingStates(prev => ({ ...prev, [webhookType]: true }))
    try {
      const response = await apiClient.post('/api/droplet/test-webhook', {
        webhookType,
        installationId,
        testData: {
          customer_name: 'Jane Doe from Dashboard',
          total: 179.90,
          currency: 'USD',
          ...testData
        }
      }, {
        headers: {
          'Authorization': `Bearer ${fluidApiKey}`
        }
      })

      setTestResults(prev => ({ ...prev, [webhookType]: response.data.data.test }))
      setRecentWebhooks(response.data.data.recentWebhooks || [])
    } catch (err: any) {
      console.error('Webhook test failed:', err)
      setTestResults(prev => ({ ...prev, [webhookType]: {
        type: webhookType,
        success: false,
        error: err.response?.data?.message || 'Test failed',
        details: err.response?.data,
        createdAt: new Date().toISOString()
      }}))
    } finally {
      setLoadingStates(prev => ({ ...prev, [webhookType]: false }))
    }
  }

  const handleTestWebhook = async (webhookType: string = 'order.created') => {
    // If needs modal, open it instead of direct test
    if (needsModal(webhookType)) {
      await openModal(webhookType)
      return
    }

    // Direct test for simple operations
    await executeWebhookTest(webhookType)
  }

  const toggleLogExpansion = (logId: string) => {
    setExpandedLogs(prev => ({
      ...prev,
      [logId]: !prev[logId]
    }))
  }

  const toggleCategoryExpansion = (categoryName: string) => {
    setExpandedCategories(prev => ({
      ...prev,
      [categoryName]: !prev[categoryName]
    }))
  }

  const toggleJsonData = (logId: string) => {
    setShowJsonData(prev => ({
      ...prev,
      [logId]: !prev[logId]
    }))
  }

  const formatJsonData = (data: any) => {
    try {
      return JSON.stringify(data, null, 2)
    } catch {
      return String(data)
    }
  }

  // Complete Fluid webhook events - ALL 47 webhook types
  const webhookEndpoints = [
    {
      category: 'Orders',
      endpoints: [
        { name: 'Order Created', type: 'order_created', method: 'POST', description: 'New order created' },
        { name: 'Order Completed', type: 'order_completed', method: 'POST', description: 'Order completion webhook' },
        { name: 'Order Updated', type: 'order_updated', method: 'PUT', description: 'Order status/details updated' },
        { name: 'Order Shipped', type: 'order_shipped', method: 'PUT', description: 'Order marked as shipped' },
        { name: 'Order Canceled', type: 'order_canceled', method: 'PUT', description: 'Order cancellation' },
        { name: 'Order Refunded', type: 'order_refunded', method: 'POST', description: 'Order refund processed' },
      ]
    },
    {
      category: 'Products',
      endpoints: [
        { name: 'Product Created', type: 'product_created', method: 'POST', description: 'New product created' },
        { name: 'Product Updated', type: 'product_updated', method: 'PUT', description: 'Product information updated' },
        { name: 'Product Destroyed', type: 'product_destroyed', method: 'DELETE', description: 'Product deleted/destroyed' },
      ]
    },
    {
      category: 'Users',
      endpoints: [
        { name: 'User Created', type: 'user_created', method: 'POST', description: 'New user account created' },
        { name: 'User Updated', type: 'user_updated', method: 'PUT', description: 'User profile updated' },
        { name: 'User Deactivated', type: 'user_deactivated', method: 'DELETE', description: 'User account deactivated' },
      ]
    },
    {
      category: 'Contacts',
      endpoints: [
        { name: 'Contact Created', type: 'contact_created', method: 'POST', description: 'New contact created' },
        { name: 'Contact Updated', type: 'contact_updated', method: 'PUT', description: 'Contact profile updated' },
      ]
    },
    {
      category: 'Customers',
      endpoints: [
        { name: 'Customer Created', type: 'customer_created', method: 'POST', description: 'New customer created' },
        { name: 'Customer Updated', type: 'customer_updated', method: 'PUT', description: 'Customer profile updated' },
      ]
    },
    {
      category: 'Cart & Shopping',
      endpoints: [
        { name: 'Cart Updated', type: 'cart_updated', method: 'PUT', description: 'Shopping cart contents updated' },
        { name: 'Cart Abandoned', type: 'cart_abandoned', method: 'POST', description: 'Shopping cart abandoned' },
        { name: 'Cart Update Address', type: 'cart_update_address', method: 'PUT', description: 'Cart shipping address updated' },
        { name: 'Cart Update Email', type: 'cart_update_cart_email', method: 'PUT', description: 'Cart email address updated' },
        { name: 'Cart Add Items', type: 'cart_add_items', method: 'POST', description: 'Items added to cart' },
        { name: 'Cart Remove Items', type: 'cart_remove_items', method: 'DELETE', description: 'Items removed from cart' },
      ]
    },
    {
      category: 'Subscriptions',
      endpoints: [
        { name: 'Subscription Started', type: 'subscription_started', method: 'POST', description: 'New subscription activated' },
        { name: 'Subscription Paused', type: 'subscription_paused', method: 'PUT', description: 'Subscription temporarily paused' },
        { name: 'Subscription Cancelled', type: 'subscription_cancelled', method: 'DELETE', description: 'Subscription permanently cancelled' },
      ]
    },
    {
      category: 'Events',
      endpoints: [
        { name: 'Event Created', type: 'event_created', method: 'POST', description: 'New event created' },
        { name: 'Event Updated', type: 'event_updated', method: 'PUT', description: 'Event details updated' },
        { name: 'Event Deleted', type: 'event_deleted', method: 'DELETE', description: 'Event removed' },
      ]
    },
    {
      category: 'Marketing & Engagement',
      endpoints: [
        { name: 'Webchat Submitted', type: 'webchat_submitted', method: 'POST', description: 'Webchat form submitted' },
        { name: 'Popup Submitted', type: 'popup_submitted', method: 'POST', description: 'Marketing popup form submitted' },
        { name: 'Bot Message Created', type: 'bot_message_created', method: 'POST', description: 'Automated bot message created' },
      ]
    },
    {
      category: 'System & Integration',
      endpoints: [
        { name: 'Droplet Installed', type: 'droplet_installed', method: 'POST', description: 'Droplet successfully installed' },
        { name: 'Droplet Uninstalled', type: 'droplet_uninstalled', method: 'DELETE', description: 'Droplet removed/uninstalled' },
        { name: 'Enrollment Completed', type: 'enrollment_completed', method: 'POST', description: 'User enrollment process completed' },
      ]
    },
    {
      category: 'Authentication & Security',
      endpoints: [
        { name: 'MFA Missing Email', type: 'mfa_missing_email', method: 'POST', description: 'Multi-factor auth missing email' },
        { name: 'MFA Verified', type: 'mfa_verified', method: 'POST', description: 'Multi-factor authentication verified' },
      ]
    }
  ]

  return (
    <div className="space-y-4">
      {/* Swagger-style Dynamic Form Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-lg w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900 text-lg">
                {currentWebhookType.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())} Parameters
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <FontAwesomeIcon icon="times" />
              </button>
            </div>

            {/* Resource Selection */}
            {availableResources.length > 0 && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Resource to Update:
                </label>
                <select
                  value={formData.resourceId || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, resourceId: e.target.value }))}
                  className="w-full p-2 border border-gray-300 rounded-md text-sm"
                >
                  <option value="">Select a resource...</option>
                  {availableResources.map((resource: any) => (
                    <option key={resource.id} value={resource.id}>
                      {resource.order_number || resource.title || `${resource.first_name} ${resource.last_name}` || `ID: ${resource.id}`} 
                      {resource.display_amount && ` - ${resource.display_amount}`}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Dynamic Form Fields */}
            <div className="space-y-4">
              {getFormFields(currentWebhookType).map((field) => (
                <div key={field.name}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {field.label}
                  </label>
                  {field.type === 'textarea' ? (
                    <textarea
                      value={formData[field.name] || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, [field.name]: e.target.value }))}
                      placeholder={field.placeholder}
                      rows={3}
                      className="w-full p-2 border border-gray-300 rounded-md text-sm"
                    />
                  ) : field.type === 'checkbox' ? (
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={formData[field.name] || false}
                        onChange={(e) => setFormData(prev => ({ ...prev, [field.name]: e.target.checked }))}
                        className="mr-2"
                      />
                      {field.label}
                    </label>
                  ) : (
                    <input
                      type={field.type}
                      value={formData[field.name] || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, [field.name]: e.target.value }))}
                      placeholder={field.placeholder}
                      className="w-full p-2 border border-gray-300 rounded-md text-sm"
                    />
                  )}
                </div>
              ))}
            </div>

            {/* Modal Actions */}
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={handleModalSubmit}
                disabled={loadingStates[currentWebhookType]}
                className="px-4 py-2 text-sm font-medium text-white rounded-md disabled:opacity-50"
                style={{
                  backgroundColor: formatColor(brandGuidelines?.color) || '#16a34a'
                }}
              >
                {loadingStates[currentWebhookType] ? 'Testing...' : 'Execute Webhook'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Comprehensive API-style Webhook Testing Section */}
      {webhookEndpoints.map((category) => (
        <div key={category.category} className="bg-white rounded-lg border border-gray-200">
          <button
            onClick={() => toggleCategoryExpansion(category.category)}
            className="w-full bg-gray-50 px-4 py-3 border-b border-gray-200 hover:bg-gray-100 transition-colors flex items-center justify-between"
          >
            <h3 className="font-semibold text-gray-900 text-sm">{category.category}</h3>
            <FontAwesomeIcon 
              icon={expandedCategories[category.category] ? "chevron-up" : "chevron-down"} 
              className="text-gray-400 text-sm" 
            />
          </button>
          
          {expandedCategories[category.category] && category.endpoints.map((endpoint) => (
            <div key={endpoint.type} className="border-b border-gray-100 last:border-b-0">
              <div className="flex items-center justify-between p-4">
                <div className="flex items-center space-x-3">
                  <span className="font-semibold text-gray-900">{endpoint.name}</span>
                  <span className={`px-2 py-1 text-xs font-medium rounded ${
                    endpoint.method === 'POST' ? 'bg-blue-100 text-blue-700' :
                    endpoint.method === 'PUT' ? 'bg-yellow-100 text-yellow-700' :
                    endpoint.method === 'DELETE' ? 'bg-red-100 text-red-700' :
                    'bg-green-100 text-green-700'
                  }`}>
                    {endpoint.method}
                  </span>
                  <span className="text-xs text-gray-500">{endpoint.description}</span>
                </div>
                <button
                  onClick={() => handleTestWebhook(endpoint.type)}
                  disabled={loadingStates[endpoint.type] || false}
                  className="px-3 py-1.5 text-sm font-medium rounded-md text-white transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    backgroundColor: formatColor(brandGuidelines?.color) || '#16a34a',
                    color: 'white'
                  }}
                >
                  {loadingStates[endpoint.type] ? (
                    <div className="flex items-center">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                      Testing...
                    </div>
                  ) : (
                    'Test'
                  )}
                </button>
              </div>
              
              {/* Individual Test Result for this endpoint */}
              {testResults[endpoint.type] && (
                <div className="px-4 pb-4">
                  <div className="bg-gray-900 rounded-lg border border-gray-700 p-3 font-mono">
                    <div className="space-y-2">
                      {/* Terminal Header */}
                      <div className="flex items-center space-x-2 pb-2 border-b border-gray-700">
                        <div className="flex space-x-1">
                          <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                          <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        </div>
                        <span className="text-gray-400 text-xs">Test Result</span>
                      </div>
                      
                      {/* Test Status */}
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <span className="text-green-400 text-xs">$</span>
                          <span className="text-white text-xs">webhook-test --type={endpoint.type}</span>
                        </div>
                        
                        <div className={`p-2 rounded border-l-2 ${
                          testResults[endpoint.type].success 
                            ? 'bg-green-900/20 border-green-500' 
                            : 'bg-red-900/20 border-red-500'
                        }`}>
                          <div className="flex items-center space-x-2">
                            <span className={`text-xs font-bold ${
                              testResults[endpoint.type].success ? 'text-green-400' : 'text-red-400'
                            }`}>
                              {testResults[endpoint.type].success ? '✓ SUCCESS' : '✗ FAILED'}
                            </span>
                            <span className="text-gray-400 text-xs">
                              {new Date(testResults[endpoint.type].createdAt).toLocaleTimeString()}
                            </span>
                          </div>
                          
                          {testResults[endpoint.type].success && testResults[endpoint.type].resourceId && (
                            <div className="mt-1">
                              <p className="text-green-300 text-xs">
                                <span className="text-gray-400">Resource ID:</span> {testResults[endpoint.type].resourceId}
                              </p>
                            </div>
                          )}
                          
                          {testResults[endpoint.type].error && (
                            <div className="mt-1">
                              <p className="text-red-300 text-xs">
                                <span className="text-gray-400">Error:</span> {testResults[endpoint.type].error}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      ))}


      {/* Recent Webhook Events - Terminal Style */}
      {recentWebhooks.length > 0 && (
        <div className="bg-gray-900 rounded-lg border border-gray-700 p-4 font-mono">
          <div className="flex items-center space-x-2 pb-3 border-b border-gray-700 mb-4">
            <div className="flex space-x-1">
              <div className="w-3 h-3 bg-red-500 rounded-full"></div>
              <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            </div>
            <span className="text-gray-400 text-sm">Webhook Event Logs</span>
          </div>

          <div className="space-y-3 max-h-96 overflow-y-auto">
            {recentWebhooks.map((webhook) => (
              <div key={webhook.id} className="border border-gray-700 rounded-lg bg-gray-800/50">
                <button
                  onClick={() => toggleLogExpansion(webhook.id)}
                  className="w-full p-3 text-left hover:bg-gray-800 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className={`w-2 h-2 rounded-full ${
                        webhook.processingStatus === 'success' ? 'bg-green-400' :
                        webhook.processingStatus === 'failed' ? 'bg-red-400' :
                        'bg-yellow-400'
                      }`} />
                      <div>
                        <p className="font-medium text-sm text-white">
                          {webhook.type || 'Unknown Event'}
                        </p>
                        <p className="text-xs text-gray-400">
                          {new Date(webhook.createdAt).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <FontAwesomeIcon 
                      icon={expandedLogs[webhook.id] ? "chevron-up" : "chevron-down"} 
                      className="text-gray-400 text-xs" 
                    />
                  </div>
                </button>

                {expandedLogs[webhook.id] && (
                  <div className="px-3 pb-3 border-t border-gray-700">
                    <div className="mt-3 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-gray-400">JSON Data:</span>
                        <button
                          onClick={() => toggleJsonData(webhook.id)}
                          className="text-xs text-blue-400 hover:text-blue-300"
                        >
                          {showJsonData[webhook.id] ? 'Hide' : 'Show'} JSON
                        </button>
                      </div>
                      
                      {showJsonData[webhook.id] && (
                        <pre className="bg-gray-800 p-3 rounded text-xs overflow-x-auto border border-gray-700">
                          <code className="text-green-300">{formatJsonData(webhook.data)}</code>
                        </pre>
                      )}

                      {webhook.retryCount && webhook.retryCount > 0 && (
                        <p className="text-xs text-yellow-400">
                          Retried {webhook.retryCount} times
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}