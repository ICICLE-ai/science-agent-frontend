"use client"

import { BrowserRouter as Router, Routes, Route } from "react-router-dom"
import TaskGallery from "./app/TaskGallery"
import TaskDetail from "./components/tasks/TaskDetail"
import Execution from "./app/Home"
import StorageBrowser from "./app/StorageBrowser"
import { ThemeProvider } from "./providers/ThemeProvider"
import { Toaster } from "@/components/ui/sonner"

function App() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <Router>
        <div className="min-h-screen overflow-x-hidden bg-background text-foreground">
          <Routes>
            <Route path="/" element={<Execution/>} />
            <Route path="/gallery" element={<TaskGallery />} />
            <Route path="/tasks/:id" element={<TaskDetail />} />
            <Route path="/storage" element={<StorageBrowser />} />
          </Routes>
        </div>
      </Router>
      <Toaster />
    </ThemeProvider>
  )
}

export default App
