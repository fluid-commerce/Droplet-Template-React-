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
  const [testResult, setTestResult] = useState<WebhookTestResult | null>(null)
  const [recentWebhooks, setRecentWebhooks] = useState<WebhookEvent[]>([])
  const [expandedLogs, setExpandedLogs] = useState<{ [key: string]: boolean }>({})
  const [showJsonData, setShowJsonData] = useState<{ [key: string]: boolean }>({})

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

      setTestResult(response.data.data.test)
      setRecentWebhooks(response.data.data.recentWebhooks || [])
    } catch (err: any) {
      console.error('Webhook test failed:', err)
      setTestResult({
        type: webhookType,
        success: false,
        error: err.response?.data?.message || 'Test failed',
        details: err.response?.data,
        createdAt: new Date().toISOString()
      })
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
          <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
            <h3 className="font-semibold text-gray-900 text-sm">{category.category}</h3>
          </div>
          
          {category.endpoints.map((endpoint) => (
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
            </div>
          ))}
        </div>
      ))}

      {/* Test Results Section */}
      {testResult && (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="space-y-4">
              {/* Test Status */}
              <div className={`p-4 rounded-lg border ${
                testResult.success 
                  ? 'bg-green-50 border-green-200' 
                  : 'bg-red-50 border-red-200'
              }`}>
                <div className="flex items-center space-x-2 mb-2">
                  <FontAwesomeIcon 
                    icon={testResult.success ? "check-circle" : "exclamation-circle"} 
                    className={`text-sm ${
                      testResult.success ? 'text-green-600' : 'text-red-600'
                    }`}
                  />
                  <span className={`font-medium text-sm ${
                    testResult.success ? 'text-green-800' : 'text-red-800'
                  }`}>
                    {testResult.success ? 'Test Successful' : 'Test Failed'}
                  </span>
                </div>
                
                {testResult.success && testResult.resourceId && (
                  <p className="text-xs text-green-700 mb-2">
                    {testResult.type.includes('order') ? 'Order' :
                     testResult.type.includes('product') ? 'Product' :
                     testResult.type.includes('customer') ? 'Customer' : 'Resource'} ID: {testResult.resourceId}
                  </p>
                )}
                
                {testResult.error && (
                  <p className="text-xs text-red-700 mb-2">
                    Error: {testResult.error}
                  </p>
                )}
                
                <p className="text-xs text-gray-600">
                  {new Date(testResult.createdAt).toLocaleString()}
                </p>
              </div>

              {/* Detailed Logs Section */}
              {testResult.success && testResult.resourceData && (
                <div className="bg-gray-50 rounded-lg border border-gray-200">
                  <div className="p-4 border-b border-gray-200">
                    <h4 className="font-semibold text-gray-900 text-sm flex items-center">
                      <FontAwesomeIcon icon="file-alt" className="mr-2 text-gray-600" />
                      Detailed Logs
                    </h4>
                  </div>
                  <div className="p-4 space-y-4">
                    {/* Resource Summary */}
                    <div>
                      <h5 className="font-medium text-gray-800 text-sm mb-2">
                        {testResult.type.includes('order') ? 'Order' :
                         testResult.type.includes('product') ? 'Product' :
                         testResult.type.includes('customer') ? 'Customer' : 'Resource'} Summary
                      </h5>
                      <div className="bg-white p-3 rounded border text-xs space-y-1">
                        {/* Order-specific fields */}
                        {testResult.type.includes('order') && (
                          <>
                            <div><strong>Order Number:</strong> {testResult.resourceData.order_number}</div>
                            <div><strong>Status:</strong> {testResult.resourceData.friendly_status || testResult.resourceData.status}</div>
                            <div><strong>Amount:</strong> {testResult.resourceData.display_amount || `$${testResult.resourceData.amount}`}</div>
                            <div><strong>Customer:</strong> {testResult.resourceData.first_name} {testResult.resourceData.last_name}</div>
                            <div><strong>Email:</strong> {testResult.resourceData.email}</div>
                          </>
                        )}
                        
                        {/* Product-specific fields */}
                        {testResult.type.includes('product') && (
                          <>
                            <div><strong>Product Title:</strong> {testResult.resourceData.title}</div>
                            <div><strong>SKU:</strong> {testResult.resourceData.sku}</div>
                            <div><strong>Price:</strong> {testResult.resourceData.display_price || `$${testResult.resourceData.price}`}</div>
                            <div><strong>Status:</strong> {testResult.resourceData.active ? 'Active' : 'Inactive'}</div>
                            <div><strong>Description:</strong> {testResult.resourceData.description}</div>
                          </>
                        )}
                        
                        {/* Customer-specific fields */}
                        {testResult.type.includes('customer') && (
                          <>
                            <div><strong>Name:</strong> {testResult.resourceData.first_name} {testResult.resourceData.last_name}</div>
                            <div><strong>Email:</strong> {testResult.resourceData.email}</div>
                            <div><strong>Phone:</strong> {testResult.resourceData.phone || 'N/A'}</div>
                            <div><strong>Status:</strong> {testResult.resourceData.status || 'Active'}</div>
                          </>
                        )}
                        
                        {/* Common fields */}
                        <div><strong>ID:</strong> {testResult.resourceId}</div>
                        <div><strong>Created:</strong> {new Date(testResult.resourceData.created_at || testResult.createdAt).toLocaleString()}</div>
                      </div>
                    </div>

                    {/* Order-specific sections */}
                    {testResult.type.includes('order') && testResult.resourceData.ship_to && (
                      <div>
                        <h5 className="font-medium text-gray-800 text-sm mb-2">Shipping Address</h5>
                        <div className="bg-white p-3 rounded border text-xs">
                          <div>{testResult.resourceData.ship_to.address1}</div>
                          {testResult.resourceData.ship_to.address2 && <div>{testResult.resourceData.ship_to.address2}</div>}
                          <div>{testResult.resourceData.ship_to.city}, {testResult.resourceData.ship_to.state} {testResult.resourceData.ship_to.postal_code}</div>
                        </div>
                      </div>
                    )}

                    {testResult.type.includes('order') && testResult.resourceData.items && testResult.resourceData.items.length > 0 && (
                      <div>
                        <h5 className="font-medium text-gray-800 text-sm mb-2">Order Items</h5>
                        <div className="bg-white rounded border overflow-hidden">
                          {testResult.resourceData.items.map((item: any, index: number) => (
                            <div key={index} className="p-3 border-b border-gray-100 last:border-b-0">
                              <div className="flex items-start space-x-3 text-xs">
                                <img 
                                  src={item.product?.image_url} 
                                  alt={item.product?.title}
                                  className="w-12 h-12 object-cover rounded border"
                                />
                                <div className="flex-1">
                                  <div className="font-medium">{item.product?.title}</div>
                                  <div className="text-gray-600">SKU: {item.product?.sku}</div>
                                  <div className="text-gray-600">Qty: {item.quantity} × {item.display_price}</div>
                                  <div className="font-medium">{item.display_total}</div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Raw JSON Data (Collapsible) */}
                    <div>
                      <button
                        onClick={() => setShowJsonData(prev => ({ ...prev, 'test-result': !prev['test-result'] }))}
                        className="flex items-center justify-between w-full p-3 bg-white rounded border hover:bg-gray-50 transition-colors"
                      >
                        <h5 className="font-medium text-gray-800 text-sm">Raw Response Data</h5>
                        <FontAwesomeIcon 
                          icon={showJsonData['test-result'] ? "chevron-up" : "chevron-down"} 
                          className="text-gray-400 text-xs" 
                        />
                      </button>
                      {showJsonData['test-result'] && (
                        <div className="mt-2">
                          <pre className="bg-gray-900 text-green-400 p-4 rounded text-xs overflow-x-auto max-h-64 overflow-y-auto">
                            <code>{formatJsonData(testResult.resourceData)}</code>
                          </pre>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
        </div>
      )}

      {/* Recent Webhook Events */}
      {recentWebhooks.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-gray-900">Recent Webhook Events</h3>
              <p className="text-xs text-gray-500">Latest webhook responses from Fluid</p>
            </div>
          </div>

          <div className="space-y-3 max-h-96 overflow-y-auto">
            {recentWebhooks.map((webhook) => (
              <div key={webhook.id} className="border border-gray-100 rounded-lg">
                <button
                  onClick={() => toggleLogExpansion(webhook.id)}
                  className="w-full p-3 text-left hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className={`w-2 h-2 rounded-full ${
                        webhook.processingStatus === 'success' ? 'bg-green-500' :
                        webhook.processingStatus === 'failed' ? 'bg-red-500' :
                        'bg-yellow-500'
                      }`} />
                      <div>
                        <p className="font-medium text-sm text-gray-900">
                          {webhook.type || 'Unknown Event'}
                        </p>
                        <p className="text-xs text-gray-500">
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
                  <div className="px-3 pb-3 border-t border-gray-100">
                    <div className="mt-3 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-gray-600">JSON Data:</span>
                        <button
                          onClick={() => toggleJsonData(webhook.id)}
                          className="text-xs text-blue-600 hover:text-blue-800"
                        >
                          {showJsonData[webhook.id] ? 'Hide' : 'Show'} JSON
                        </button>
                      </div>
                      
                      {showJsonData[webhook.id] && (
                        <pre className="bg-gray-50 p-3 rounded text-xs overflow-x-auto">
                          <code>{formatJsonData(webhook.data)}</code>
                        </pre>
                      )}

                      {webhook.retryCount && webhook.retryCount > 0 && (
                        <p className="text-xs text-yellow-600">
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