import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Card, CardContent } from '@/components/Card'
import { Button } from '@/components/Button'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { apiClient } from '@/lib/api'

export function DropletUninstall() {
  const [searchParams] = useSearchParams()
  const installationId = searchParams.get('installation_id')
  const fluidApiKey = searchParams.get('fluid_api_key')
  
  const [isUninstalling, setIsUninstalling] = useState(false)
  const [uninstallComplete, setUninstallComplete] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Auto-uninstall on page load
  useEffect(() => {
    if (installationId && fluidApiKey && !uninstallComplete && !isUninstalling) {
      handleUninstall()
    }
  }, [installationId, fluidApiKey])

  const handleUninstall = async () => {
    if (!installationId || !fluidApiKey) {
      setError('Missing installation ID or API key')
      return
    }

    setIsUninstalling(true)
    setError(null)

    try {
      // Clear all local storage data for this installation
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('droplet_session_') || key.includes(installationId)) {
          localStorage.removeItem(key)
        }
      })

      // Call manual uninstall endpoint
      await apiClient.post('/api/droplet/uninstall', {
        installationId,
        fluidApiKey
      })

      setUninstallComplete(true)
    } catch (err: any) {
      console.error('Uninstall error:', err)
      setError(err.response?.data?.message || 'Failed to uninstall droplet')
    } finally {
      setIsUninstalling(false)
    }
  }

  if (uninstallComplete) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center p-4">
        <Card className="max-w-md mx-auto w-full">
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <FontAwesomeIcon icon="check-circle" className="text-2xl text-green-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">Uninstall Complete</h2>
            <p className="text-gray-600 mb-6 leading-relaxed">
              The droplet has been successfully uninstalled and all data has been removed.
            </p>
            <div className="space-y-3">
              <Button 
                onClick={() => {
                  // Try to get droplet ID from URL params or environment
                  const dropletId = searchParams.get('droplet_id') || 
                                  searchParams.get('droplet_uuid') ||
                                  process.env.REACT_APP_DROPLET_ID ||
                                  'your-droplet-id'
                  
                  // Redirect to Fluid droplet details page
                  if (dropletId && dropletId !== 'your-droplet-id') {
                    window.location.href = `https://fluid.app/droplets/${dropletId}`
                  } else {
                    // Fallback to Fluid marketplace if no droplet ID
                    window.location.href = 'https://fluid.app/marketplace'
                  }
                }} 
                className="w-full"
              >
                <FontAwesomeIcon icon="external-link-alt" className="mr-2" />
                View Droplet Details
              </Button>
              <Button 
                onClick={() => window.close()} 
                variant="outline"
                className="w-full"
              >
                <FontAwesomeIcon icon="times" className="mr-2" />
                Close Window
              </Button>
            </div>
          </CardContent>
        </Card>
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
            <h2 className="text-xl font-semibold text-gray-900 mb-3">Uninstall Failed</h2>
            <p className="text-gray-600 mb-6 leading-relaxed">{error}</p>
            <div className="space-y-3">
              <Button onClick={handleUninstall} className="w-full" disabled={isUninstalling}>
                <FontAwesomeIcon icon="refresh" className="mr-2" />
                Retry Uninstall
              </Button>
              <Button 
                onClick={() => {
                  // Try to get droplet ID from URL params or environment
                  const dropletId = searchParams.get('droplet_id') || 
                                  searchParams.get('droplet_uuid') ||
                                  process.env.REACT_APP_DROPLET_ID ||
                                  'your-droplet-id'
                  
                  // Redirect to Fluid droplet details page
                  if (dropletId && dropletId !== 'your-droplet-id') {
                    window.location.href = `https://fluid.app/droplets/${dropletId}`
                  } else {
                    // Fallback to Fluid marketplace if no droplet ID
                    window.location.href = 'https://fluid.app/marketplace'
                  }
                }} 
                variant="outline"
                className="w-full"
              >
                <FontAwesomeIcon icon="external-link-alt" className="mr-2" />
                Return to Droplet
              </Button>
              <Button 
                onClick={() => window.close()} 
                variant="outline"
                className="w-full"
              >
                Close Window
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center p-4">
      <Card className="max-w-md mx-auto w-full">
        <CardContent className="p-8 text-center">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <FontAwesomeIcon icon="spinner" className="text-2xl text-blue-600 animate-spin" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">Uninstalling Droplet</h2>
          <p className="text-gray-600 leading-relaxed">
            Please wait while we remove the droplet and clean up your data...
          </p>
        </CardContent>
      </Card>
    </div>
  )
}