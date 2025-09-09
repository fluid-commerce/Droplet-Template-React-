import { Routes, Route } from 'react-router-dom'
import { DropletConfig } from '@/entrypoints/DropletConfig'
import { DropletSetup } from '@/entrypoints/DropletSetup'
import { DropletSuccess } from '@/entrypoints/DropletSuccess'
import { DropletDashboard } from '@/entrypoints/DropletDashboard'

function App() {
  return (
    <div className="min-h-screen bg-white">
      <Routes>
        <Route path="/" element={<DropletConfig />} />
        <Route path="/setup" element={<DropletSetup />} />
        <Route path="/success" element={<DropletSuccess />} />
        <Route path="/dashboard" element={<DropletDashboard />} />
      </Routes>
    </div>
  )
}

export default App
