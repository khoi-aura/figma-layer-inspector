/**
 * Resolve `default` image reference:
 * - `http(s):` → unchanged
 * - Otherwise → relative to json base URL, or lookup in optional file map (folder picker)
 */

export type ImageResolutionContext = {
  /** Base URL for the JSON file directory, e.g. `http://localhost:5180/sample/` */
  jsonDirectoryUrl: string | null
  /** Map from normalized relative path (e.g. `photo.png`, `assets/a.png`) to object URL */
  blobUrlByRelativePath: Map<string, string>
}

function normalizeRelativeKey(raw: string): string {
  let s = raw.trim()
  if (s.startsWith('./')) s = s.slice(2)
  return s.replace(/\\/g, '/')
}

export function resolveImageSrc(
  defaultRef: string,
  ctx: ImageResolutionContext,
): string {
  const ref = defaultRef.trim()
  if (/^https?:\/\//i.test(ref)) {
    return ref
  }

  const key = normalizeRelativeKey(ref)
  const fromMap = ctx.blobUrlByRelativePath.get(key)
  if (fromMap) return fromMap

  if (ctx.jsonDirectoryUrl) {
    try {
      return new URL(ref, ctx.jsonDirectoryUrl).href
    } catch {
      return ref
    }
  }

  return ref
}
