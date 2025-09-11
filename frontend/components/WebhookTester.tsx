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
        testData: {
          customer_name: 'Test Customer from Dashboard',
          total: 149.99,
          currency: 'USD'
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
      {/* Webhook Testing Section */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-gray-900">Webhook Testing</h3>
            <p className="text-xs text-gray-500">Test webhook creation and responses</p>
          </div>
        </div>

        <div className="space-y-3">
          <Button
            onClick={() => handleTestWebhook('order.created')}
            loading={isLoading}
            disabled={isLoading}
            className="w-full justify-start"
          >
            <FontAwesomeIcon icon="play" className="mr-2" />
            Test Order Created Webhook
          </Button>

          {testResult && (
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