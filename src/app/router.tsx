import { createBrowserRouter } from 'react-router'
import { features } from './features'
import { Home } from './Home'
import { Layout } from './Layout'
import { NotFound } from './NotFound'
import { FeatureAccess } from './FeatureAccess'

// Built from the feature list, so a new feature needs no change in this file.
export const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { index: true, element: <Home /> },
      ...features.flatMap((feature) =>
        feature.routes.map((route) =>
          feature.roles
            ? {
                ...route,
                element: <FeatureAccess roles={feature.roles}>{route.element}</FeatureAccess>,
              }
            : route,
        ),
      ),
      { path: '*', element: <NotFound /> },
    ],
  },
])
