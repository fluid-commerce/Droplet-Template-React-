import React, { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Button } from '../components/Button'
import { Card } from '../components/Card'
import { dropletsClient } from '../lib/dropletsClient'

interface SettingsData {
  companyName: string
  companyLogo?: string
  installationId: string
  environment: string
  webhookUrl: string
  fluidApiKey: string
  lastUpdated: string
  status: string
}

export default function DropletSettings() {
  const [searchParams] = useSearchParams()
  const installationId = searchParams.get('installationId') || ''
  const fluidApiKey = searchParams.get('fluidApiKey') || ''
  const [settings, setSettings] = useState<SettingsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  
  // Form state
  const [webhookUrl, setWebhookUrl] = useState('')
  const [environment, setEnvironment] = useState('production')

  useEffect(() => {
    loadSettings()
  }, [installationId, fluidApiKey])

  const loadSettings = async () => {
    try {
      setLoading(true)
      setError('')
      
      const response = await dropletsClient.getSettings(installationId, fluidApiKey)
      
      if (response.success && response.data) {
        setSettings(response.data)
        setWebhookUrl(response.data.webhookUrl || '')
        setEnvironment(response.data.environment || 'production')
      } else {
        setError('Failed to load settings')
      }
    } catch (err: any) {
      console.error('Settings load error:', err)
      setError(err.message || 'Failed to load settings')
    } finally {
      setLoading(false)
    }
  }

  const saveSettings = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      setSaving(true)
      setError('')
      setSuccess('')
      
      const response = await dropletsClient.updateSettings(installationId, {
        fluidApiKey,
        webhookUrl: webhookUrl.trim(),
        environment
      })
      
      if (response.success) {
        setSuccess('Settings updated successfully!')
        await loadSettings() // Refresh the data
      } else {
        setError(response.message || 'Failed to update settings')
      }
    } catch (err: any) {
      console.error('Settings save error:', err)
      setError(err.message || 'Failed to update settings')
    } finally {
      setSaving(false)
    }
  }

  const testConnection = async () => {
    try {
      setError('')
      setSuccess('')
      
      const response = await dropletsClient.testConnection(fluidApiKey)
      
      if (response.success) {
        setSuccess('Connection test successful!')
      } else {
        setError(response.message || 'Connection test failed')
      }
    } catch (err: any) {
      console.error('Connection test error:', err)
      setError(err.message || 'Connection test failed')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading settings...</p>
        </div>
      </div>
    )
  }

  if (!settings) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="max-w-md w-full mx-4">
          <div className="text-center p-6">
            <div className="text-red-500 mb-4">
              <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.664-.833-2.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Settings Not Found</h2>
            <p className="text-gray-600 mb-4">Unable to load settings for this installation.</p>
            <Button onClick={loadSettings} variant="primary">
              Retry
            </Button>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto py-8 px-4">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center space-x-4 mb-4">
            {settings.companyLogo && (
              <img 
                src={settings.companyLogo} 
                alt={settings.companyName}
                className="w-12 h-12 rounded-lg object-cover"
              />
            )}
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{settings.companyName}</h1>
              <p className="text-gray-600">Droplet Settings</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-4 text-sm text-gray-600">
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
              settings.status === 'active' 
                ? 'bg-green-100 text-green-800' 
                : 'bg-gray-100 text-gray-800'
            }`}>
              {settings.status}
            </span>
            <span>Installation: {settings.installationId}</span>
            <span>Last updated: {new Date(settings.lastUpdated).toLocaleDateString()}</span>
          </div>
        </div>

        {/* Alert Messages */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
            {error}
          </div>
        )}
        
        {success && (
          <div className="mb-6 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-md">
            {success}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Configuration Settings */}
          <Card>
            <div className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Configuration Settings</h2>
              
              <form onSubmit={saveSettings} className="space-y-4">
                <div>
                  <label htmlFor="environment" className="block text-sm font-medium text-gray-700 mb-1">
                    Environment
                  </label>
                  <select
                    id="environment"
                    value={environment}
                    onChange={(e) => setEnvironment(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="production">Production</option>
                    <option value="staging">Staging</option>
                    <option value="development">Development</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="webhookUrl" className="block text-sm font-medium text-gray-700 mb-1">
                    Webhook URL
                  </label>
                  <input
                    type="url"
                    id="webhookUrl"
                    value={webhookUrl}
                    onChange={(e) => setWebhookUrl(e.target.value)}
                    placeholder="https://your-app.com/webhooks/fluid"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Optional: Receive webhook notifications for Fluid events
                  </p>
                </div>

                <div className="flex space-x-3 pt-4">
                  <Button 
                    type="submit" 
                    variant="primary" 
                    disabled={saving}
                    className="flex-1"
                  >
                    {saving ? 'Saving...' : 'Save Settings'}
                  </Button>
                  <Button 
                    type="button" 
                    variant="secondary" 
                    onClick={loadSettings}
                    disabled={saving}
                  >
                    Reset
                  </Button>
                </div>
              </form>
            </div>
          </Card>

          {/* Connection Info */}
          <Card>
            <div className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Connection Information</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Fluid API Key
                  </label>
                  <div className="flex">
                    <input
                      type="password"
                      value={settings.fluidApiKey}
                      readOnly
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-l-md bg-gray-50 text-gray-500"
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={testConnection}
                      className="rounded-l-none border-l-0"
                    >
                      Test
                    </Button>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    API key used to authenticate with Fluid platform
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Installation ID
                  </label>
                  <input
                    type="text"
                    value={settings.installationId}
                    readOnly
                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Unique identifier for this droplet installation
                  </p>
                </div>
              </div>
            </div>
          </Card>

          {/* Advanced Settings */}
          <Card className="lg:col-span-2">
            <div className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Advanced Settings</h2>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-md">
                  <div>
                    <h3 className="font-medium text-gray-900">Data Synchronization</h3>
                    <p className="text-sm text-gray-600">Automatically sync data with Fluid platform</p>
                  </div>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      // Trigger sync - implementation would go here
                    }}
                  >
                    Sync Now
                  </Button>
                </div>

                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-md">
                  <div>
                    <h3 className="font-medium text-gray-900">Reset Configuration</h3>
                    <p className="text-sm text-gray-600">Reset all settings to default values</p>
                  </div>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      if (window.confirm('Are you sure you want to reset all settings? This action cannot be undone.')) {
                        // Reset logic would go here
                      }
                    }}
                  >
                    Reset
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}