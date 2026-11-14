// Placeholder shown by each feature until its lane replaces it with the real
// screens. Delete a feature's use of this once the real page exists.
export function ComingSoon({
  title,
  lane,
  module,
}: {
  title: string
  lane: string
  module: string
}) {
  return (
    <section aria-labelledby="coming-soon-title" className="flex flex-col gap-2">
      <h1 id="coming-soon-title" className="text-2xl font-bold">
        {title}
      </h1>
      <p>
        Not built yet. Lane {lane}, module {module} in the design plan.
      </p>
    </section>
  )
}
