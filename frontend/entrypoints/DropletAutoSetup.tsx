import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { Card, CardContent } from '@/components/Card'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { apiClient } from '@/lib/api'

export function DropletAutoSetup() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const installationId = searchParams.get('installation_id')
  const companyId = searchParams.get('company_id')
  const authToken = searchParams.get('authToken') || searchParams.get('auth_token') || searchParams.get('fluid_api_key')
  const dri = searchParams.get('dri')
  
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const checkInstallationStatus = async () => {
      try {
        // Checking installation status
        
        // Clear any old session data for new installations
        if (installationId === 'new-installation' || !installationId) {
          // Clear all droplet session data to ensure fresh start
          Object.keys(localStorage).forEach(key => {
            if (key.startsWith('droplet_session_')) {
              localStorage.removeItem(key)
            }
          })
        }

        // Check if we already have a valid session in localStorage for this specific auth token
        const sessionKey = `droplet_session_${authToken}`
        const existingSession = localStorage.getItem(sessionKey)
        if (existingSession) {
          try {
            const sessionData = JSON.parse(existingSession)
            const sessionAge = Date.now() - new Date(sessionData.timestamp).getTime()
            const maxAge = 24 * 60 * 60 * 1000 // 24 hours
            
            if (sessionAge < maxAge && sessionData.installationId && sessionData.installationId !== 'new-installation') {
              // Redirect directly to dashboard for existing installations
              navigate(`/dashboard?installation_id=${sessionData.installationId}&fluid_api_key=${sessionData.fluidApiKey}`)
              return
            }
          } catch (e) {
            // Invalid session data, continue with normal flow
            localStorage.removeItem(sessionKey)
          }
        }

        // If we have installation_id and fluid_api_key in URL, go directly to dashboard
        if (installationId && installationId !== 'new-installation' && authToken) {
          navigate(`/dashboard?installation_id=${installationId}&fluid_api_key=${authToken}`)
          return
        }

        // If we have any installation ID that's not 'new-installation', don't run auto-setup
        if (installationId && installationId !== 'new-installation') {
          navigate(`/dashboard?installation_id=${installationId}&fluid_api_key=${authToken || 'unknown'}`)
          return
        }

        // Check if we have a valid authToken but no installation_id - this might be a returning user
        if (authToken && !installationId) {
          // Try to find any existing session for this auth token
          const allSessionKeys = Object.keys(localStorage).filter(key => key.startsWith('droplet_session_'))
          for (const key of allSessionKeys) {
            try {
              const sessionData = JSON.parse(localStorage.getItem(key) || '{}')
              if (sessionData.fluidApiKey === authToken && sessionData.installationId && sessionData.installationId !== 'new-installation') {
                const sessionAge = Date.now() - new Date(sessionData.timestamp).getTime()
                const maxAge = 24 * 60 * 60 * 1000 // 24 hours
                if (sessionAge < maxAge) {
                  navigate(`/dashboard?installation_id=${sessionData.installationId}&fluid_api_key=${sessionData.fluidApiKey}`)
                  return
                }
              }
            } catch (e) {
              // Invalid session data, continue
            }
          }
        }

        // Use DRI as installation ID if no installation_id is provided
        const effectiveInstallationId = installationId || dri || 'new-installation'
        
        // Only run auto-setup if we have the necessary parameters for a new installation
        if (!authToken && !dri) {
          setError('Missing required parameters for installation. Please install the droplet from Fluid.')
          return
        }

        // Check if we have a webhook-configured installation
        const statusResponse = await apiClient.get(`/api/droplet/status/${effectiveInstallationId}`)
        
        // If we get a successful response with an active installation, redirect immediately to dashboard
        if (statusResponse.data.success && statusResponse.data.data?.status === 'active') {
          const data = statusResponse.data.data
          
          // Save session data
          const sessionData = {
            installationId: data.installationId,
            fluidApiKey: data.fluidApiKey || authToken,
            companyName: data.companyName,
            integrationName: data.integrationName || `${data.companyName} Integration`,
            timestamp: new Date().toISOString()
          }
          localStorage.setItem(`droplet_session_${data.fluidApiKey || authToken}`, JSON.stringify(sessionData))
          
          // Redirect immediately to dashboard for active installations
          navigate(`/dashboard?installation_id=${data.installationId}&fluid_api_key=${data.fluidApiKey || authToken}`)
          return
        }
        
        if (statusResponse.data.success) {
          const data = statusResponse.data.data
          
          // Check if installation is already fully configured (active status) - this should have been caught above but double-check
          if (data.status === 'active' && data.companyName && data.companyName !== 'Your Company') {
            // Save session data
            const sessionData = {
              installationId: data.installationId,
              fluidApiKey: data.fluidApiKey || authToken,
              companyName: data.companyName,
              integrationName: data.integrationName,
              timestamp: new Date().toISOString()
            }
            localStorage.setItem(`droplet_session_${data.fluidApiKey || authToken}`, JSON.stringify(sessionData))
            
            // Redirect immediately to dashboard for returning users
            navigate(`/dashboard?installation_id=${data.installationId}&fluid_api_key=${data.fluidApiKey || authToken}`)
            return
          }
          
          // If we have any installation data but it's not active, don't auto-configure
          if (data.installationId && data.installationId !== 'new-installation') {
            setError('Installation is being processed. Please wait a moment and refresh the page.')
            return
          }
          
          // Check if we have webhook data waiting to be configured (pending status) OR auto-configure if we have company data
          if (data.companyName && data.companyName !== 'Your Company') {
            
            // If installation is already active, just redirect to dashboard immediately
            if (data.status === 'active') {
              const sessionData = {
                installationId: data.installationId,
                fluidApiKey: data.fluidApiKey || authToken,
                companyName: data.companyName,
                integrationName: data.integrationName || `${data.companyName} Integration`,
                timestamp: new Date().toISOString()
              }
              localStorage.setItem(`droplet_session_${data.fluidApiKey || authToken}`, JSON.stringify(sessionData))
              
              // Redirect immediately to dashboard
              navigate(`/dashboard?installation_id=${sessionData.installationId}&fluid_api_key=${sessionData.fluidApiKey}`)
              return
            }
            
            // Only auto-configure if we have a real installation ID (not 'new-installation') AND status is pending
            if (data.installationId && data.installationId !== 'new-installation' && data.status === 'pending') {
              // Auto-configure the installation using webhook data (no modal needed)
              const configData = {
                integrationName: data.integrationName || `${data.companyName} Integration`,
                companyName: data.companyName,
                environment: 'production',
                fluidApiKey: data.fluidApiKey || authToken,
                installationId: data.installationId,
                companyId: data.companyId || companyId
              }
              
              const configResponse = await apiClient.post('/api/droplet/configure', configData)
              
              if (configResponse.data.success) {
                // Save session and redirect directly to dashboard
                const sessionData = {
                  installationId: configResponse.data.data?.installationId || data.installationId,
                  fluidApiKey: configData.fluidApiKey,
                  companyName: data.companyName,
                  integrationName: configData.integrationName,
                  timestamp: new Date().toISOString()
                }
                localStorage.setItem(`droplet_session_${configData.fluidApiKey}`, JSON.stringify(sessionData))
                
                // Go directly to dashboard
                navigate(`/dashboard?installation_id=${sessionData.installationId}&fluid_api_key=${configData.fluidApiKey}`)
                return
              }
            } else {
              // If no real installation ID, go directly to dashboard
              const sessionData = {
                installationId: data.installationId || 'new-installation',
                fluidApiKey: data.fluidApiKey || authToken,
                companyName: data.companyName,
                integrationName: data.integrationName || `${data.companyName} Integration`,
                timestamp: new Date().toISOString()
              }
              localStorage.setItem(`droplet_session_${data.fluidApiKey || authToken}`, JSON.stringify(sessionData))
              
              // Go directly to dashboard
              navigate(`/dashboard?installation_id=${sessionData.installationId}&fluid_api_key=${sessionData.fluidApiKey}`)
              return
            }
          }

          // Special case: If we have DRI but no auth token, try to get installation info
          if (dri && !authToken && (!data.companyName || data.companyName === 'Your Company')) {
            setError('Installation requires authentication. Please ensure you are properly logged into Fluid and try installing again.')
            return
          }

          // If we get here, we need to auto-configure a new installation
          
          const configData = {
            integrationName: data.integrationName || `${data.companyName || 'Your Company'} Integration`,
            companyName: data.companyName || 'Your Company',
            environment: 'production',
            fluidApiKey: authToken,
            installationId: effectiveInstallationId,
            companyId: companyId
          }
          
          const configResponse = await apiClient.post('/api/droplet/configure', configData)
          
          if (configResponse.data.success) {
            const sessionData = {
              installationId: configResponse.data.data?.installationId || effectiveInstallationId,
              fluidApiKey: configData.fluidApiKey,
              companyName: configData.companyName,
              integrationName: configData.integrationName,
              timestamp: new Date().toISOString()
            }
            localStorage.setItem(`droplet_session_${configData.fluidApiKey}`, JSON.stringify(sessionData))
            
            // Go directly to dashboard
            navigate(`/dashboard?installation_id=${sessionData.installationId}&fluid_api_key=${configData.fluidApiKey}`)
            return
          } else {
            setError(configResponse.data.message || 'Failed to configure installation')
          }
        } else {
          setError('Failed to check installation status')
        }
      } catch (error: any) {
        console.error('Auto-setup error:', error)
        setError(error.response?.data?.message || error.message || 'An unexpected error occurred during setup')
      }
    }

    checkInstallationStatus()
  }, [installationId, companyId, authToken, navigate])

  // If we have an error, show the error modal
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="max-w-md mx-auto">
          <Card className="group hover:shadow-lg transition-shadow">
            <CardContent className="p-8 text-center">
              <div className="mb-6">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mb-4">
                  <FontAwesomeIcon icon="exclamation-triangle" className="text-2xl text-red-600" />
                </div>
              </div>
              
              <h1 className="text-2xl font-semibold text-gray-900 mb-2">
                Setup Error
              </h1>
              <p className="text-gray-600 mb-6">
                {error}
              </p>
              
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 text-sm font-medium text-red-800 bg-red-100 border border-red-200 rounded hover:bg-red-200 transition-colors"
              >
                <FontAwesomeIcon icon="redo" className="mr-2" />
                Try Again
              </button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  // For all other cases, show a simple loading state that will redirect
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
      <div className="text-center">
        <FontAwesomeIcon icon="spinner" spin className="text-4xl text-blue-600 mb-4" />
        <p className="text-lg text-gray-600">Loading Dashboard...</p>
      </div>
    </div>
  )
}