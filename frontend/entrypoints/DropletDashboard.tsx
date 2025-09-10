import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Button } from '@/components/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/Card'
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

      try {
        const response = await apiClient.get(`/api/droplet/dashboard/${installationId}?fluidApiKey=${fluidApiKey}`)
        setDashboardData(response.data.data)
      } catch (err: any) {
        console.error('Failed to load dashboard data:', err)
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
      setError(err.response?.data?.message || 'Failed to sync data')
    } finally {
      setIsSyncing(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <FontAwesomeIcon icon="spinner" spin className="text-4xl text-blue-600 mb-4" />
          <p className="text-lg text-gray-600">Loading your dashboard...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <Card className="max-w-md mx-auto">
          <CardContent className="p-6 text-center">
            <FontAwesomeIcon icon="exclamation-triangle" className="text-4xl text-red-500 mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Dashboard Error</h2>
            <p className="text-gray-600 mb-4">{error}</p>
            <Button onClick={() => window.location.reload()} className="w-full">
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Welcome {dashboardData?.companyName || 'Your Business'}
            </h1>
            <p className="text-gray-600 mt-1">Manage your droplet integration</p>
          </div>
          <div className="flex space-x-3">
            <Button onClick={handleSyncData} variant="outline" loading={isSyncing} disabled={isSyncing}>
              <FontAwesomeIcon icon="sync" className="mr-2" />
              {isSyncing ? 'Syncing...' : 'Sync Data'}
            </Button>
          </div>
        </div>


        {/* Dashboard Content */}
        <div className="space-y-6">
          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>Latest updates from your integration</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {dashboardData?.recentActivity?.map((activity, index) => (
                  <div key={index} className="flex items-start space-x-3 p-4 bg-gray-50 rounded-lg">
                    <div className="p-2 bg-blue-100 rounded-full">
                      <FontAwesomeIcon icon="info-circle" className="text-blue-600 text-sm" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">{activity.description}</p>
                      <p className="text-xs text-gray-500 mt-1">{new Date(activity.timestamp).toLocaleString()}</p>
                      {activity.details && (
                        <p className="text-xs text-gray-600 mt-1">{activity.details}</p>
                      )}
                    </div>
                  </div>
                )) || (
                  <p className="text-gray-500 text-center py-8">No activity logged yet</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Integration Health */}
          <Card>
            <CardHeader>
              <CardTitle>Integration Health</CardTitle>
              <CardDescription>Status of your droplet connection</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-600">API Connection</span>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    <FontAwesomeIcon icon="check" className="mr-1" />
                    Healthy
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-600">Data Sync</span>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    <FontAwesomeIcon icon="check" className="mr-1" />
                    Up to Date
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-600">Webhooks</span>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    <FontAwesomeIcon icon="check" className="mr-1" />
                    Active
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
