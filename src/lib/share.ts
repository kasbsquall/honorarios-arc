const STUDIO_ORIGIN = 'https://studio.arc.io'
const HANDSHAKE_TIMEOUT_MS = 1500
const trimSlash = (url: string) => url.replace(/\/+$/, '')

/**
 * Pure helper — given an origin and pathname, build the deploy base.
 * Works at root ("/") and under a GitHub Pages sub-path ("/honorarios/").
 * Drops a trailing "index.html" if present, then trims any trailing slash.
 *
 * Examples:
 *   ("https://host", "/")                    → "https://host"
 *   ("https://host", "/honorarios/")         → "https://host/honorarios"
 *   ("https://host", "/honorarios/index.html")→ "https://host/honorarios"
 */
export function buildOwnBase(origin: string, pathname: string): string {
  const path = pathname
    .replace(/\/index\.html$/, '') // strip trailing index.html
    .replace(/\/+$/, '')           // strip trailing slashes
  return origin + path
}

export function ownBase(): string {
  return buildOwnBase(window.location.origin, window.location.pathname)
}

let cached: Promise<string> | undefined

export function getShareBase(): Promise<string> {
  if (window.self === window.top) return Promise.resolve(ownBase())
  cached ??= new Promise<string>((resolve) => {
    const finish = (url: string) => {
      window.removeEventListener('message', onMessage)
      clearTimeout(timer)
      resolve(url)
    }
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== STUDIO_ORIGIN || event.source !== window.parent) return
      const data = event.data as { type?: string; url?: unknown } | null
      if (data?.type === 'arc-share:url' && typeof data.url === 'string')
        finish(trimSlash(data.url))
    }
    const timer = setTimeout(() => finish(ownBase()), HANDSHAKE_TIMEOUT_MS)
    window.addEventListener('message', onMessage)
    window.parent.postMessage({ type: 'arc-share:hello' }, STUDIO_ORIGIN)
  })
  return cached
}

export async function buildShareLink(path: string): Promise<string> {
  return (await getShareBase()) + (path.startsWith('/') ? path : `/${path}`)
}
