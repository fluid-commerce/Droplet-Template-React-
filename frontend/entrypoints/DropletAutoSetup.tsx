import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { apiClient } from '@/lib/api'

export function DropletAutoSetup() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const installationId = searchParams.get('installation_id')
  const companyId = searchParams.get('company_id')
  const dri = searchParams.get('dri') // Fluid Droplet Resource Identifier
  const authToken = searchParams.get('auth_token') || 
                   searchParams.get('token') || 
                   searchParams.get('fluid_api_key') ||
                   searchParams.get('api_key') ||
                   searchParams.get('access_token') ||
                   searchParams.get('authToken') ||
                   searchParams.get('fluidApiKey') ||
                   searchParams.get('apiKey') ||
                   searchParams.get('accessToken')
  
  const [status, setStatus] = useState<'checking' | 'auto_configuring' | 'error' | 'complete'>('checking')
  const [companyData, setCompanyData] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [loadingText, setLoadingText] = useState('Initializing...')

  useEffect(() => {
    const checkInstallationStatus = async () => {
      try {
        setStatus('checking')
        setLoadingText('Checking installation status...')
        
        // URL parameters processed

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
          setStatus('error')
          return
        }

        // First, check if we have a webhook-configured installation
        setLoadingText('Connecting to Fluid platform...')
        
        // Add a smooth delay to make the connection feel more natural
        await new Promise(resolve => setTimeout(resolve, 4000))
        
        const statusResponse = await apiClient.get(`/api/droplet/status/${effectiveInstallationId}`)
        
        // If we get a successful response with an active installation, redirect immediately to dashboard
        if (statusResponse.data.success && statusResponse.data.data?.status === 'active') {
          const data = statusResponse.data.data
          setLoadingText('Installation found! Redirecting to dashboard...')
          
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
            setStatus('error')
            return
          }
          
          // Check if we have webhook data waiting to be configured (pending status) OR auto-configure if we have company data
          if (data.companyName && data.companyName !== 'Your Company') {
            setCompanyData(data)
            
            // If installation is already active, just redirect to dashboard
            if (data.status === 'active') {
              setStatus('complete')
              
              const sessionData = {
                installationId: data.installationId,
                fluidApiKey: data.fluidApiKey || authToken,
                companyName: data.companyName,
                integrationName: data.integrationName || `${data.companyName} Integration`,
                timestamp: new Date().toISOString()
              }
              localStorage.setItem(`droplet_session_${data.fluidApiKey || authToken}`, JSON.stringify(sessionData))
              
              setTimeout(() => {
                navigate(`/dashboard?installation_id=${sessionData.installationId}&fluid_api_key=${sessionData.fluidApiKey}`)
              }, 1000)
              return
            }
            
            // Only auto-configure if we have a real installation ID (not 'new-installation') AND status is pending
            if (data.installationId && data.installationId !== 'new-installation' && data.status === 'pending') {
              setLoadingText('Configuring your integration...')
              setStatus('auto_configuring')
              // Auto-configure the installation using webhook data
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
                setStatus('complete')
                
                // Save session and redirect to success
                const sessionData = {
                  installationId: configResponse.data.data?.installationId || data.installationId,
                  fluidApiKey: configData.fluidApiKey,
                  companyName: data.companyName,
                  integrationName: configData.integrationName,
                  timestamp: new Date().toISOString()
                }
                localStorage.setItem(`droplet_session_${configData.fluidApiKey}`, JSON.stringify(sessionData))
                
                setTimeout(() => {
                  navigate(`/success?installation_id=${sessionData.installationId}&fluid_api_key=${configData.fluidApiKey}`)
                }, 2000)
                return
              }
            } else {
              // If no real installation ID, just redirect to success with the data we have
              setStatus('complete')
              
              const sessionData = {
                installationId: data.installationId || 'new-installation',
                fluidApiKey: data.fluidApiKey || authToken,
                companyName: data.companyName,
                integrationName: data.integrationName || `${data.companyName} Integration`,
                timestamp: new Date().toISOString()
              }
              localStorage.setItem(`droplet_session_${data.fluidApiKey || authToken}`, JSON.stringify(sessionData))
              
              setTimeout(() => {
                navigate(`/success?installation_id=${sessionData.installationId}&fluid_api_key=${sessionData.fluidApiKey}`)
              }, 2000)
              return
            }
          }

          // Special case: If we have DRI but no auth token, try to get installation info
          if (dri && !authToken && (!data.companyName || data.companyName === 'Your Company')) {
            setError('Installation requires authentication. Please ensure you are properly logged into Fluid and try installing again.')
            setStatus('error')
            return
          }

          // Check if we have auth token but no webhook data yet - try to auto-configure
          if (authToken && (!data.companyName || data.companyName === 'Your Company')) {
            // Try to get company info from Fluid API and auto-configure
            try {
              setLoadingText('Setting up your integration...')
              setStatus('auto_configuring')
              
              // Test the Fluid API connection to get company info
              const testResponse = await apiClient.post('/api/droplet/test-connection', {
                fluidApiKey: authToken
              })
              
              if (testResponse.data.success) {
                const companyName = testResponse.data.data.companyName || testResponse.data.data.name || 'Your Company'
                const fetchedCompanyId = testResponse.data.data.companyId || testResponse.data.data.id || companyId
                
                // Auto-configure the installation
                const configData = {
                  integrationName: `${companyName} Integration`,
                  companyName: companyName,
                  environment: 'production',
                  fluidApiKey: authToken,
                  installationId: effectiveInstallationId,
                  companyId: fetchedCompanyId
                }
                
                const configResponse = await apiClient.post('/api/droplet/configure', configData)
                
                if (configResponse.data.success) {
                  setStatus('complete')
                  setCompanyData({ companyName, companyId: fetchedCompanyId })
                  
                  // Save session and redirect to success
                  const sessionData = {
                    installationId: configResponse.data.data?.installationId || effectiveInstallationId,
                    fluidApiKey: authToken,
                    companyName: companyName,
                    integrationName: configData.integrationName,
                    timestamp: new Date().toISOString()
                  }
                  localStorage.setItem(`droplet_session_${authToken}`, JSON.stringify(sessionData))
                  
                  setTimeout(() => {
                    navigate(`/success?installation_id=${sessionData.installationId}&fluid_api_key=${authToken}`)
                  }, 2000)
                  return
                } else {
                  throw new Error(configResponse.data.message || 'Configuration failed')
                }
              } else {
                throw new Error(testResponse.data.message || 'Failed to connect to Fluid API')
              }
            } catch (error: any) {
              console.error('❌ Auto-configuration failed:', error)
              setError(error.response?.data?.message || error.message || 'Failed to auto-configure installation')
              setStatus('error')
              return
            }
          }
        }
        
        setError('Unable to auto-configure installation. Please contact support.')
        setStatus('error')
        
      } catch (error: any) {
        console.error('❌ Auto-setup failed:', error)
        setError(error.response?.data?.message || 'Failed to set up installation')
        setStatus('error')
      }
    }

    checkInstallationStatus()
  }, [installationId, companyId, authToken, navigate])

  const getStatusContent = () => {
    switch (status) {
      case 'checking':
        return {
          icon: 'search',
          title: loadingText,
          description: 'Please wait while we set up your integration',
          color: 'blue'
        }
      
      case 'auto_configuring':
        return {
          icon: 'cog',
          title: loadingText,
          description: `Setting up ${companyData?.companyName || 'your integration'} with Fluid platform`,
          color: 'purple'
        }
      
      case 'complete':
        return {
          icon: 'check-circle',
          title: `Welcome, ${companyData?.companyName}!`,
          description: '',
          color: 'green'
        }
      
      case 'error':
        return {
          icon: 'exclamation-triangle',
          title: 'Setup Failed',
          description: error || 'Unable to automatically configure the installation.',
          color: 'red'
        }
      
      default:
        return {
          icon: 'spinner',
          title: loadingText,
          description: 'Please wait',
          color: 'gray'
        }
    }
  }

  const content = getStatusContent()

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      {/* Status Card */}
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
        {/* Header */}
        <div className="px-8 pt-8 pb-6 text-center">
          <div className={`flex items-center justify-center w-16 h-16 mx-auto mb-6 rounded-2xl shadow-sm ${
            content.color === 'blue' ? 'bg-blue-50 text-blue-600' :
            content.color === 'purple' ? 'bg-purple-50 text-purple-600' :
            content.color === 'green' ? 'bg-green-50 text-green-600' :
            content.color === 'yellow' ? 'bg-amber-50 text-amber-600' :
            'bg-gray-50 text-gray-600'
          }`}>
            <FontAwesomeIcon 
              icon={content.icon as any} 
              className={`text-2xl ${status === 'checking' || status === 'auto_configuring' ? 'animate-spin' : ''}`} 
            />
          </div>
            
          <h1 className="text-2xl font-semibold text-gray-900 mb-2 transition-all duration-300">
            {content.title}
          </h1>
          
          <p className="text-gray-600 mb-6 transition-all duration-300">
            {content.description}
          </p>
          
          {/* Progress indicator for loading states */}
          {(status === 'checking' || status === 'auto_configuring') && (
            <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
              <div className="bg-blue-600 h-2 rounded-full animate-pulse" style={{width: '60%'}}></div>
            </div>
          )}
          
          {companyData?.companyLogo && (
            <div className="flex items-center justify-center mb-6">
              <div className="inline-flex items-center px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg">
                <img 
                  src={companyData.companyLogo} 
                  alt={`${companyData.companyName} logo`}
                  className="w-4 h-4 rounded mr-2 object-contain"
                />
                <span className="text-gray-700 font-medium text-sm">{companyData.companyName}</span>
              </div>
            </div>
          )}
            
          {/* Progress Steps for auto-configuring */}
          {status === 'auto_configuring' && (
            <div className="space-y-3 px-4">
              <div className="flex items-center justify-between text-sm py-2">
                <span className="text-gray-600">Verifying company information</span>
                <FontAwesomeIcon icon="check" className="text-green-500" />
              </div>
              <div className="flex items-center justify-between text-sm py-2">
                <span className="text-gray-900 font-medium">Configuring integration settings</span>
                <FontAwesomeIcon icon="spinner" spin className="text-blue-500" />
              </div>
              <div className="flex items-center justify-between text-sm py-2">
                <span className="text-gray-400">Finalizing setup</span>
                <FontAwesomeIcon icon="clock" className="text-gray-300" />
              </div>
            </div>
          )}
          
          {/* Success checkmarks */}
          {status === 'complete' && (
            <div className="space-y-3 px-4">
              <div className="flex items-center justify-between text-sm py-2">
                <span className="text-gray-600">Company verified</span>
                <FontAwesomeIcon icon="check" className="text-green-500" />
              </div>
              <div className="flex items-center justify-between text-sm py-2">
                <span className="text-gray-600">Integration configured</span>
                <FontAwesomeIcon icon="check" className="text-green-500" />
              </div>
              <div className="flex items-center justify-between text-sm py-2">
                <span className="text-gray-600">Ready to use</span>
                <FontAwesomeIcon icon="check" className="text-green-500" />
              </div>
            </div>
          )}
        </div>
        
        {error && (
          <div className="mx-8 mb-8">
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-start">
                <FontAwesomeIcon icon="exclamation-triangle" className="text-red-500 mr-3 mt-0.5" />
                <div className="flex-1">
                  <h3 className="text-sm font-medium text-red-800">Setup Error</h3>
                  <p className="text-sm text-red-700 mt-1">{error}</p>
                  {status === 'error' && (
                    <button
                      onClick={() => window.location.reload()}
                      className="mt-3 px-3 py-1 text-xs font-medium text-red-800 bg-red-100 border border-red-200 rounded hover:bg-red-200 transition-colors"
                    >
                      <FontAwesomeIcon icon="redo" className="mr-1" />
                      Try Again
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}