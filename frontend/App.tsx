import { useEffect } from 'react'
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import { DropletAutoSetup } from '@/entrypoints/DropletAutoSetup'
import { DropletDashboard } from '@/entrypoints/DropletDashboard'
import { DropletUninstall } from '@/entrypoints/DropletUninstall'

function App() {
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    // Only redirect if user is on the root path with no parameters
    if (location.pathname === '/' && !location.search) {
      // Check for existing session data and validate it's still valid
      const sessionKeys = Object.keys(localStorage).filter(key => key.startsWith('droplet_session_'))
      
      const validateAndRedirect = async () => {
        for (const key of sessionKeys) {
          try {
            const sessionData = JSON.parse(localStorage.getItem(key) || '{}')
            const sessionAge = Date.now() - new Date(sessionData.timestamp).getTime()
            const maxAge = 24 * 60 * 60 * 1000 // 24 hours
            
            if (sessionAge < maxAge && sessionData.installationId && sessionData.installationId !== 'new-installation' && sessionData.fluidApiKey) {
              // Validate installation still exists before redirecting
              try {
                const response = await fetch(`/api/droplet/status/${sessionData.installationId}?fluidApiKey=${sessionData.fluidApiKey}`)
                if (response.ok) {
                  // Installation exists, safe to redirect
                  navigate(`/dashboard?installation_id=${sessionData.installationId}&fluid_api_key=${sessionData.fluidApiKey}`)
                  return
                } else {
                  // Installation no longer exists, clean up localStorage
                  localStorage.removeItem(key)
                }
              } catch (err) {
                // API error, clean up localStorage
                localStorage.removeItem(key)
              }
            } else {
              // Expired or invalid session
              localStorage.removeItem(key)
            }
          } catch (e) {
            // Invalid session data, clean it up
            localStorage.removeItem(key)
          }
        }
      }

      validateAndRedirect()
    }
  }, [location, navigate])

  return (
    <div className="min-h-screen bg-white">
      <Routes>
        <Route path="/" element={<DropletAutoSetup />} />
        <Route path="/dashboard" element={<DropletDashboard />} />
        <Route path="/uninstall" element={<DropletUninstall />} />
      </Routes>
    </div>
  )
}

export default App
