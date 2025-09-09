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
  // const companyId = searchParams.get('company_id') // Available for future use
  
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

  // Load company data on component mount
  useEffect(() => {
    const loadCompanyData = async () => {
      if (!installationId) {
        // If no installation ID, show basic form
        setCompanyData({
          companyName: 'Your Company',
          id: 'new-installation',
          status: 'pending'
        })
        setIsLoading(false)
        return
      }

      try {
        // Get installation status from backend
        const response = await apiClient.get(`/api/droplet/status/${installationId}`)
        setCompanyData(response.data.data)
        
        // Pre-fill company name if available
        if (response.data.data.companyName) {
          setFormData(prev => ({
            ...prev,
            companyName: response.data.data.companyName
          }))
        }
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
        installationId: installationId || 'new-installation'
      })

      if (response.data.success) {
        // Navigate to success page using React Router
        const finalInstallationId = installationId || response.data.installationId || 'new-installation'
        navigate(`/success?installation_id=${finalInstallationId}`)
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
            <p className="text-gray-600">Fetching your company information</p>
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
            Welcome{companyData?.companyName ? `, ${companyData.companyName}` : ''}!
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Configure your credentials to establish a secure connection
          </p>
          {companyData?.companyName && (
            <div className="mt-4 inline-flex items-center px-4 py-2 bg-primary-50 border border-primary-200 rounded-lg">
              <FontAwesomeIcon icon="building" className="text-primary-600 mr-2" />
              <span className="text-primary-800 font-medium">{companyData.companyName}</span>
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
                          className="input mt-1"
                          value={formData.fluidApiKey}
                          onChange={(e) => setFormData(prev => ({ ...prev, fluidApiKey: e.target.value }))}
                          placeholder="Enter your Fluid API token"
                          required
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
            <Button type="button" variant="outline" className="px-8">
              Cancel
            </Button>
            <Button type="submit" loading={isSubmitting} className="px-8">
              {isSubmitting ? 'Connecting...' : 'Connect'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
