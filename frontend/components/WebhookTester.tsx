import { useState } from 'react'
import { Button } from '@/components/Button'
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
  orderId?: string
  orderData?: any
  error?: string
  details?: any
  createdAt: string
}

interface WebhookTesterProps {
  installationId: string | null
  fluidApiKey: string | null
}

export function WebhookTester({ installationId, fluidApiKey }: WebhookTesterProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [testResult, setTestResult] = useState<WebhookTestResult | null>(null)
  const [recentWebhooks, setRecentWebhooks] = useState<WebhookEvent[]>([])
  const [expandedLogs, setExpandedLogs] = useState<{ [key: string]: boolean }>({})
  const [showJsonData, setShowJsonData] = useState<{ [key: string]: boolean }>({})

  const handleTestWebhook = async (webhookType: string = 'order.created') => {
    if (!installationId || !fluidApiKey) {
      alert('Missing installation ID or API key')
      return
    }

    setIsLoading(true)
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
      setIsLoading(false)
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

  return (
    <div className="space-y-4">
      {/* API-style Webhook Testing Section */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="border-b border-gray-100">
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center space-x-3">
              <span className="font-semibold text-gray-900">Create Order</span>
              <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-700 rounded">POST</span>
            </div>
            <Button
              onClick={() => handleTestWebhook('order.created')}
              loading={isLoading}
              disabled={isLoading}
              size="sm"
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              Test
            </Button>
          </div>
        </div>

        <div className="p-4">
          {testResult && (
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
                
                {testResult.success && testResult.orderId && (
                  <p className="text-xs text-green-700 mb-2">
                    Order ID: {testResult.orderId}
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
              {testResult.success && testResult.orderData && (
                <div className="bg-gray-50 rounded-lg border border-gray-200">
                  <div className="p-4 border-b border-gray-200">
                    <h4 className="font-semibold text-gray-900 text-sm flex items-center">
                      <FontAwesomeIcon icon="file-alt" className="mr-2 text-gray-600" />
                      Detailed Logs
                    </h4>
                  </div>
                  <div className="p-4 space-y-4">
                    {/* Order Summary */}
                    <div>
                      <h5 className="font-medium text-gray-800 text-sm mb-2">Order Summary</h5>
                      <div className="bg-white p-3 rounded border text-xs space-y-1">
                        <div><strong>Order Number:</strong> {testResult.orderData.order_number}</div>
                        <div><strong>Status:</strong> {testResult.orderData.friendly_status}</div>
                        <div><strong>Amount:</strong> {testResult.orderData.display_amount}</div>
                        <div><strong>Customer:</strong> {testResult.orderData.first_name} {testResult.orderData.last_name}</div>
                        <div><strong>Email:</strong> {testResult.orderData.email}</div>
                        <div><strong>Created:</strong> {new Date(testResult.orderData.created_at).toLocaleString()}</div>
                      </div>
                    </div>

                    {/* Shipping Address */}
                    {testResult.orderData.ship_to && (
                      <div>
                        <h5 className="font-medium text-gray-800 text-sm mb-2">Shipping Address</h5>
                        <div className="bg-white p-3 rounded border text-xs">
                          <div>{testResult.orderData.ship_to.address1}</div>
                          {testResult.orderData.ship_to.address2 && <div>{testResult.orderData.ship_to.address2}</div>}
                          <div>{testResult.orderData.ship_to.city}, {testResult.orderData.ship_to.state} {testResult.orderData.ship_to.postal_code}</div>
                        </div>
                      </div>
                    )}

                    {/* Order Items */}
                    {testResult.orderData.items && testResult.orderData.items.length > 0 && (
                      <div>
                        <h5 className="font-medium text-gray-800 text-sm mb-2">Order Items</h5>
                        <div className="bg-white rounded border overflow-hidden">
                          {testResult.orderData.items.map((item: any, index: number) => (
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
                            <code>{formatJsonData(testResult.orderData)}</code>
                          </pre>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

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