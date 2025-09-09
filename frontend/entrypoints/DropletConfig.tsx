import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { Button } from '@/components/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/Card'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { apiClient } from '@/lib/api'

interface ConfigFormData {
  integrationName: string
  companyName: string
  environment: 'production' | 'staging' | 'development'
  fluidApiKey: string
  webhookUrl?: string
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
    webhookUrl: '',
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
            navigate(`/?installation_id=${sessionData.installationId}&fluid_api_key=${sessionData.fluidApiKey}`)
            return
          }
        } catch (error) {
          console.error('Failed to parse saved session:', error)
          localStorage.removeItem('droplet_session')
        }
      }

      if (!installationId) {
        // If no installation ID, try to get company info from Fluid API if we have a key
        const fluidApiKey = authToken || searchParams.get('fluid_api_key')
        if (fluidApiKey) {
          try {
            // Test the Fluid API key and get company info
            const testResponse = await apiClient.post('/api/droplet/test-connection', {
              fluidApiKey: fluidApiKey
            })
            
            if (testResponse.data.success) {
              setCompanyData({
                companyName: testResponse.data.data.companyName || 'Your Company',
                companyLogo: testResponse.data.data.companyLogo,
                id: 'new-installation',
                status: 'pending'
              })
              // Pre-fill the form with the Fluid API key
              setFormData(prev => ({
                ...prev,
                fluidApiKey: fluidApiKey
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
            webhookUrl: response.data.data.webhookUrl || '',
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
  }, [installationId])

  const handleInputChange = (field: keyof ConfigFormData, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }))
  }

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
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 py-12 px-4">
        <div className="max-w-3xl mx-auto">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Loading...</h2>
            <p className="text-gray-600">Fetching your company information from Fluid</p>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 py-12 px-4">
        <div className="max-w-3xl mx-auto">
          <div className="text-center">
            <div className="bg-red-50 border border-red-200 rounded-lg p-6">
              <FontAwesomeIcon icon="exclamation-triangle" className="text-red-600 text-2xl mb-4" />
              <h2 className="text-xl font-semibold text-red-900 mb-2">Error Loading Configuration</h2>
              <p className="text-red-700 mb-4">{error}</p>
              <Button onClick={() => window.location.reload()}>
                Try Again
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4 tracking-tight">
            {isEditing 
              ? 'Edit Configuration' 
              : companyData?.companyName && companyData.companyName !== 'Your Company'
                ? `Welcome, ${companyData.companyName}!`
                : 'Welcome!'
            }
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            {isEditing 
              ? 'Update your integration settings and configuration'
              : 'Configure your credentials to establish a secure connection'
            }
          </p>
          {companyData?.companyName && companyData.companyName !== 'Your Company' && (
            <div className="mt-4 inline-flex items-center px-4 py-2 bg-primary-50 border border-primary-200 rounded-lg">
              {companyData.companyLogo ? (
                <img 
                  src={companyData.companyLogo} 
                  alt={`${companyData.companyName} logo`}
                  className="w-6 h-6 rounded mr-2 object-contain"
                  onError={(e) => {
                    // Fallback to icon if image fails to load
                    e.currentTarget.style.display = 'none'
                    const nextElement = e.currentTarget.nextElementSibling as HTMLElement
                    if (nextElement) {
                      nextElement.style.display = 'inline'
                    }
                  }}
                />
              ) : null}
              <FontAwesomeIcon 
                icon="building" 
                className="text-primary-600 mr-2"
                style={{ display: companyData.companyLogo ? 'none' : 'inline' }}
              />
              <span className="text-primary-800 font-medium">{companyData.companyName}</span>
              {isEditing && (
                <span className="ml-2 px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                  Connected
                </span>
              )}
            </div>
          )}
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center">
              <FontAwesomeIcon icon="exclamation-triangle" className="text-red-600 mr-3" />
              <div>
                <h3 className="text-sm font-medium text-red-800">Configuration Error</h3>
                <p className="text-sm text-red-700 mt-1">{error}</p>
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-10">
          {/* Integration Info */}
          <Card className="group">
          <CardHeader>
            <CardTitle className="flex items-center text-lg">
              <FontAwesomeIcon icon="info-circle" className="mr-3 h-5 w-5 text-blue-600" />
              Integration Details
            </CardTitle>
            <CardDescription className="text-gray-600 mt-2">
              Basic information about your integration
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 p-6">
            <div className="form-group">
              <label className="label">Integration Name</label>
                        <input
                          type="text"
                          className="input mt-1"
                          value={formData.integrationName}
                          onChange={(e) => setFormData(prev => ({ ...prev, integrationName: e.target.value }))}
                          placeholder="Enter your integration name"
                          required
                        />
            </div>
            <div className="form-group">
              <label className="label">Company Name</label>
              <input
                type="text"
                className="input mt-1"
                value={formData.companyName}
                onChange={(e) => setFormData(prev => ({ ...prev, companyName: e.target.value }))}
                placeholder="Your company name"
                required
              />
            </div>
            <div className="form-group">
              <label className="label">Environment</label>
              <select
                className="input mt-1"
                value={formData.environment}
                onChange={(e) => setFormData(prev => ({ ...prev, environment: e.target.value as any }))}
              >
                <option value="production">Production</option>
                <option value="staging">Staging</option>
                <option value="development">Development</option>
              </select>
            </div>
          </CardContent>
        </Card>

          {/* Fluid API Key */}
          <Card className="group">
          <CardHeader>
            <CardTitle className="flex items-center text-lg">
              <FontAwesomeIcon icon="key" className="mr-3 h-5 w-5 text-green-600" />
              Fluid API Key
            </CardTitle>
            <CardDescription className="text-gray-600 mt-2">
              Your Fluid API token for platform integration
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 p-6">
            <div className="form-group">
              <label className="label">API Token</label>
                        <input
                          type="password"
                          className={`input mt-1 ${isEditing ? 'bg-gray-50 cursor-not-allowed' : ''}`}
                          value={formData.fluidApiKey}
                          onChange={(e) => !isEditing && setFormData(prev => ({ ...prev, fluidApiKey: e.target.value }))}
                          placeholder="Enter your Fluid API token"
                          required
                          disabled={isEditing}
                        />
                        <p className="text-sm text-gray-500 mt-1">
                          Generate your API token in the Fluid dashboard under API Tokens
                        </p>
                        <div className="mt-3 flex items-center space-x-3">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={testConnection}
                            disabled={isTestingConnection || !formData.fluidApiKey}
                          >
                            {isTestingConnection ? (
                              <>
                                <FontAwesomeIcon icon="spinner" spin className="mr-2" />
                                Testing...
                              </>
                            ) : (
                              <>
                                <FontAwesomeIcon icon="check-circle" className="mr-2" />
                                Test Connection
                              </>
                            )}
                          </Button>
                          {connectionStatus && (
                            <span className={`text-sm font-medium ${
                              connectionStatus.includes('✅') ? 'text-green-600' : 'text-red-600'
                            }`}>
                              {connectionStatus}
                            </span>
                          )}
                        </div>
            </div>
          </CardContent>
        </Card>

                  {/* Webhook Configuration */}
                  <Card className="group">
                    <CardHeader>
                      <CardTitle className="flex items-center text-lg">
                        <FontAwesomeIcon icon="cog" className="mr-3 h-5 w-5 text-blue-600" />
                        Webhook Configuration
                      </CardTitle>
                      <CardDescription className="text-gray-600 mt-2">
                        Optional: Configure where to send webhook notifications
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6 p-6">
                      <div className="form-group">
                        <label className="label">Webhook URL (Optional)</label>
                        <input
                          type="url"
                          className="input mt-1"
                          value={formData.webhookUrl || ''}
                          onChange={(e) => handleInputChange('webhookUrl', e.target.value)}
                          placeholder="https://your-company.com/webhooks/fluid"
                        />
                        <p className="text-sm text-gray-500 mt-1">
                          Where to send webhook notifications when events occur
                        </p>
                      </div>
                    </CardContent>
                  </Card>

          {/* Actions */}
          <div className="flex justify-end space-x-4 pt-8">
            {isEditing && (
              <Button 
                type="button" 
                variant="outline" 
                className="px-8"
                onClick={() => navigate(`/dashboard?installation_id=${installationId}&fluid_api_key=${formData.fluidApiKey}`)}
              >
                <FontAwesomeIcon icon="tachometer-alt" className="mr-2" />
                View Dashboard
              </Button>
            )}
            <Button type="button" variant="outline" className="px-8">
              Cancel
            </Button>
            {isEditing && (
              <Button 
                type="button" 
                variant="outline" 
                className="px-8 text-red-600 border-red-300 hover:bg-red-50"
                onClick={handleDisconnect}
              >
                <FontAwesomeIcon icon="unlink" className="mr-2" />
                Disconnect
              </Button>
            )}
            <Button type="submit" loading={isSubmitting} className="px-8">
              {isSubmitting 
                ? (isEditing ? 'Updating...' : 'Connecting...') 
                : (isEditing ? 'Update Configuration' : 'Connect')
              }
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
