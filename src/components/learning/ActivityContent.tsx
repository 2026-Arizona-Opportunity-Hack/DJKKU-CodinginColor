import Markdown from 'react-markdown'
import { ExternalLink } from 'lucide-react'

import { parseYouTubeId, youtubeEmbedUrl } from '@shared/authoring/schemas'

import { safeUrl } from './safeUrl'
import { VideoTranscript } from './VideoTranscript'
import { useYouTubePlayer } from './useYouTubePlayer'

/**
 * Privacy-enhanced YouTube embed (B8) with the real transcript (see VideoTranscript) and a plain link as fallbacks.
 * The embed URL is re-parsed with lane C's parser, so only https YouTube ids reach the iframe.
 */
export function VideoEmbed({ embedUrl, title, transcript }: { embedUrl: string; title: string; transcript?: string | null }) {
  const videoId = parseYouTubeId(embedUrl)
  if (!videoId) return <p>This video isn't available.</p>
  return <VideoPlayer videoId={videoId} title={title} transcript={transcript} />
}

function VideoPlayer({ videoId, title, transcript }: { videoId: string; title: string; transcript?: string | null }) {
  // The player reports where it is, so the transcript can follow along (see useYouTubePlayer).
  const { frame, onLoad, seek, timeMs, playing } = useYouTubePlayer()
  // enablejsapi lets the page read the time; origin restricts who may talk to the player.
  const src = `${youtubeEmbedUrl(videoId)}?rel=0&enablejsapi=1&origin=${encodeURIComponent(window.location.origin)}`
  return (
    <div className="flex flex-col gap-3">
      <div className="aspect-video w-full overflow-hidden rounded-lg bg-muted">
        <iframe
          ref={frame}
          onLoad={onLoad}
          className="size-full"
          src={src}
          title={`Video: ${title}`}
          loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
          // Fullscreen is granted by `allow`; adding allowFullScreen too makes browsers warn in the console.
          // autoplay: a timestamp in the transcript asks the player to play from that moment.
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
        />
      </div>
      <a
        className="inline-flex min-h-11 items-center gap-1 text-primary underline"
        href={`https://www.youtube.com/watch?v=${videoId}`}
        target="_blank"
        rel="noopener noreferrer"
      >
        Video not playing? Open it on YouTube <ExternalLink aria-hidden="true" className="size-4" />
        <span className="sr-only">(opens in a new tab)</span>
      </a>
      {/* The real transcript from the video's captions; the author's text is the fallback. */}
      <VideoTranscript videoId={videoId} fallback={transcript} timeMs={timeMs} playing={playing} onSeek={seek} />
    </div>
  )
}

/** Markdown with raw HTML off (skipHtml) and a strict link allow-list (B8). */
export function Reading({ markdown }: { markdown: string }) {
  return (
    <div className="flex flex-col gap-3 leading-relaxed [&_a]:text-primary [&_a]:underline [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:font-semibold [&_ol]:list-decimal [&_ol]:pl-6 [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-muted [&_pre]:p-3 [&_ul]:list-disc [&_ul]:pl-6">
      <Markdown skipHtml urlTransform={safeUrl}>
        {markdown}
      </Markdown>
    </div>
  )
}
