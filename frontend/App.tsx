import { useEffect } from 'react'
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import { DropletAutoSetup } from '@/entrypoints/DropletAutoSetup'
import { DropletDashboard } from '@/entrypoints/DropletDashboard'

function App() {
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    // Only redirect if user is on the root path with no parameters
    if (location.pathname === '/' && !location.search) {
      // Check for existing session data
      const sessionKeys = Object.keys(localStorage).filter(key => key.startsWith('droplet_session_'))
      
      for (const key of sessionKeys) {
        try {
          const sessionData = JSON.parse(localStorage.getItem(key) || '{}')
          const sessionAge = Date.now() - new Date(sessionData.timestamp).getTime()
          const maxAge = 24 * 60 * 60 * 1000 // 24 hours
          
          if (sessionAge < maxAge && sessionData.installationId && sessionData.installationId !== 'new-installation' && sessionData.fluidApiKey) {
            // Redirect to dashboard with existing session data
            navigate(`/dashboard?installation_id=${sessionData.installationId}&fluid_api_key=${sessionData.fluidApiKey}`)
            return
          }
        } catch (e) {
          // Invalid session data, clean it up
          localStorage.removeItem(key)
        }
      }
    }
  }, [location, navigate])

  return (
    <div className="min-h-screen bg-white">
      <Routes>
        <Route path="/" element={<DropletAutoSetup />} />
        <Route path="/dashboard" element={<DropletDashboard />} />
      </Routes>
    </div>
  )
}

export default App
