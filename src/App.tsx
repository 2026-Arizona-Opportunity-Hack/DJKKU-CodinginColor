import { useState } from 'react'
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query'
import { createBrowserRouter, Navigate, RouterProvider, type RouteObject } from 'react-router'

import { PageSkeleton } from '@/components/states'
import { RouteError } from '@/components/states/RouteError'
import type { StudentApi } from '@/features/student/api'
import { StudentApiProvider } from '@/features/student/apiContext'
import { studentRoutes } from '@/pages/student/routes'

/**
 * The route table. Each lane adds its routes in its own slot; keep paths distinct.
 * Every route shares one error boundary (RouteError) that logs and offers a way out.
 */
const routes: RouteObject[] = [
  {
    path: '/',
    errorElement: <RouteError />,
    hydrateFallbackElement: <PageSkeleton />,
    children: [
      { index: true, element: <Navigate to="/start" replace /> },

      // Lane B: student experience (/start, /c, /join, /explore, /learn)
      ...studentRoutes,

      // Lane C: authoring studio routes go here (e.g. /studio/...)
      // Lane D: instructor and admin dashboards go here (e.g. /teach/..., /admin/...)
      // Lane E: reviewer view goes here (e.g. /review/...)

      { path: '*', element: <RouteError notFound /> },
    ],
  },
]

export function App({ api, queryClient }: { api: StudentApi; queryClient: QueryClient }) {
  const [router] = useState(() => createBrowserRouter(routes))
  return (
    <QueryClientProvider client={queryClient}>
      <StudentApiProvider value={api}>
        <RouterProvider router={router} />
      </StudentApiProvider>
    </QueryClientProvider>
  )
}
