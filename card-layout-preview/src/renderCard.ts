import type { TemplateSpec } from './types'
import { resolveImageSrc, type ImageResolutionContext } from './resolveImageSrc'

function textAlignCss(align: TemplateSpec['front']['text'][0]['align']): string {
  if (align === 'center') return 'center'
  if (align === 'trailing') return 'right'
  return 'left'
}

function justifyForAlign(align: TemplateSpec['front']['text'][0]['align']): string {
  if (align === 'center') return 'center'
  if (align === 'trailing') return 'flex-end'
  return 'flex-start'
}

function fontFamilyFromLabel(fontName: string): string {
  const parts = fontName.split('-').filter(Boolean)
  if (parts.length >= 2) {
    const style = parts.pop()!
    const family = parts.join(' ')
    return `"${family}", ${style}, system-ui, sans-serif`
  }
  return `"${fontName}", system-ui, sans-serif`
}

export function renderCard(
  root: HTMLElement,
  spec: TemplateSpec,
  imageCtx: ImageResolutionContext,
): void {
  root.replaceChildren()

  const page = document.createElement('div')
  page.className = 'preview-page'

  const meta = document.createElement('div')
  meta.className = 'preview-meta'
  meta.textContent = `${spec.width} × ${spec.height} pt · ${spec.front.images.length} image(s) · ${spec.front.text.length} text layer(s)`

  const card = document.createElement('div')
  card.className = 'card'
  card.style.width = `${spec.width}px`
  card.style.height = `${spec.height}px`

  const { images, text } = spec.front

  for (const img of images) {
    const wrap = document.createElement('div')
    wrap.className = 'card-image-wrap'
    wrap.style.left = `${img.x}px`
    wrap.style.top = `${img.y}px`
    wrap.style.width = `${img.width}px`
    wrap.style.height = `${img.height}px`
    wrap.title = img.name

    const el = document.createElement('img')
    el.className = 'card-image'
    el.alt = img.name
    el.src = resolveImageSrc(img.default, imageCtx)
    el.onerror = () => {
      wrap.classList.add('card-image-wrap--error')
    }
    wrap.appendChild(el)
    card.appendChild(wrap)
  }

  for (const t of text) {
    const el = document.createElement('div')
    el.className = 'card-text'
    el.textContent = t.default
    el.style.left = `${t.x}px`
    el.style.top = `${t.y}px`
    el.style.width = `${t.width}px`
    el.style.height = `${t.height}px`
    el.style.textAlign = textAlignCss(t.align)
    el.style.justifyContent = justifyForAlign(t.align)
    el.style.fontFamily = fontFamilyFromLabel(t.fontName)
    el.title = t.name
    if (t.fontSize !== 'mixed') {
      el.style.fontSize = `${t.fontSize}px`
    } else {
      el.style.fontSize = '16px'
    }
    card.appendChild(el)
  }

  page.appendChild(meta)
  page.appendChild(card)
  root.appendChild(page)
}
