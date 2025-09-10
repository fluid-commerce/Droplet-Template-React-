import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { apiClient } from '@/lib/api'

interface ConfigFormData {
  integrationName: string
  companyName: string
  environment: 'production' | 'staging' | 'development'
  fluidApiKey: string
}

export function DropletConfig() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const installationId = searchParams.get('installation_id')
  const companyId = searchParams.get('company_id')
  const authToken = searchParams.get('auth_token') || 
                   searchParams.get('token') || 
                   searchParams.get('fluid_api_key') ||
                   searchParams.get('api_key') ||
                   searchParams.get('access_token')
  
  const [formData, setFormData] = useState<ConfigFormData>({
    integrationName: '',
    companyName: '',
    environment: 'production',
    fluidApiKey: '',
  })

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [companyData, setCompanyData] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [isTestingConnection, setIsTestingConnection] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<string | null>(null)
  const [isEditing, setIsEditing] = useState(false)

  // Load company data on component mount
  useEffect(() => {
    const loadCompanyData = async () => {
      // Check localStorage for existing session
      const savedSession = localStorage.getItem('droplet_session')
      if (savedSession && !installationId) {
        try {
          const sessionData = JSON.parse(savedSession)
          if (sessionData.installationId && sessionData.fluidApiKey) {
            // Redirect to the saved installation
            navigate(`/config?installation_id=${sessionData.installationId}&fluid_api_key=${sessionData.fluidApiKey}`)
            return
          }
        } catch (error) {
          console.error('Failed to parse saved session:', error)
          localStorage.removeItem('droplet_session')
        }
      }

      if (!installationId) {
        // For new installations, first try to get stored company info from webhook
        try {
          const storedResponse = await apiClient.get('/api/droplet/status/new-installation')
          if (storedResponse.data.success && storedResponse.data.data.companyName !== 'Your Company') {
            // We have stored company info from webhook
            const storedData = storedResponse.data.data
            setCompanyData({
              companyName: storedData.companyName,
              companyLogo: storedData.companyLogo,
              id: 'new-installation',
              status: 'pending'
            })
            // Pre-fill the form with stored data
            setFormData(prev => ({
              ...prev,
              fluidApiKey: storedData.fluidApiKey || authToken || '',
              companyName: storedData.companyName,
              integrationName: storedData.integrationName || `${storedData.companyName} Integration`
            }))
            setIsLoading(false)
            return
          }
        } catch (error) {
          console.log('No stored company data found, will try auth token')
        }
        
        // If no stored data, try to get company info if we have auth token
        if (authToken) {
          try {
            // Test the Fluid API key and get company info
            const testResponse = await apiClient.post('/api/droplet/test-connection', {
              fluidApiKey: authToken
            })
            
            if (testResponse.data.success) {
              const companyName = testResponse.data.data.companyName || 'Your Company'
              setCompanyData({
                companyName: companyName,
                companyLogo: testResponse.data.data.companyLogo,
                id: 'new-installation',
                status: 'pending'
              })
              // Pre-fill the form with the Fluid API key and company information
              setFormData(prev => ({
                ...prev,
                fluidApiKey: authToken,
                companyName: companyName,
                integrationName: `${companyName} Integration`
              }))
            } else {
              setCompanyData({
                companyName: 'Your Company',
                id: 'new-installation',
                status: 'pending'
              })
            }
          } catch (error) {
            console.error('Failed to get company info:', error)
            setCompanyData({
              companyName: 'Your Company',
              id: 'new-installation',
              status: 'pending'
            })
          }
        } else {
          setCompanyData({
            companyName: 'Your Company',
            id: 'new-installation',
            status: 'pending'
          })
        }
        setIsLoading(false)
        return
      }

      try {
        // Get installation status from backend
        const response = await apiClient.get(`/api/droplet/status/${installationId}`)
        setCompanyData(response.data.data)
        
        // Check if this is an existing installation
        if (response.data.data.connected && response.data.data.installationId !== 'new-installation') {
          setIsEditing(true)
          
          // Pre-fill form data if available
          setFormData(prev => ({
            ...prev,
            companyName: response.data.data.companyName,
            integrationName: response.data.data.integrationName || 'My Integration',
            environment: response.data.data.environment || 'production',
            fluidApiKey: response.data.data.fluidApiKey || ''
          }))
        }
        
        // Update company data with logo information
        setCompanyData((prev: any) => ({
          ...prev,
          companyLogo: response.data.data.companyLogo
        }))
      } catch (err: any) {
        console.error('Failed to load company data:', err)
        setError(err.response?.data?.message || 'Failed to load company data')
      } finally {
        setIsLoading(false)
      }
    }

    loadCompanyData()
  }, [installationId, navigate, authToken])

  const handleDisconnect = async () => {
    if (!window.confirm('Are you sure you want to disconnect this integration? This will remove all configuration data.')) {
      return
    }

    try {
      // Disconnect logic
      
      // Clear session from localStorage
      localStorage.removeItem('droplet_session')
      
      // Redirect to the main page
      navigate('/')
    } catch (error) {
      console.error('Failed to disconnect:', error)
      setError('Failed to disconnect. Please try again.')
    }
  }

  const testConnection = async () => {
    if (!formData.fluidApiKey) {
      setError('Please enter your Fluid API key first')
      return
    }

    setIsTestingConnection(true)
    setError(null)
    setConnectionStatus(null)

    try {
      const response = await apiClient.post('/api/droplet/test-connection', {
        fluidApiKey: formData.fluidApiKey
      })

      if (response.data.success) {
        setConnectionStatus('✅ Connection successful!')
      }
    } catch (err: any) {
      setConnectionStatus('❌ Connection failed')
      setError(err.response?.data?.message || 'Connection test failed')
    } finally {
      setIsTestingConnection(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)

    try {
      const response = await apiClient.post('/api/droplet/configure', {
        ...formData,
        installationId: installationId || 'new-installation',
        companyId: companyId
      })

      if (response.data.success) {
        // Save session to localStorage
        const sessionData = {
          installationId: installationId || response.data.installationId || 'new-installation',
          fluidApiKey: formData.fluidApiKey,
          companyName: formData.companyName,
          integrationName: formData.integrationName,
          timestamp: new Date().toISOString()
        }
        localStorage.setItem('droplet_session', JSON.stringify(sessionData))

        // Navigate to success page using React Router
        const finalInstallationId = installationId || response.data.installationId || 'new-installation'
        navigate(`/success?installation_id=${finalInstallationId}&fluid_api_key=${formData.fluidApiKey}`)
      }
    } catch (err: any) {
      console.error('Configuration failed:', err)
      setError(err.response?.data?.message || 'Configuration failed')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Loading...</h2>
          <p className="text-gray-600">
            {authToken 
              ? 'Fetching your company information from Fluid' 
              : 'Setting up your droplet configuration'
            }
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-8 py-12 text-center text-white">
          <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
            <FontAwesomeIcon icon="rocket" className="text-2xl" />
          </div>
          
          <h1 className="text-3xl font-bold mb-2">
            {isEditing ? 'Edit Integration' : 'Setup Integration'}
          </h1>
          
          <p className="text-blue-100 text-lg">
            {companyData?.companyName && companyData.companyName !== 'Your Company'
              ? `Configure integration for ${companyData.companyName}`
              : 'Connect your Fluid account to get started'
            }
          </p>

          {/* Company Badge */}
          {companyData?.companyName && companyData.companyName !== 'Your Company' && (
            <div className="mt-6 inline-flex items-center bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-4 py-2">
              {companyData.companyLogo ? (
                <img 
                  src={companyData.companyLogo} 
                  alt={`${companyData.companyName} logo`}
                  className="w-5 h-5 rounded mr-3 object-contain"
                />
              ) : (
                <FontAwesomeIcon icon="building" className="mr-3" />
              )}
              <span className="font-medium">{companyData.companyName}</span>
              {isEditing && (
                <span className="ml-2 px-2 py-1 bg-green-400/20 text-green-100 text-xs rounded-full border border-green-400/30">
                  Connected
                </span>
              )}
            </div>
          )}
        </div>

        {/* Form Content */}
        <div className="p-8">
          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4 flex items-start">
              <FontAwesomeIcon icon="exclamation-triangle" className="text-red-600 mt-0.5 mr-3 flex-shrink-0" />
              <div>
                <h3 className="font-medium text-red-800">Configuration Error</h3>
                <p className="text-sm text-red-700 mt-1">{error}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Integration Name */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 flex items-center">
                <FontAwesomeIcon icon="tag" className="mr-2 text-blue-600" />
                Integration Name
              </label>
              <input
                type="text"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                value={formData.integrationName}
                onChange={(e) => setFormData(prev => ({ ...prev, integrationName: e.target.value }))}
                placeholder="e.g., Acme Corp Integration"
                required
              />
              <p className="text-xs text-gray-500">
                A friendly name for this integration
              </p>
            </div>

            {/* Company Name */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 flex items-center">
                <FontAwesomeIcon icon="building" className="mr-2 text-blue-600" />
                Company Name
              </label>
              <input
                type="text"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                value={formData.companyName}
                onChange={(e) => setFormData(prev => ({ ...prev, companyName: e.target.value }))}
                placeholder="Your company name"
                required
              />
              <p className="text-xs text-gray-500">
                {formData.companyName && formData.companyName !== 'Your Company' 
                  ? 'Pre-filled from your Fluid account' 
                  : 'Enter your organization name'
                }
              </p>
            </div>

            {/* Environment */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 flex items-center">
                <FontAwesomeIcon icon="server" className="mr-2 text-blue-600" />
                Environment
              </label>
              <select
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                value={formData.environment}
                onChange={(e) => setFormData(prev => ({ ...prev, environment: e.target.value as any }))}
              >
                <option value="production">🚀 Production</option>
                <option value="staging">🧪 Staging</option>
                <option value="development">🔧 Development</option>
              </select>
            </div>

            {/* Fluid API Key */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 flex items-center">
                <FontAwesomeIcon icon="key" className="mr-2 text-blue-600" />
                Fluid API Key
              </label>
              <div className="relative">
                <input
                  type="password"
                  className={`w-full px-4 py-3 pr-24 border rounded-xl transition-all ${
                    isEditing 
                      ? 'bg-gray-50 border-gray-200 cursor-not-allowed' 
                      : 'border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent'
                  }`}
                  value={formData.fluidApiKey}
                  onChange={(e) => !isEditing && setFormData(prev => ({ ...prev, fluidApiKey: e.target.value }))}
                  placeholder="PT-your-api-key-here"
                  required
                  disabled={isEditing}
                />
                <button
                  type="button"
                  onClick={testConnection}
                  disabled={isTestingConnection || !formData.fluidApiKey || isEditing}
                  className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                >
                  {isTestingConnection ? (
                    <FontAwesomeIcon icon="spinner" spin className="w-3 h-3" />
                  ) : (
                    'Test'
                  )}
                </button>
              </div>
              
              {/* Connection Status */}
              {connectionStatus && (
                <div className={`text-sm px-3 py-2 rounded-lg ${
                  connectionStatus.includes('✅') 
                    ? 'bg-green-50 text-green-700 border border-green-200' 
                    : 'bg-red-50 text-red-700 border border-red-200'
                }`}>
                  {connectionStatus}
                </div>
              )}
              
              <p className="text-xs text-gray-500">
                {formData.fluidApiKey 
                  ? '🔐 Your API key is secure and encrypted'
                  : 'Find this in your Fluid account settings → API Keys'
                }
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-6">
              <button
                type="button"
                onClick={() => window.history.back()}
                className="px-6 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              
              {isEditing && (
                <button
                  type="button"
                  onClick={() => navigate(`/dashboard?installation_id=${installationId}&fluid_api_key=${formData.fluidApiKey}`)}
                  className="px-6 py-3 bg-gray-600 text-white rounded-xl hover:bg-gray-700 transition-colors flex items-center justify-center"
                >
                  <FontAwesomeIcon icon="tachometer-alt" className="mr-2" />
                  Dashboard
                </button>
              )}
              
              {isEditing && (
                <button
                  type="button"
                  onClick={handleDisconnect}
                  className="px-6 py-3 border border-red-300 text-red-600 rounded-xl hover:bg-red-50 transition-colors"
                >
                  <FontAwesomeIcon icon="unlink" className="mr-2" />
                  Disconnect
                </button>
              )}
              
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center font-medium"
              >
                {isSubmitting ? (
                  <>
                    <FontAwesomeIcon icon="spinner" spin className="mr-2" />
                    {isEditing ? 'Updating...' : 'Connecting...'}
                  </>
                ) : (
                  <>
                    <FontAwesomeIcon icon="rocket" className="mr-2" />
                    {isEditing ? 'Update Configuration' : 'Connect Integration'}
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}