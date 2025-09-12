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

  const formatColor = (color: string | null | undefined) => {
    if (!color) return undefined
    return color.startsWith('#') ? color : `#${color}`
  }

  const handleTestWebhook = async (webhookType: string = 'order.created') => {
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
          currency: 'USD'
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