import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Button } from '@/components/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/Card'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { apiClient } from '@/lib/api'

interface SetupStep {
  id: string
  title: string
  description: string
  completed: boolean
  inProgress: boolean
}

export function DropletSetup() {
  const [searchParams] = useSearchParams()
  const installationId = searchParams.get('installation_id')
  
  const [steps, setSteps] = useState<SetupStep[]>([
    {
      id: 'validate-credentials',
      title: 'Validate Credentials',
      description: 'Testing connection to your API and database',
      completed: false,
      inProgress: false,
    },
    {
      id: 'create-webhooks',
      title: 'Create Webhooks',
      description: 'Setting up webhook endpoints for real-time updates',
      completed: false,
      inProgress: false,
    },
    {
      id: 'sync-initial-data',
      title: 'Sync Initial Data',
      description: 'Importing your existing data into Fluid',
      completed: false,
      inProgress: false,
    },
    {
      id: 'configure-mappings',
      title: 'Configure Data Mappings',
      description: 'Mapping your data fields to Fluid standards',
      completed: false,
      inProgress: false,
    },
    {
      id: 'test-integration',
      title: 'Test Integration',
      description: 'Running final tests to ensure everything works',
      completed: false,
      inProgress: false,
    },
  ])

  const [isRunning, setIsRunning] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)
  const [setupData, setSetupData] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  // Load setup data on component mount
  useEffect(() => {
    const startSetup = async () => {
      if (!installationId) {
        setError('Missing installation ID')
        return
      }

      try {
        setIsRunning(true)
        const response = await apiClient.post('/api/droplet/setup', {
          installationId
        })
        
        setSetupData(response.data.data)
        
        // Update steps based on response
        if (response.data.data.steps) {
          setSteps(response.data.data.steps)
        }
        
        setIsRunning(false)
      } catch (err: any) {
        console.error('Setup failed:', err)
        setError(err.response?.data?.message || 'Setup failed')
        setIsRunning(false)
      }
    }

    startSetup()
  }, [installationId])

  const runSetup = async () => {
    setIsRunning(true)
    
    for (let i = 0; i < steps.length; i++) {
      setCurrentStep(i)
      
      // Update step to in progress
      setSteps(prev => prev.map((step, index) => 
        index === i ? { ...step, inProgress: true } : step
      ))
      
      // Simulate step execution
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      // Update step to completed
      setSteps(prev => prev.map((step, index) => 
        index === i ? { ...step, completed: true, inProgress: false } : step
      ))
    }
    
    setIsRunning(false)
  }

  const allStepsCompleted = steps.every(step => step.completed)

  if (error) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <div className="flex items-center">
            <FontAwesomeIcon icon="exclamation-triangle" className="text-red-600 mr-3" />
            <div>
              <h3 className="text-lg font-medium text-red-800">Setup Failed</h3>
              <p className="text-red-700 mt-1">{error}</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Setup Your Integration</h1>
        <p className="text-gray-600">We'll configure your droplet and test the connection</p>
        {setupData && (
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>Installation ID:</strong> {setupData.installationId}
            </p>
          </div>
        )}
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Setup Progress</CardTitle>
          <CardDescription>
            {allStepsCompleted 
              ? 'Setup completed successfully!' 
              : `Step ${currentStep + 1} of ${steps.length}`
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {steps.map((step, index) => (
              <div key={step.id} className="flex items-center space-x-3">
                <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                  step.completed 
                    ? 'bg-green-100 text-green-600' 
                    : step.inProgress 
                    ? 'bg-blue-100 text-blue-600' 
                    : 'bg-gray-100 text-gray-400'
                }`}>
                  {step.completed ? (
                    <FontAwesomeIcon icon="check" className="h-4 w-4" />
                  ) : step.inProgress ? (
                    <FontAwesomeIcon icon="spinner" className="h-4 w-4 animate-spin" />
                  ) : (
                    <span className="text-sm font-medium">{index + 1}</span>
                  )}
                </div>
                <div className="flex-1">
                  <h3 className={`text-sm font-medium ${
                    step.completed || step.inProgress ? 'text-gray-900' : 'text-gray-500'
                  }`}>
                    {step.title}
                  </h3>
                  <p className={`text-sm ${
                    step.completed || step.inProgress ? 'text-gray-600' : 'text-gray-400'
                  }`}>
                    {step.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {!allStepsCompleted && (
        <div className="flex justify-center">
          <Button 
            onClick={runSetup} 
            loading={isRunning}
            disabled={isRunning}
            size="lg"
          >
            {isRunning ? 'Setting up...' : 'Start Setup'}
          </Button>
        </div>
      )}

      {allStepsCompleted && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center text-green-600">
              <FontAwesomeIcon icon="check-circle" className="mr-2 h-5 w-5" />
              Setup Complete!
            </CardTitle>
            <CardDescription>
              Your integration is now active and ready to use
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Your droplet has been successfully configured and is now syncing data with the Fluid platform. 
                You can now use this integration in your workflows.
              </p>
              <div className="flex space-x-4">
                <Button variant="outline">
                  View Integration Details
                </Button>
                <Button>
                  Go to Dashboard
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
