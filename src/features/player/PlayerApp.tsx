import { Suspense, use, useEffect } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { Link, Route, Routes } from 'react-router'

import { Button } from '@/components/ui/button'
import { installGlobalErrorHandlers, log } from '@/lib/log'

import type { StudentApi } from './api'
import { StudentApiProvider } from './apiContext'
import { ErrorState, PageSkeleton } from './components/states'
import { env } from './env'
import { loadStudentApi } from './loadApi'
import { paths } from './outline'
import { NotebookPage } from './pages/NotebookPage'
import { ActivityPage } from './pages/ActivityPage'
import { AssessmentPage } from './pages/AssessmentPage'
import { CertificatePage } from './pages/CertificatePage'
import { ClassPathPage } from './pages/ClassPathPage'
import { ExplorePage } from './pages/ExplorePage'
import { GuestActivityPage } from './pages/GuestActivityPage'
import { LearnHomePage } from './pages/LearnHomePage'
import { LearnLayout } from './pages/LearnLayout'
import { ProgressPage } from './pages/ProgressPage'
import { SaveProgressPage } from './pages/SaveProgressPage'
import { createQueryClient } from './queryClient'

// One data source and one query cache for the player, created once per page load.
// (When lane E adds an app-wide QueryClientProvider, the player can use that instead.)
let apiPromise: Promise<StudentApi> | undefined
const queryClient = createQueryClient()

/**
 * Everything lane B serves under /learn/*. Mounted lazily by the `player` feature, so
 * none of this code loads until a student opens /learn.
 */
export default function PlayerApp() {
  apiPromise ??= loadStudentApi(env).then((api) => {
    log.info('app.start', { dataSource: api.source, hints: env.hintsEnabled })
    return api
  })
  useEffect(() => installGlobalErrorHandlers(), [])

  return (
    <QueryClientProvider client={queryClient}>
      <Suspense fallback={<PageSkeleton />}>
        <PlayerRoutes apiPromise={apiPromise} />
      </Suspense>
    </QueryClientProvider>
  )
}

function PlayerRoutes({ apiPromise }: { apiPromise: Promise<StudentApi> }) {
  const api = use(apiPromise)
  return (
    <StudentApiProvider value={api}>
      <Routes>
        <Route path="explore" element={<ExplorePage />} />
        <Route path="explore/save" element={<SaveProgressPage />} />
        <Route path="explore/a/:activityId" element={<GuestActivityPage />} />
        <Route element={<LearnLayout />}>
          <Route index element={<LearnHomePage />} />
          <Route path=":classId" element={<ClassPathPage />} />
          <Route path=":classId/progress" element={<ProgressPage />} />
          <Route path=":classId/certificate/:moduleIndex" element={<CertificatePage />} />
          <Route path=":classId/notebook" element={<NotebookPage />} />
          <Route path=":classId/a/:activityId" element={<ActivityPage />} />
          <Route path=":classId/test/:assessmentId" element={<AssessmentPage />} />
        </Route>
        <Route path="*" element={<PlayerNotFound />} />
      </Routes>
    </StudentApiProvider>
  )
}

function PlayerNotFound() {
  return (
    <ErrorState title="Page not found" message="That link doesn't go anywhere.">
      <Button asChild variant="secondary">
        <Link to={paths.home}>Go to Start here</Link>
      </Button>
    </ErrorState>
  )
}
