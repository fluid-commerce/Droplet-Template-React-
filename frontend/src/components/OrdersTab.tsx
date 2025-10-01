import { useState, useEffect } from 'react'
import { apiClient } from '../lib/api'

interface Order {
  id: string
  fluidOrderId: string
  orderNumber?: string
  amount?: string
  status?: string
  customerEmail?: string
  customerName?: string
  itemsCount?: number
  orderData?: any
  createdAt: string
  updatedAt: string
}

interface OrdersResponse {
  success: boolean
  data: {
    orders: Order[]
    installation: {
      id: string
      companyName: string
    }
  }
}

interface SyncResponse {
  success: boolean
  data: {
    message: string
    synced: number
    errors: number
    installation: {
      id: string
      companyName: string
    }
  }
}


interface OrdersTabProps {
  installationId: string
  brandGuidelines?: {
    color?: string
    secondary_color?: string
  }
  onSyncMessage: (message: string | null) => void
}

export function OrdersTab({ installationId, brandGuidelines, onSyncMessage }: OrdersTabProps) {
  const [orders, setOrders] = useState<Order[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSyncingOrders, setIsSyncingOrders] = useState(false)
  const [isTestingWebhook, setIsTestingWebhook] = useState(false)
  const [webhookResponse, setWebhookResponse] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [searchQuery, setSearchQuery] = useState('')
  const itemsPerPage = 10

  // Helper function to format colors
  const formatColor = (color: string | null | undefined) => {
    if (!color) return undefined
    return color.startsWith('#') ? color : `#${color}`
  }

  // Fetch products to get images for order items
  const fetchProducts = async () => {
    try {
      const response = await apiClient.get(`/api/products/${installationId}`)
      if (response.data.success) {
        setProducts(response.data.data.products)
      }
    } catch (err) {
      console.error('Error fetching products:', err)
    }
  }

  // Helper function to find product image by title match
  const getProductImage = (itemTitle: string) => {
    const product = products.find(p => 
      p.title.toLowerCase().trim() === itemTitle.toLowerCase().trim()
    )
    return product?.imageUrl || null
  }

  // Fetch orders from our database
  const fetchOrders = async () => {
    try {
      setIsLoading(true)
      setError(null)
      const response = await apiClient.get<OrdersResponse>(`/api/orders/${installationId}`)
      if (response.data.success) {
        setOrders(response.data.data.orders)
      } else {
        setError('Failed to fetch orders')
      }
    } catch (err: any) {
      console.error('Error fetching orders:', err)
      setError(err.response?.data?.message || 'Failed to fetch orders')
    } finally {
      setIsLoading(false)
    }
  }

  // Sync orders from Fluid
  const syncOrders = async () => {
    try {
      setIsSyncingOrders(true)
      setError(null)
      onSyncMessage(null)

      const response = await apiClient.post<SyncResponse>(`/api/orders/${installationId}/sync`)
      const data = response.data

      if (data.success) {
        onSyncMessage(`Successfully synced ${data.data.synced} orders from Fluid`)
        await fetchOrders() // Refresh orders after sync
      } else {
        setError('Failed to sync orders')
      }
    } catch (err: any) {
      console.error('Error syncing orders:', err)
      setError(err.response?.data?.message || 'Failed to sync orders from Fluid')
    } finally {
      setIsSyncingOrders(false)
    }
  }

  // Test webhook by creating a test order in Fluid
  const testWebhook = async () => {
    try {
      setIsTestingWebhook(true)
      setError(null)
      setWebhookResponse(null)
      onSyncMessage(null)

      const response = await apiClient.post(`/api/test-webhook/${installationId}`)
      const data = response.data

      if (data.success) {
        setWebhookResponse(data.data)
        onSyncMessage('Test order created! Check the response below and your webhook logs.')
        // Refresh orders after a short delay to give webhook time to process
        setTimeout(() => fetchOrders(), 2000)
      } else {
        setError('Failed to create test order')
      }
    } catch (err: any) {
      console.error('Error testing webhook:', err)
      setError(err.response?.data?.message || 'Failed to create test webhook order')
      if (err.response?.data?.debug) {
        setWebhookResponse(err.response.data.debug)
      }
    } finally {
      setIsTestingWebhook(false)
    }
  }



  // Filter and paginate orders
  const filteredOrders = orders.filter(order =>
    (order.orderNumber && order.orderNumber.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (order.customerEmail && order.customerEmail.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (order.customerName && order.customerName.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (order.status && order.status.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  const totalPages = Math.ceil(filteredOrders.length / itemsPerPage)
  const getCurrentOrders = () => {
    const startIndex = (currentPage - 1) * itemsPerPage
    const endIndex = startIndex + itemsPerPage
    return filteredOrders.slice(startIndex, endIndex)
  }

  // Initialize
  useEffect(() => {
    if (installationId) {
      fetchOrders()
      fetchProducts()
    }
  }, [installationId])

  // Reset page when search changes
  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-gray-600">Loading orders...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="flex-1 max-w-md">
          <input
            type="text"
            placeholder="Search orders..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={syncOrders}
            disabled={isSyncingOrders}
            className="inline-flex items-center px-4 py-2 text-white text-sm font-medium rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              backgroundColor: brandGuidelines?.color
                ? formatColor(brandGuidelines.color)
                : '#3b82f6'
            }}
          >
            {isSyncingOrders ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                Syncing...
              </>
            ) : (
              <>
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Sync Orders
              </>
            )}
          </button>
          <button
            onClick={testWebhook}
            disabled={isTestingWebhook}
            className="inline-flex items-center px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isTestingWebhook ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                Creating Order...
              </>
            ) : (
              <>
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Test Webhook
              </>
            )}
          </button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center">
            <svg className="w-5 h-5 text-red-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-red-800 text-sm">{error}</span>
          </div>
        </div>
      )}

      {/* Webhook Response Display */}
      {webhookResponse && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg overflow-hidden">
          <div className="bg-green-600 text-white px-4 py-3 flex items-center justify-between">
            <div className="flex items-center">
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="font-medium">Test Order Created Successfully</span>
            </div>
            <button
              onClick={() => setWebhookResponse(null)}
              className="text-white hover:text-gray-200 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="p-4">
            <p className="text-sm text-gray-700 mb-3">
              Your webhook endpoint should have received an order event. Check your backend logs for the incoming webhook data.
            </p>
            <details className="group">
              <summary className="cursor-pointer text-sm font-medium text-gray-700 hover:text-gray-900 flex items-center">
                <svg className="w-4 h-4 mr-1 group-open:rotate-90 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                View Full Response JSON
              </summary>
              <div className="mt-3 bg-gray-900 rounded-lg p-4 overflow-x-auto">
                <pre className="text-green-400 text-xs font-mono">
                  {JSON.stringify(webhookResponse, null, 2)}
                </pre>
              </div>
            </details>
          </div>
        </div>
      )}

      {/* Orders Count */}
      <div className="flex items-center justify-between text-sm text-gray-600">
        <span>
          {filteredOrders.length === orders.length
            ? `${orders.length} orders`
            : `${filteredOrders.length} of ${orders.length} orders`
          }
        </span>
        {totalPages > 1 && (
          <span>
            Page {currentPage} of {totalPages}
          </span>
        )}
      </div>

      {/* Orders Table */}
      {filteredOrders.length > 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Order
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Customer
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Items
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {getCurrentOrders().map((order) => (
                  <tr key={order.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {order.orderNumber || `#${order.fluidOrderId}`}
                      </div>
                      <div className="text-sm text-gray-500">
                        {new Date(order.createdAt).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {order.customerName || 'Anonymous'}
                      </div>
                      {order.customerEmail && (
                        <div className="text-sm text-gray-500">
                          {order.customerEmail}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {order.amount || '—'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          order.status === 'completed' || order.status === 'paid'
                            ? 'bg-green-100 text-green-800'
                            : order.status === 'pending'
                            ? 'bg-yellow-100 text-yellow-800'
                            : order.status === 'cancelled'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {order.status || 'unknown'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {order.orderData?.items ? (
                        <div className="space-y-2">
                          {order.orderData.items.slice(0, 2).map((item: any, index: number) => {
                            const productImage = getProductImage(item.title)
                            return (
                              <div key={index} className="flex items-center space-x-2">
                                <div className="flex-shrink-0 h-6 w-6">
                                  {productImage ? (
                                    <img
                                      className="h-6 w-6 rounded object-cover"
                                      src={productImage}
                                      alt={item.title || 'Product'}
                                      onError={(e) => {
                                        e.currentTarget.style.display = 'none'
                                        const nextElement = e.currentTarget.nextElementSibling as HTMLElement
                                        if (nextElement) {
                                          nextElement.style.display = 'flex'
                                        }
                                      }}
                                    />
                                  ) : null}
                                  <div
                                    className="h-6 w-6 rounded bg-gray-100 flex items-center justify-center"
                                    style={{ display: productImage ? 'none' : 'flex' }}
                                  >
                                    <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                                    </svg>
                                  </div>
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="text-xs text-gray-900 truncate">
                                    {item.title || 'Unknown Product'}
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    {item.price_in_currency} {item.quantity > 1 && `× ${item.quantity}`}
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                          {order.orderData.items.length > 2 && (
                            <div className="text-xs text-gray-400 pl-8">
                              +{order.orderData.items.length - 2} more items
                            </div>
                          )}
                        </div>
                      ) : order.itemsCount ? (
                        `${order.itemsCount} items`
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-6 py-3 border-t border-gray-200 bg-gray-50">
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <span className="text-sm text-gray-700">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No orders yet</h3>
          <p className="text-gray-600">
            Use the sync button above to sync orders from Fluid
          </p>
        </div>
      )}
    </div>
  )
}