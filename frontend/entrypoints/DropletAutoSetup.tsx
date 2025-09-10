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
  
  const [status, setStatus] = useState<'checking' | 'auto_configuring' | 'needs_form' | 'complete'>('checking')
  const [companyData, setCompanyData] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const checkInstallationStatus = async () => {
      try {
        setStatus('checking')

        console.log('🔍 Auto-setup checking:', {
          installationId,
          companyId, 
          authToken: authToken ? 'present' : 'missing'
        })

        // First, check if we have a webhook-configured installation
        const statusResponse = await apiClient.get(`/api/droplet/status/${installationId || 'new-installation'}`)
        
        console.log('📊 Status response:', statusResponse.data)
        
        if (statusResponse.data.success) {
          const data = statusResponse.data.data
          
          // Check if installation is already fully configured (active status)
          if (data.status === 'active' && data.companyName && data.companyName !== 'Your Company') {
            console.log('✅ Found active installation, redirecting to dashboard')
            setCompanyData(data)
            setStatus('complete')
            
            // Save session and redirect to dashboard instead of success page
            const sessionData = {
              installationId: data.installationId,
              fluidApiKey: data.fluidApiKey,
              companyName: data.companyName,
              integrationName: data.integrationName,
              timestamp: new Date().toISOString()
            }
            localStorage.setItem('droplet_session', JSON.stringify(sessionData))
            
            // Redirect to dashboard page for active installations
            setTimeout(() => {
              navigate(`/dashboard?installation_id=${data.installationId}&fluid_api_key=${data.fluidApiKey}`)
            }, 2000)
            return
          }
          
          // Check if we have webhook data waiting to be configured (pending status) OR auto-configure if we have company data
          if (data.companyName && data.companyName !== 'Your Company') {
            console.log('🔧 Found webhook data, auto-configuring...')
            setCompanyData(data)
            setStatus('auto_configuring')
            
            // Auto-configure the installation using webhook data
            const configData = {
              integrationName: data.integrationName || `${data.companyName} Integration`,
              companyName: data.companyName,
              environment: 'production',
              fluidApiKey: data.fluidApiKey || authToken,
              installationId: data.installationId || installationId || 'new-installation',
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
          }

          // Check if we have auth token but no webhook data yet (race condition)
          if (authToken && (!data.companyName || data.companyName === 'Your Company')) {
            console.log('⏱️ Have auth token but no webhook data yet, testing API...')
            
            try {
              // Test the connection to get company info
              const testResponse = await apiClient.post('/api/droplet/test-connection', {
                fluidApiKey: authToken
              })
              
              if (testResponse.data.success) {
                console.log('🏢 Got company info from API:', testResponse.data.data)
                const companyName = testResponse.data.data.companyName || 'Your Company'
                
                if (companyName !== 'Your Company') {
                  setCompanyData({
                    companyName,
                    companyLogo: testResponse.data.data.companyLogo,
                    id: 'new-installation',
                    status: 'pending'
                  })
                  setStatus('auto_configuring')
                  
                  // Auto-configure with API data
                  const configData = {
                    integrationName: `${companyName} Integration`,
                    companyName,
                    environment: 'production',
                    fluidApiKey: authToken,
                    installationId: installationId || 'new-installation',
                    companyId: companyId
                  }
                  
                  const configResponse = await apiClient.post('/api/droplet/configure', configData)
                  
                  if (configResponse.data.success) {
                    setStatus('complete')
                    
                    const sessionData = {
                      installationId: configResponse.data.data?.installationId || 'new-installation',
                      fluidApiKey: authToken,
                      companyName,
                      integrationName: configData.integrationName,
                      timestamp: new Date().toISOString()
                    }
                    localStorage.setItem('droplet_session', JSON.stringify(sessionData))
                    
                    setTimeout(() => {
                      navigate(`/success?installation_id=${sessionData.installationId}&fluid_api_key=${authToken}`)
                    }, 2000)
                    return
                  }
                }
              }
            } catch (apiError) {
              console.log('⚠️ API test failed, will show form')
            }
          }
        }
        
        console.log('📝 No auto-configuration possible, redirecting to form')
        // If we get here, we need the configuration form
        setStatus('needs_form')
        setTimeout(() => {
          navigate(`/config?installation_id=${installationId || 'new-installation'}&company_id=${companyId || ''}&fluid_api_key=${authToken || ''}`)
        }, 1000)
        
      } catch (error: any) {
        console.error('❌ Auto-setup failed:', error)
        setError(error.response?.data?.message || 'Failed to set up installation')
        setStatus('needs_form')
        
        // Redirect to form as fallback
        setTimeout(() => {
          navigate(`/config?installation_id=${installationId || 'new-installation'}&company_id=${companyId || ''}&fluid_api_key=${authToken || ''}`)
        }, 3000)
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
      
      case 'needs_form':
        return {
          icon: 'exclamation-triangle',
          title: 'Configuration Required',
          description: 'Additional setup needed. Redirecting to configuration form...',
          color: 'yellow'
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
  const colorClasses = {
    blue: 'from-blue-500 to-blue-600 bg-blue-50 text-blue-700',
    purple: 'from-purple-500 to-purple-600 bg-purple-50 text-purple-700',
    green: 'from-green-500 to-green-600 bg-green-50 text-green-700',
    yellow: 'from-yellow-500 to-yellow-600 bg-yellow-50 text-yellow-700',
    gray: 'from-gray-500 to-gray-600 bg-gray-50 text-gray-700'
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/20 backdrop-blur-sm"></div>
      
      {/* Status Card */}
      <div className="relative w-full max-w-2xl bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 overflow-hidden">
        {/* Header */}
        <div className="relative px-8 pt-8 pb-6">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-600/10 via-purple-600/10 to-indigo-600/10"></div>
          <div className="relative text-center">
            <div className={`flex items-center justify-center w-20 h-20 mx-auto mb-6 bg-gradient-to-br ${colorClasses[content.color as keyof typeof colorClasses].split(' ')[0]} ${colorClasses[content.color as keyof typeof colorClasses].split(' ')[1]} rounded-3xl shadow-lg`}>
              <FontAwesomeIcon 
                icon={content.icon as any} 
                className={`text-3xl text-white ${status === 'checking' || status === 'auto_configuring' ? 'animate-spin' : ''}`} 
              />
            </div>
            
            <h1 className="text-3xl font-bold text-gray-900 mb-3">
              {content.title}
            </h1>
            
            <p className="text-lg text-gray-600 mb-6">
              {content.description}
            </p>
            
            {companyData?.companyLogo && (
              <div className="flex items-center justify-center mb-4">
                <div className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-full">
                  <img 
                    src={companyData.companyLogo} 
                    alt={`${companyData.companyName} logo`}
                    className="w-5 h-5 rounded mr-2 object-contain"
                  />
                  <span className="text-blue-800 font-medium text-sm">{companyData.companyName}</span>
                </div>
              </div>
            )}
            
            {/* Progress Steps for auto-configuring */}
            {status === 'auto_configuring' && (
              <div className="mt-8 space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Verifying company information</span>
                  <FontAwesomeIcon icon="check" className="text-green-600" />
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Configuring integration settings</span>
                  <FontAwesomeIcon icon="spinner" spin className="text-blue-600" />
                </div>
                <div className="flex items-center justify-between text-sm text-gray-400">
                  <span>Finalizing setup</span>
                  <FontAwesomeIcon icon="clock" className="text-gray-400" />
                </div>
              </div>
            )}
            
            {/* Success checkmarks */}
            {status === 'complete' && (
              <div className="mt-8 space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Company verified</span>
                  <FontAwesomeIcon icon="check" className="text-green-600" />
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Integration configured</span>
                  <FontAwesomeIcon icon="check" className="text-green-600" />
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Ready to use</span>
                  <FontAwesomeIcon icon="check" className="text-green-600" />
                </div>
              </div>
            )}
            
            {error && (
              <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-center">
                  <FontAwesomeIcon icon="exclamation-triangle" className="text-red-600 mr-3" />
                  <div className="text-left">
                    <h3 className="text-sm font-medium text-red-800">Setup Error</h3>
                    <p className="text-sm text-red-700 mt-1">{error}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}