import { Routes, Route } from 'react-router-dom'
import { DropletAutoSetup } from '@/entrypoints/DropletAutoSetup'
import { DropletConfig } from '@/entrypoints/DropletConfig'
import { DropletSetup } from '@/entrypoints/DropletSetup'
import { DropletSuccess } from '@/entrypoints/DropletSuccess'
import { DropletDashboard } from '@/entrypoints/DropletDashboard'
import DropletSettings from '@/entrypoints/DropletSettings'

function App() {
  return (
    <div className="min-h-screen bg-white">
      <Routes>
        <Route path="/" element={<DropletAutoSetup />} />
        <Route path="/config" element={<DropletConfig />} />
        <Route path="/setup" element={<DropletSetup />} />
        <Route path="/success" element={<DropletSuccess />} />
        <Route path="/dashboard" element={<DropletDashboard />} />
        <Route path="/settings" element={<DropletSettings />} />
      </Routes>
    </div>
  )
}

export default App
