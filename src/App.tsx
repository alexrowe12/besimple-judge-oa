import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from '@/components/ui/sonner'
import { ThemeProvider } from '@/components/theme/ThemeProvider'
import { AppLayout } from '@/components/layout/AppLayout'
import { DashboardPage } from '@/pages/DashboardPage'
import { SubmissionsPage } from '@/pages/SubmissionsPage'
import { JudgesPage } from '@/pages/JudgesPage'
import { QueuesPage } from '@/pages/QueuesPage'
import { RunEvaluationsPage } from '@/pages/RunEvaluationsPage'
import { ResultsPage } from '@/pages/ResultsPage'

const queryClient = new QueryClient()

function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<AppLayout />}>
              <Route index element={<DashboardPage />} />
              <Route path="submissions" element={<SubmissionsPage />} />
              <Route path="judges" element={<JudgesPage />} />
              <Route path="queues" element={<QueuesPage />} />
              <Route path="queues/:queueId" element={<QueuesPage />} />
              <Route path="queues/:queueId/run" element={<RunEvaluationsPage />} />
              <Route path="results" element={<ResultsPage />} />
            </Route>
          </Routes>
        </BrowserRouter>
        <Toaster />
      </QueryClientProvider>
    </ThemeProvider>
  )
}

export default App
