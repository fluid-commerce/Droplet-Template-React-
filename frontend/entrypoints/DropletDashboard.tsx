import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Button } from '@/components/Button'
import { Card, CardContent } from '@/components/Card'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { apiClient } from '@/lib/api'

interface DashboardData {
  companyName: string
  recentActivity: any[]
}

export function DropletDashboard() {
  const [searchParams] = useSearchParams()
  const installationId = searchParams.get('installation_id')
  const fluidApiKey = searchParams.get('fluid_api_key')
  
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSyncing, setIsSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Collapsible sections state
  const [expandedSections, setExpandedSections] = useState({
    status: true,
    activity: false,
    actions: false
  })

  useEffect(() => {
    const loadDashboardData = async () => {
      if (!installationId) {
        setError('Missing installation ID')
        setIsLoading(false)
        return
      }

      if (!fluidApiKey) {
        setError('Missing Fluid API key')
        setIsLoading(false)
        return
      }

      // Development mode: Use mock data for localhost testing
      const isDevelopment = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      if (isDevelopment && installationId === 'dev-installation-123') {
        setDashboardData({
          companyName: 'Development Company',
          recentActivity: [
            {
              id: '1',
              type: 'configuration',
              message: 'Droplet configured successfully',
              timestamp: new Date().toISOString(),
              status: 'success'
            },
            {
              id: '2', 
              type: 'sync',
              message: 'Data synchronized with Fluid platform',
              timestamp: new Date(Date.now() - 300000).toISOString(),
              status: 'success'
            }
          ]
        })
        setIsLoading(false)
        return
      }

      try {
        const response = await apiClient.get(`/api/droplet/dashboard/${installationId}?fluidApiKey=${fluidApiKey}`)
        setDashboardData(response.data.data)
      } catch (err: any) {
        console.error('Failed to load dashboard data:', err)
        
        // If installation not found (404) or forbidden (403), it was likely uninstalled
        if (err.response?.status === 404 || err.response?.status === 403) {
          // Clear localStorage and redirect to fresh installation
          Object.keys(localStorage).forEach(key => {
            if (key.startsWith('droplet_session_') || key.includes(installationId!)) {
              localStorage.removeItem(key)
            }
          })
          
          // Redirect to installation flow
          window.location.href = '/'
          return
        }
        
        setError(err.response?.data?.message || 'Failed to load dashboard data')
      } finally {
        setIsLoading(false)
      }
    }

    loadDashboardData()
  }, [installationId])

  const handleSyncData = async () => {
    if (!installationId || !fluidApiKey) return
    
    setIsSyncing(true)
    try {
      await apiClient.post('/api/droplet/sync', { 
        installationId, 
        fluidApiKey 
      })
      // Reload dashboard data
      const response = await apiClient.get(`/api/droplet/dashboard/${installationId}?fluidApiKey=${fluidApiKey}`)
      setDashboardData(response.data.data)
    } catch (err: any) {
      console.error('Failed to sync data:', err)
      
      // If installation not found (404) or forbidden (403), it was likely uninstalled
      if (err.response?.status === 404 || err.response?.status === 403) {
        // Clear localStorage and redirect to fresh installation
        Object.keys(localStorage).forEach(key => {
          if (key.startsWith('droplet_session_') || key.includes(installationId!)) {
            localStorage.removeItem(key)
          }
        })
        
        // Redirect to installation flow
        window.location.href = '/'
        return
      }
      
      setError(err.response?.data?.message || 'Failed to sync data')
    } finally {
      setIsSyncing(false)
    }
  }


  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }))
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-6"></div>
            <div className="absolute inset-0 w-16 h-16 border-4 border-transparent border-t-blue-400 rounded-full animate-spin mx-auto" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }}></div>
          </div>
          <h3 className="text-xl font-semibold text-gray-800 mb-2">Loading Dashboard</h3>
          <p className="text-gray-600">Setting up your integration overview...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center p-4">
        <Card className="max-w-md mx-auto w-full">
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <FontAwesomeIcon icon="exclamation-triangle" className="text-2xl text-red-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">Connection Error</h2>
            <p className="text-gray-600 mb-6 leading-relaxed">{error}</p>
            <Button onClick={() => window.location.reload()} className="w-full">
              <FontAwesomeIcon icon="refresh" className="mr-2" />
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Single Modal Container */}
      <div className="max-w-4xl mx-auto p-4 py-6">
        <Card className="overflow-hidden">
          {/* Header Section */}
          <div className="bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-700 text-white p-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold mb-2">
                  {dashboardData?.companyName || 'Your Business'}
                </h1>
                <p className="text-blue-100 text-sm sm:text-base">
                  Integration Dashboard
                </p>
              </div>
              <Button 
                onClick={handleSyncData} 
                variant="outline" 
                loading={isSyncing} 
                disabled={isSyncing}
                className="bg-white/10 border-white/20 text-white hover:bg-white/20 backdrop-blur-sm"
              >
                <FontAwesomeIcon icon="sync" className="mr-2" />
                {isSyncing ? 'Syncing...' : 'Sync Data'}
              </Button>
            </div>
          </div>

          {/* Content Section - Compact with Collapsible Sections */}
          <div className="p-4 sm:p-6 space-y-4">
            {/* Status Overview - Always Visible */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-lg p-3">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                    <FontAwesomeIcon icon="check-circle" className="text-green-600 text-sm" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-600">API</p>
                    <p className="text-sm font-semibold text-green-700">Connected</p>
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-br from-blue-50 to-cyan-50 border border-blue-200 rounded-lg p-3">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                    <FontAwesomeIcon icon="database" className="text-blue-600 text-sm" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-600">Sync</p>
                    <p className="text-sm font-semibold text-blue-700">Active</p>
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-br from-purple-50 to-violet-50 border border-purple-200 rounded-lg p-3">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                    <FontAwesomeIcon icon="project-diagram" className="text-purple-600 text-sm" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-600">Webhooks</p>
                    <p className="text-sm font-semibold text-purple-700">Live</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Recent Activity - Collapsible */}
            <div className="border border-gray-200 rounded-lg">
              <button
                onClick={() => toggleSection('activity')}
                className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                    <FontAwesomeIcon icon="clock" className="text-gray-600 text-sm" />
                  </div>
                  <div className="text-left">
                    <h3 className="font-semibold text-gray-900">Recent Activity</h3>
                    <p className="text-xs text-gray-500">
                      {dashboardData?.recentActivity?.length || 0} events
                    </p>
                  </div>
                </div>
                <FontAwesomeIcon 
                  icon={expandedSections.activity ? "chevron-up" : "chevron-down"} 
                  className="text-gray-400 text-sm" 
                />
              </button>
              
              {expandedSections.activity && (
                <div className="px-4 pb-4 border-t border-gray-100">
                  <div className="space-y-2 mt-4 max-h-64 overflow-y-auto">
                    {dashboardData?.recentActivity?.map((activity, index) => (
                      <div key={index} className="flex items-start space-x-3 p-3 bg-gray-50/50 rounded-lg">
                        <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                          <FontAwesomeIcon icon="info-circle" className="text-blue-600 text-xs" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900">{activity.description}</p>
                          <p className="text-xs text-gray-500">
                            {new Date(activity.timestamp).toLocaleString()}
                          </p>
                          {activity.details && (
                            <p className="text-xs text-gray-600 mt-1 bg-white/60 rounded p-2">
                              {activity.details}
                            </p>
                          )}
                        </div>
                      </div>
                    )) || (
                      <div className="text-center py-8">
                        <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                          <FontAwesomeIcon icon="inbox" className="text-gray-400" />
                        </div>
                        <p className="text-gray-500 text-sm">No activity yet</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Quick Actions - Collapsible */}
            <div className="border border-gray-200 rounded-lg">
              <button
                onClick={() => toggleSection('actions')}
                className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                    <FontAwesomeIcon icon="bolt" className="text-gray-600 text-sm" />
                  </div>
                  <div className="text-left">
                    <h3 className="font-semibold text-gray-900">Quick Actions</h3>
                    <p className="text-xs text-gray-500">Manage your integration</p>
                  </div>
                </div>
                <FontAwesomeIcon 
                  icon={expandedSections.actions ? "chevron-up" : "chevron-down"} 
                  className="text-gray-400 text-sm" 
                />
              </button>
              
              {expandedSections.actions && (
                <div className="px-4 pb-4 border-t border-gray-100">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                <Button 
                  onClick={handleSyncData} 
                  variant="outline"
                  loading={isSyncing} 
                  disabled={isSyncing}
                  className="h-auto p-3 flex flex-col items-start space-y-1"
                >
                      <div className="flex items-center space-x-2">
                        <FontAwesomeIcon icon="sync" className="text-sm" />
                        <span className="font-medium text-sm">Sync Data</span>
                      </div>
                      <span className="text-xs text-gray-500 text-left">Update integration data</span>
                    </Button>
                    
                    <Button 
                      variant="outline" 
                      className="h-auto p-3 flex flex-col items-start space-y-1"
                      onClick={() => window.open('https://fluid.app', '_blank')}
                    >
                      <div className="flex items-center space-x-2">
                        <FontAwesomeIcon icon="external-link-alt" className="text-sm" />
                        <span className="font-medium text-sm">Visit Fluid</span>
                      </div>
                      <span className="text-xs text-gray-500 text-left">Open Fluid platform</span>
                    </Button>

                  </div>
                </div>
              )}
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
