import Markdown from 'react-markdown'
import { ExternalLink } from 'lucide-react'

import { YOUTUBE_ID } from '@/shared/content'

import { safeUrl } from '../safeUrl'

/** Privacy-enhanced YouTube embed (B8) with a transcript and a plain link as fallbacks. */
export function VideoEmbed({ youtubeId, title, transcript }: { youtubeId: string; title: string; transcript?: string }) {
  if (!YOUTUBE_ID.test(youtubeId)) return <p>This video isn't available.</p>
  return (
    <div className="flex flex-col gap-3">
      <div className="aspect-video w-full overflow-hidden rounded-lg bg-muted">
        <iframe
          className="size-full"
          src={`https://www.youtube-nocookie.com/embed/${youtubeId}?rel=0`}
          title={`Video: ${title}`}
          loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
          allow="encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
        />
      </div>
      <a
        className="inline-flex min-h-11 items-center gap-1 text-primary underline"
        href={`https://www.youtube.com/watch?v=${youtubeId}`}
        target="_blank"
        rel="noopener noreferrer"
      >
        Video not playing? Open it on YouTube <ExternalLink aria-hidden="true" className="size-4" />
        <span className="sr-only">(opens in a new tab)</span>
      </a>
      {transcript && (
        <details className="rounded-md border p-3">
          <summary className="min-h-11 cursor-pointer content-center font-medium">Read the transcript</summary>
          <p className="mt-2 whitespace-pre-line">{transcript}</p>
        </details>
      )}
    </div>
  )
}

/** Markdown with raw HTML off (skipHtml) and a strict link allow-list (B8). */
export function Reading({ markdown }: { markdown: string }) {
  return (
    <div className="prose-cic flex flex-col gap-3 leading-relaxed [&_a]:text-primary [&_a]:underline [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:font-semibold [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-muted [&_pre]:p-3 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6">
      <Markdown skipHtml urlTransform={safeUrl}>
        {markdown}
      </Markdown>
    </div>
  )
}
