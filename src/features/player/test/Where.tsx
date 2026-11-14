import { useLocation } from 'react-router'

/** Shows where the router ended up, for navigation assertions in tests. */
export function Where() {
  const loc = useLocation()
  return <p data-testid="location">{loc.pathname}</p>
}
