import { Routes, Route } from 'react-router-dom'
import { DropletAutoSetup } from '@/entrypoints/DropletAutoSetup'
import { DropletSuccess } from '@/entrypoints/DropletSuccess'
import { DropletDashboard } from '@/entrypoints/DropletDashboard'

function App() {
  return (
    <div className="min-h-screen bg-white">
      <Routes>
        <Route path="/" element={<DropletAutoSetup />} />
        <Route path="/success" element={<DropletSuccess />} />
        <Route path="/dashboard" element={<DropletDashboard />} />
      </Routes>
    </div>
  )
}

export default App
