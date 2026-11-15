import { Link } from 'react-router'

/**
 * `/privacy`: plain-language privacy notice (SECURITY_QA_CHECKLIST S-61). Written for students, families
 * and teachers. Not legal advice: Coding in Color confirms it with counsel before launch.
 */
export function Privacy() {
  return (
    <article aria-labelledby="privacy-title" className="mx-auto flex max-w-prose flex-col gap-6">
      <h1 id="privacy-title" className="text-3xl font-bold">Privacy</h1>
      <p className="text-lg">
        Coding in Color Learn is a free learning site run by Coding in Color, a nonprofit. Teachers and schools decide to
        use it with their classes. We collect as little as we can about students, and we never sell it.
      </p>

      <section aria-labelledby="p-collect" className="flex flex-col gap-2">
        <h2 id="p-collect" className="text-xl font-semibold">What we keep about students</h2>
        <ul className="list-disc pl-6">
          <li>A display name, like "Maya R.", so the teacher can recognize them.</li>
          <li>Their school and class.</li>
          <li>Their answers, scores, time spent and which activities they finished.</li>
          <li>Notes they choose to write in My notebook. Only the student can read those.</li>
        </ul>
        <p>
          We do <strong>not</strong> ask students for an email, password, phone number, birth date, address, photo or
          location. Students sign in with a code from their teacher.
        </p>
      </section>

      <section aria-labelledby="p-why" className="flex flex-col gap-2">
        <h2 id="p-why" className="text-xl font-semibold">Why, and who can see it</h2>
        <ul className="list-disc pl-6">
          <li>Students see their own work and progress.</li>
          <li>Their teacher sees the students in classes they teach, to help them.</li>
          <li>Coding in Color staff see it to run the program and report results to funders. Reports only show
            totals for groups of 5 or more students, never names.</li>
          <li>Nobody else. There are no ads, no tracking and no selling of data.</li>
        </ul>
      </section>

      <section aria-labelledby="p-services" className="flex flex-col gap-2">
        <h2 id="p-services" className="text-xl font-semibold">Services we use</h2>
        <ul className="list-disc pl-6">
          <li><strong>Supabase</strong> stores the data. <strong>Cloudflare</strong> hosts the site.</li>
          <li><strong>YouTube (privacy-enhanced mode)</strong> plays lesson videos.</li>
          <li><strong>Google</strong> signs in teachers and staff. Students do not use Google to sign in.</li>
          <li>If AI hints are turned on, the question and the student's answer are sent to an AI service without a name
            or any id that identifies the student.</li>
        </ul>
      </section>

      <section aria-labelledby="p-keep" className="flex flex-col gap-2">
        <h2 id="p-keep" className="text-xl font-semibold">How long we keep it, and deleting it</h2>
        <p>
          We plan to delete student data 12 months after a class ends. A student, family or teacher can ask us to delete a
          student's data sooner, and we will. Ask the teacher, or contact Coding in Color.
        </p>
      </section>

      <section aria-labelledby="p-contact" className="flex flex-col gap-2">
        <h2 id="p-contact" className="text-xl font-semibold">Questions</h2>
        <p>
          Ask your teacher first. You can also reach Coding in Color through{' '}
          <a className="text-primary underline" href="https://www.ohack.dev/nonprofit/YIXYdYCoxIZC08uQ5DL3" rel="noopener noreferrer">their nonprofit page</a>.
          How we protect data is described in more detail in our{' '}
          <a className="text-primary underline" href="https://github.com/2026-Arizona-Opportunity-Hack/DJKKU-CodinginColor/blob/main/SECURITY.md" rel="noopener noreferrer">security notes</a>.
        </p>
        <p className="text-sm text-muted-foreground">This notice is in plain language and is not legal advice. Coding in Color confirms it with counsel.</p>
      </section>
      <Link to="/" className="text-primary underline">Back to the home page</Link>
    </article>
  )
}
