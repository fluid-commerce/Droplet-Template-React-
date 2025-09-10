import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { apiClient } from '@/lib/api'

export function DropletAutoSetup() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const installationId = searchParams.get('installation_id')
  const companyId = searchParams.get('company_id')
  const authToken = searchParams.get('auth_token') || 
                   searchParams.get('token') || 
                   searchParams.get('fluid_api_key') ||
                   searchParams.get('api_key') ||
                   searchParams.get('access_token')
  
  const [status, setStatus] = useState<'checking' | 'auto_configuring' | 'error' | 'complete'>('checking')
  const [companyData, setCompanyData] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const checkInstallationStatus = async () => {
      try {
        setStatus('checking')

        // Check if we already have a valid session in localStorage
        const existingSession = localStorage.getItem('droplet_session')
        if (existingSession) {
          try {
            const sessionData = JSON.parse(existingSession)
            const sessionAge = Date.now() - new Date(sessionData.timestamp).getTime()
            const maxAge = 24 * 60 * 60 * 1000 // 24 hours
            
            if (sessionAge < maxAge && sessionData.installationId && sessionData.installationId !== 'new-installation') {
              console.log('🔄 Found valid session, redirecting to dashboard')
              navigate(`/dashboard?installation_id=${sessionData.installationId}&fluid_api_key=${sessionData.fluidApiKey}`)
              return
            }
          } catch (e) {
            // Invalid session data, continue with normal flow
            localStorage.removeItem('droplet_session')
          }
        }

        // If we have installation_id and fluid_api_key in URL, go directly to dashboard
        if (installationId && installationId !== 'new-installation' && authToken) {
          console.log('🎯 Have installation ID and API key, going directly to dashboard')
          navigate(`/dashboard?installation_id=${installationId}&fluid_api_key=${authToken}`)
          return
        }

        // If we have any installation ID that's not 'new-installation', don't run auto-setup
        if (installationId && installationId !== 'new-installation') {
          console.log('⚠️ Have existing installation ID, redirecting to dashboard without auto-setup')
          navigate(`/dashboard?installation_id=${installationId}&fluid_api_key=${authToken || 'unknown'}`)
          return
        }

        console.log('🔍 Auto-setup checking:', {
          installationId,
          companyId, 
          authToken: authToken ? 'present' : 'missing'
        })

        // Only run auto-setup if we have the necessary parameters for a new installation
        if (!authToken && !installationId) {
          console.log('❌ No auth token or installation ID, cannot proceed with auto-setup')
          setError('Missing required parameters for installation. Please install the droplet from Fluid.')
          setStatus('error')
          return
        }

        // First, check if we have a webhook-configured installation
        const statusResponse = await apiClient.get(`/api/droplet/status/${installationId || 'new-installation'}`)
        
        console.log('📊 Status response:', statusResponse.data)
        
        // If we get a successful response with an active installation, go directly to dashboard
        if (statusResponse.data.success && statusResponse.data.data?.status === 'active') {
          console.log('✅ Found active installation, redirecting to dashboard immediately')
          const data = statusResponse.data.data
          navigate(`/dashboard?installation_id=${data.installationId}&fluid_api_key=${data.fluidApiKey || authToken}`)
          return
        }
        
        if (statusResponse.data.success) {
          const data = statusResponse.data.data
          
          // Check if installation is already fully configured (active status)
          if (data.status === 'active' && data.companyName && data.companyName !== 'Your Company') {
            console.log('✅ Found active installation, redirecting to dashboard immediately')
            
            // Save session data
            const sessionData = {
              installationId: data.installationId,
              fluidApiKey: data.fluidApiKey,
              companyName: data.companyName,
              integrationName: data.integrationName,
              timestamp: new Date().toISOString()
            }
            localStorage.setItem('droplet_session', JSON.stringify(sessionData))
            
            // Redirect immediately to dashboard for returning users
            navigate(`/dashboard?installation_id=${data.installationId}&fluid_api_key=${data.fluidApiKey}`)
            return
          }
          
          // If we have any installation data but it's not active, don't auto-configure
          if (data.installationId && data.installationId !== 'new-installation') {
            console.log('⚠️ Found existing installation but not active, waiting for webhook to complete')
            setError('Installation is being processed. Please wait a moment and refresh the page.')
            setStatus('error')
            return
          }
          
          // Check if we have webhook data waiting to be configured (pending status) OR auto-configure if we have company data
          if (data.companyName && data.companyName !== 'Your Company') {
            console.log('🔧 Found webhook data, checking if configuration is needed...')
            setCompanyData(data)
            
            // If installation is already active, just redirect to dashboard
            if (data.status === 'active') {
              console.log('✅ Installation already active, redirecting to dashboard')
              setStatus('complete')
              
              const sessionData = {
                installationId: data.installationId,
                fluidApiKey: data.fluidApiKey || authToken,
                companyName: data.companyName,
                integrationName: data.integrationName || `${data.companyName} Integration`,
                timestamp: new Date().toISOString()
              }
              localStorage.setItem('droplet_session', JSON.stringify(sessionData))
              
              setTimeout(() => {
                navigate(`/dashboard?installation_id=${sessionData.installationId}&fluid_api_key=${sessionData.fluidApiKey}`)
              }, 1000)
              return
            }
            
            // Only auto-configure if we have a real installation ID (not 'new-installation') AND status is pending
            if (data.installationId && data.installationId !== 'new-installation' && data.status === 'pending') {
              console.log('🔧 Found pending installation, auto-configuring...')
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
              
              console.log('📝 Auto-configuring with:', configData)
              
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
                localStorage.setItem('droplet_session', JSON.stringify(sessionData))
                
                console.log('✅ Auto-configuration successful, redirecting to success')
                setTimeout(() => {
                  navigate(`/success?installation_id=${sessionData.installationId}&fluid_api_key=${configData.fluidApiKey}`)
                }, 2000)
                return
              }
            } else {
              // If no real installation ID, just redirect to success with the data we have
              console.log('✅ No real installation ID, redirecting to success with webhook data')
              setStatus('complete')
              
              const sessionData = {
                installationId: data.installationId || 'new-installation',
                fluidApiKey: data.fluidApiKey || authToken,
                companyName: data.companyName,
                integrationName: data.integrationName || `${data.companyName} Integration`,
                timestamp: new Date().toISOString()
              }
              localStorage.setItem('droplet_session', JSON.stringify(sessionData))
              
              setTimeout(() => {
                navigate(`/success?installation_id=${sessionData.installationId}&fluid_api_key=${sessionData.fluidApiKey}`)
              }, 2000)
              return
            }
          }

          // Check if we have auth token but no webhook data yet (race condition)
          if (authToken && (!data.companyName || data.companyName === 'Your Company')) {
            console.log('⏱️ Have auth token but no webhook data yet, waiting for webhook...')
            
            // Instead of creating a new installation, wait for the webhook to arrive
            // This prevents creating duplicate installations on every page load
            console.log('🔄 Waiting for webhook data to arrive...')
            setError('Waiting for installation data from Fluid platform. Please refresh the page in a few moments.')
            return
          }
        }
        
        console.log('❌ No auto-configuration possible')
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
          title: 'Checking Installation Status...',
          description: 'Looking up your company information',
          color: 'blue'
        }
      
      case 'auto_configuring':
        return {
          icon: 'cog',
          title: `Setting up ${companyData?.companyName || 'Your Integration'}...`,
          description: 'Automatically configuring your droplet with company information',
          color: 'purple'
        }
      
      case 'complete':
        return {
          icon: 'check-circle',
          title: `Welcome, ${companyData?.companyName}!`,
          description: 'Your integration has been configured successfully. Redirecting to dashboard...',
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
          title: 'Loading...',
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
            
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">
            {content.title}
          </h1>
          
          <p className="text-gray-600 mb-6">
            {content.description}
          </p>
          
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