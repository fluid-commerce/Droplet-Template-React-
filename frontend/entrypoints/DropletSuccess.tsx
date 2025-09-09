import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Button } from '@/components/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/Card'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { apiClient } from '@/lib/api'

interface ConnectionStatus {
  connected: boolean
  companyName: string
  companyId: string
  lastSync: string
  userCount: number
  installationId: string
}

export function DropletSuccess() {
  const [searchParams] = useSearchParams()
  const installationId = searchParams.get('installation_id')
  
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadConnectionStatus = async () => {
      if (!installationId) {
        setError('Missing installation ID')
        setIsLoading(false)
        return
      }

       // For new installations, show success without checking backend status
      if (installationId === 'new-installation') {
        setConnectionStatus({
          connected: true,
          installationId: 'new-installation',
          companyName: 'Your Company',
          companyId: 'new-company',
          lastSync: new Date().toISOString(),
          userCount: 0
        })
        setIsLoading(false)
        return
      }

      try {
        const response = await apiClient.get(`/api/droplet/status/${installationId}`)
        setConnectionStatus(response.data.data)
      } catch (err: any) {
        console.error('Failed to load connection status:', err)
        setError(err.response?.data?.message || 'Failed to load connection status')
      } finally {
        setIsLoading(false)
      }
    }

    loadConnectionStatus()
  }, [installationId])

  const handleDisconnect = async () => {
    if (!installationId) return
    
    try {
      await apiClient.post('/api/droplet/disconnect', { installationId })
      setConnectionStatus(prev => prev ? { ...prev, connected: false } : null)
    } catch (err: any) {
      console.error('Failed to disconnect:', err)
      setError(err.response?.data?.message || 'Failed to disconnect')
    }
  }

  const handleReconnect = () => {
    window.location.href = `/?installation_id=${installationId}`
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <FontAwesomeIcon icon="spinner" spin className="text-4xl text-blue-600 mb-4" />
          <p className="text-lg text-gray-600">Loading connection status...</p>
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
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Connection Error</h2>
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
            <FontAwesomeIcon icon="check-circle" className="text-3xl text-green-600" />
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            {connectionStatus?.connected ? 'Successfully Connected!' : 'Connection Required'}
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            {connectionStatus?.connected 
              ? `Your droplet is now connected to ${connectionStatus.companyName}`
              : 'Please complete the connection process to continue'
            }
          </p>
        </div>

        {/* Connection Status Card */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center text-lg">
              <FontAwesomeIcon 
                icon={connectionStatus?.connected ? "check-circle" : "times-circle"} 
                className={`mr-3 h-5 w-5 ${connectionStatus?.connected ? 'text-green-600' : 'text-red-600'}`} 
              />
              Connection Status
            </CardTitle>
            <CardDescription>
              Current status of your droplet integration
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-500">Status</label>
                <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                  connectionStatus?.connected 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-red-100 text-red-800'
                }`}>
                  <FontAwesomeIcon 
                    icon={connectionStatus?.connected ? "check" : "times"} 
                    className="mr-1 h-3 w-3" 
                  />
                  {connectionStatus?.connected ? 'Connected' : 'Not Connected'}
                </div>
              </div>
              
              <div>
                <label className="text-sm font-medium text-gray-500">Company</label>
                <p className="text-sm text-gray-900">{connectionStatus?.companyName || 'Unknown'}</p>
              </div>
              
              <div>
                <label className="text-sm font-medium text-gray-500">Company ID</label>
                <p className="text-sm text-gray-900 font-mono">{connectionStatus?.companyId || 'N/A'}</p>
              </div>
              
              <div>
                <label className="text-sm font-medium text-gray-500">Last Sync</label>
                <p className="text-sm text-gray-900">
                  {connectionStatus?.lastSync 
                    ? new Date(connectionStatus.lastSync).toLocaleString()
                    : 'Never'
                  }
                </p>
              </div>
            </div>

            {connectionStatus?.connected && (
              <div className="pt-4 border-t">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-500">Users Connected</span>
                  <span className="text-lg font-semibold text-gray-900">
                    {connectionStatus.userCount || 0}
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex justify-center space-x-4">
          {connectionStatus?.connected ? (
            <>
              <Button 
                onClick={() => window.location.href = `/dashboard?installation_id=${installationId}`}
                className="px-8"
              >
                <FontAwesomeIcon icon="tachometer-alt" className="mr-2" />
                View Dashboard
              </Button>
              <Button 
                onClick={handleDisconnect}
                variant="outline"
                className="px-8"
              >
                <FontAwesomeIcon icon="unlink" className="mr-2" />
                Disconnect
              </Button>
            </>
          ) : (
            <Button 
              onClick={handleReconnect}
              className="px-8"
            >
              <FontAwesomeIcon icon="link" className="mr-2" />
              Connect Now
            </Button>
          )}
        </div>

        {/* Quick Stats */}
        {connectionStatus?.connected && (
          <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardContent className="p-6 text-center">
                <FontAwesomeIcon icon="users" className="text-3xl text-blue-600 mb-3" />
                <h3 className="text-2xl font-bold text-gray-900">{connectionStatus.userCount || 0}</h3>
                <p className="text-sm text-gray-600">Active Users</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-6 text-center">
                <FontAwesomeIcon icon="sync" className="text-3xl text-green-600 mb-3" />
                <h3 className="text-2xl font-bold text-gray-900">Live</h3>
                <p className="text-sm text-gray-600">Sync Status</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-6 text-center">
                <FontAwesomeIcon icon="shield-alt" className="text-3xl text-purple-600 mb-3" />
                <h3 className="text-2xl font-bold text-gray-900">Secure</h3>
                <p className="text-sm text-gray-600">Connection</p>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}
