import { describe, expect, it } from 'vitest'
import { SourceError } from './catalog'
import { decodeEntities, isoDuration, searchYouTube } from './youtube'

const search = (items: object[]) => Response.json({ items })
const videos = (items: object[]) => Response.json({ items })
const item = (id: string, title = 'Loops in Python', channel = 'Coder') => ({
  id: { kind: 'youtube#video', videoId: id },
  snippet: { title, description: 'A short lesson', channelTitle: channel, publishedAt: '2025-01-02T00:00:00Z', thumbnails: { medium: { url: `https://i.ytimg.com/vi/${id}/mqdefault.jpg` } } },
})

function fakeFetch(answers: { search: Response; videos?: Response }) {
  const urls: URL[] = []
  const f = (async (input: RequestInfo | URL) => {
    const url = new URL(String(input))
    urls.push(url)
    return url.pathname.endsWith('/search') ? answers.search : (answers.videos ?? videos([]))
  }) as typeof fetch
  return { f, urls }
}

const Q = { source: 'youtube' as const, query: 'for loops python', language: 'es', channelId: null, creativeCommonsOnly: false }

describe('searchYouTube', () => {
  it('asks for strict SafeSearch, embeddable videos only, in the chosen language', async () => {
    const { f, urls } = fakeFetch({ search: search([]) })
    await searchYouTube(f, 'yt-key', Q)
    const p = urls[0]!.searchParams
    expect(urls[0]!.origin + urls[0]!.pathname).toBe('https://www.googleapis.com/youtube/v3/search')
    expect(Object.fromEntries(p)).toEqual({
      part: 'snippet', type: 'video', q: 'for loops python', maxResults: '8', safeSearch: 'strict', videoEmbeddable: 'true', relevanceLanguage: 'es', key: 'yt-key',
    })
    expect(urls).toHaveLength(1) // no results, so no second call
  })

  it('limits a preset to its channel, and can ask for Creative Commons only', async () => {
    const { f, urls } = fakeFetch({ search: search([]) })
    await searchYouTube(f, 'k', { ...Q, source: 'freecodecamp', channelId: 'UC8butISFwT-Wl7EV0hUK0BQ', creativeCommonsOnly: true })
    expect(urls[0]!.searchParams.get('channelId')).toBe('UC8butISFwT-Wl7EV0hUK0BQ')
    expect(urls[0]!.searchParams.get('videoLicense')).toBe('creativeCommon')
  })

  it('adds length and license from one videos call, and drops videos that cannot be embedded', async () => {
    const { f, urls } = fakeFetch({
      search: search([item('aaaaaaaaaaa', 'Don&#39;t fear &quot;loops&quot; &amp; lists'), item('bbbbbbbbbbb'), { id: { kind: 'youtube#channel', channelId: 'x' } }]),
      videos: videos([
        { id: 'aaaaaaaaaaa', contentDetails: { duration: 'PT12M5S' }, status: { license: 'creativeCommon', embeddable: true } },
        { id: 'bbbbbbbbbbb', contentDetails: { duration: 'PT3M' }, status: { license: 'youtube', embeddable: false } },
      ]),
    })
    const results = await searchYouTube(f, 'k', Q)
    expect(urls[1]!.searchParams.get('id')).toBe('aaaaaaaaaaa,bbbbbbbbbbb')
    expect(urls[1]!.searchParams.get('part')).toBe('contentDetails,status')
    expect(results).toEqual([{
      source: 'youtube', kind: 'video', id: 'aaaaaaaaaaa', title: 'Don\'t fear "loops" & lists', url: 'https://www.youtube.com/watch?v=aaaaaaaaaaa',
      by: 'Coder', description: 'A short lesson', license: { id: 'CC-BY', name: 'Creative Commons (CC BY)', open: true }, durationS: 725, stars: null,
      thumbnail: 'https://i.ytimg.com/vi/aaaaaaaaaaa/mqdefault.jpg', publishedAt: '2025-01-02T00:00:00Z',
    }])
  })

  it('labels the standard license as embed only', async () => {
    const { f } = fakeFetch({ search: search([item('ccccccccccc')]), videos: videos([{ id: 'ccccccccccc', status: { license: 'youtube', embeddable: true } }]) })
    const [r] = await searchYouTube(f, 'k', Q)
    expect(r!.license).toEqual({ id: 'youtube', name: 'Standard YouTube license (embed only)', open: false })
    expect(r!.durationS).toBeNull()
  })

  it('says "quota" when the daily searches are spent, and "unavailable" for anything else', async () => {
    const quota = new Response(JSON.stringify({ error: { errors: [{ reason: 'quotaExceeded' }] } }), { status: 403 })
    await expect(searchYouTube(fakeFetch({ search: quota }).f, 'k', Q)).rejects.toEqual(new SourceError('quota'))
    const bad = new Response(JSON.stringify({ error: { errors: [{ reason: 'keyInvalid' }] } }), { status: 400 })
    await expect(searchYouTube(fakeFetch({ search: bad }).f, 'k', Q)).rejects.toMatchObject({ code: 'unavailable' })
    const offline = (async () => { throw new TypeError('network') }) as typeof fetch
    await expect(searchYouTube(offline, 'k', Q)).rejects.toMatchObject({ code: 'unavailable' })
  })
})

describe('helpers', () => {
  it('reads ISO 8601 durations', () => {
    expect(isoDuration('PT1H2M3S')).toBe(3723)
    expect(isoDuration('PT45S')).toBe(45)
    expect(isoDuration('P1DT1M')).toBe(86460)
    expect(isoDuration('P0D')).toBeNull() // a live stream
    expect(isoDuration(undefined)).toBeNull()
    expect(isoDuration('soon')).toBeNull()
  })

  it('decodes the HTML escapes YouTube uses, once', () => {
    expect(decodeEntities('Tom &amp; Jerry &lt;3 &#39;x&#39; &#x2F;')).toBe("Tom & Jerry <3 'x' /")
    expect(decodeEntities('&amp;lt;')).toBe('&lt;')
  })
})
