import { RouterProvider } from 'react-router/dom'
import { router } from './router'

// App-wide providers (data cache, auth session) wrap the router here as they are added.
export default function App() {
  return <RouterProvider router={router} />
}
