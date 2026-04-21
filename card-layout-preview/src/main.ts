import './style.css'
import { isTemplateSpec, type TemplateSpec } from './types'
import { renderCard } from './renderCard'
import type { ImageResolutionContext } from './resolveImageSrc'

const SAMPLE_URL = '/sample/template.json'

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (text !== undefined) node.textContent = text
  return node
}

function buildBlobMapFromDirectory(files: FileList): Map<string, string> {
  const map = new Map<string, string>()
  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    const rel = (file as File & { webkitRelativePath?: string }).webkitRelativePath
    if (!rel) continue
    const key = rel.replace(/\\/g, '/')
    map.set(key, URL.createObjectURL(file))
  }
  return map
}

/** Find JSON file in folder selection; prefer `template.json` then first `.json`. */
function pickJsonFile(files: FileList): File | null {
  const list: File[] = []
  for (let i = 0; i < files.length; i++) list.push(files[i])
  const jsonFiles = list.filter((f) => f.name.toLowerCase().endsWith('.json'))
  const preferred = jsonFiles.find((f) => f.name === 'template.json')
  return preferred ?? jsonFiles[0] ?? null
}

let lastRevoke: string[] = []

function revokePreviousBlobs(): void {
  for (const u of lastRevoke) URL.revokeObjectURL(u)
  lastRevoke = []
}

function mountApp(): void {
  const app = document.querySelector('#app')
  if (!app) return

  const shell = el('div', 'shell')
  shell.appendChild(el('h1', '', 'Card layout preview'))
  shell.appendChild(
    el(
      'p',
      'lede',
      'Load a TemplateSpec JSON (from figma-layer-inspector). Use https URLs as-is, or relative paths with the sample folder or a directory of assets.',
    ),
  )

  const toolbar = el('div', 'toolbar')

  const loadSampleBtn = el('button', 'btn btn-primary', 'Load sample')
  const jsonLabel = el('label', 'btn')
  jsonLabel.textContent = 'Open JSON…'
  const jsonInput = document.createElement('input')
  jsonInput.type = 'file'
  jsonInput.accept = 'application/json,.json'
  jsonLabel.appendChild(jsonInput)

  const dirLabel = el('label', 'btn')
  dirLabel.textContent = 'Open folder…'
  const dirInput = document.createElement('input')
  dirInput.type = 'file'
  ;(dirInput as HTMLInputElement).webkitdirectory = true
  dirLabel.appendChild(dirInput)

  toolbar.appendChild(loadSampleBtn)
  toolbar.appendChild(jsonLabel)
  toolbar.appendChild(dirLabel)

  shell.appendChild(toolbar)
  shell.appendChild(
    el(
      'p',
      'hint',
      'Tip: put template.json and images under public/sample/ and click Load sample, or choose a folder that contains your JSON and image files (paths in JSON relative to that folder).',
    ),
  )

  const errBox = el('div', 'err')
  errBox.style.display = 'none'
  shell.appendChild(errBox)

  const previewRoot = el('div', 'preview-root')
  shell.appendChild(previewRoot)

  app.appendChild(shell)

  function setError(message: string | null): void {
    if (!message) {
      errBox.style.display = 'none'
      errBox.textContent = ''
      return
    }
    errBox.style.display = 'block'
    errBox.textContent = message
  }

  function showParsed(spec: TemplateSpec, ctx: ImageResolutionContext): void {
    setError(null)
    renderCard(previewRoot, spec, ctx)
  }

  async function loadSample(): Promise<void> {
    revokePreviousBlobs()
    const res = await fetch(SAMPLE_URL)
    if (!res.ok) {
      setError(`Could not load ${SAMPLE_URL}`)
      return
    }
    const data: unknown = await res.json()
    if (!isTemplateSpec(data)) {
      setError('Invalid TemplateSpec JSON')
      return
    }
    const base = new URL(SAMPLE_URL, window.location.href)
    showParsed(data, {
      jsonDirectoryUrl: `${base.origin}${base.pathname.replace(/[^/]+$/, '')}`,
      blobUrlByRelativePath: new Map(),
    })
  }

  jsonInput.addEventListener('change', async () => {
    const file = jsonInput.files?.[0]
    jsonInput.value = ''
    if (!file) return
    revokePreviousBlobs()
    try {
      const text = await file.text()
      const data: unknown = JSON.parse(text)
      if (!isTemplateSpec(data)) {
        setError('Invalid TemplateSpec JSON')
        return
      }
      // Browsers do not expose a directory for a single picked file; use https URLs
      // in JSON or "Open folder" so relative image paths resolve.
      showParsed(data, {
        jsonDirectoryUrl: null,
        blobUrlByRelativePath: new Map(),
      })
    } catch {
      setError('Could not parse JSON file')
    }
  })

  dirInput.addEventListener('change', async () => {
    const files = dirInput.files
    dirInput.value = ''
    if (!files?.length) return
    revokePreviousBlobs()
    const jsonFile = pickJsonFile(files)
    if (!jsonFile) {
      setError('No .json file found in folder')
      return
    }
    const map = buildBlobMapFromDirectory(files)
    lastRevoke = [...map.values()]

    let jsonDir = (jsonFile as File & { webkitRelativePath?: string }).webkitRelativePath
    if (jsonDir) {
      const parts = jsonDir.replace(/\\/g, '/').split('/')
      parts.pop()
      jsonDir = parts.length ? parts.join('/') + '/' : ''
    } else {
      jsonDir = ''
    }

    const blobMap = new Map<string, string>()
    for (const [path, url] of map) {
      if (jsonDir && path.startsWith(jsonDir)) {
        blobMap.set(path.slice(jsonDir.length), url)
      } else {
        blobMap.set(path, url)
      }
    }

    try {
      const text = await jsonFile.text()
      const data: unknown = JSON.parse(text)
      if (!isTemplateSpec(data)) {
        setError('Invalid TemplateSpec JSON')
        return
      }
      showParsed(data, {
        jsonDirectoryUrl: null,
        blobUrlByRelativePath: blobMap,
      })
    } catch {
      setError('Could not parse JSON file')
    }
  })

  loadSampleBtn.addEventListener('click', () => {
    void loadSample()
  })

  void loadSample()
}

mountApp()
