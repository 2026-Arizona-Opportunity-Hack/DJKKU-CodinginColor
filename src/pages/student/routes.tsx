import type { RouteObject } from 'react-router'

import { StartPage } from './StartPage'

/** Lane B routes. Entry pages load eagerly (fast first paint); the rest split per route. */
export const studentRoutes: RouteObject[] = [
  { path: 'start', element: <StartPage /> },
  { path: 'c/:code', element: <StartPage /> },
  { path: 'join/:joinCode', lazy: () => import('./JoinPage').then((m) => ({ Component: m.JoinPage })) },
  { path: 'explore', lazy: () => import('./ExplorePage').then((m) => ({ Component: m.ExplorePage })) },
  { path: 'explore/save', lazy: () => import('./SaveProgressPage').then((m) => ({ Component: m.SaveProgressPage })) },
  { path: 'explore/a/:activityId', lazy: () => import('./GuestActivityPage').then((m) => ({ Component: m.GuestActivityPage })) },
  {
    path: 'learn',
    lazy: () => import('./LearnLayout').then((m) => ({ Component: m.LearnLayout })),
    children: [
      { index: true, lazy: () => import('./LearnHomePage').then((m) => ({ Component: m.LearnHomePage })) },
      { path: ':classId', lazy: () => import('./ClassPathPage').then((m) => ({ Component: m.ClassPathPage })) },
      { path: ':classId/progress', lazy: () => import('./ProgressPage').then((m) => ({ Component: m.ProgressPage })) },
      { path: ':classId/a/:activityId', lazy: () => import('./ActivityPage').then((m) => ({ Component: m.ActivityPage })) },
      { path: ':classId/test/:assessmentId', lazy: () => import('./AssessmentPage').then((m) => ({ Component: m.AssessmentPage })) },
    ],
  },
]
