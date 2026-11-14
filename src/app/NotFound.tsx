import { Link } from 'react-router'

export function NotFound() {
  return (
    <section className="flex flex-col gap-2">
      <h1 className="text-2xl font-bold">Page not found</h1>
      <p>
        That page does not exist. <Link to="/" className="underline">Go to the home page</Link>.
      </p>
    </section>
  )
}
