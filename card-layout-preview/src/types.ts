/** Mirrors figma-layer-inspector `TemplateSpec` / `FrontSpec`. */

export type SpecImage = {
  name: string
  x: number
  y: number
  width: number
  height: number
  /** Placeholder URL from export, or a relative path / filename for local assets */
  default: string
}

export type SpecText = {
  name: string
  x: number
  y: number
  width: number
  height: number
  default: string
  maxLength: number
  fontName: string
  fontSize: number | 'mixed'
  align: 'leading' | 'center' | 'trailing'
}

export type FrontSpec = {
  images: SpecImage[]
  text: SpecText[]
}

export type TemplateSpec = {
  height: number
  width: number
  front: FrontSpec
}

export function isTemplateSpec(value: unknown): value is TemplateSpec {
  if (!value || typeof value !== 'object') return false
  const o = value as Record<string, unknown>
  if (typeof o.height !== 'number' || typeof o.width !== 'number') return false
  if (!o.front || typeof o.front !== 'object') return false
  const f = o.front as Record<string, unknown>
  if (!Array.isArray(f.images) || !Array.isArray(f.text)) return false
  return true
}
