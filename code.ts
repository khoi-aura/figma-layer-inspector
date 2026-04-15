/**
 * Lists and inspects layer trees for any selected nodes (frames, groups, components, etc.).
 * See https://developers.figma.com/docs/plugins/plugin-quickstart-guide/
 */

const INITIAL_WIDTH = 460
const INITIAL_HEIGHT = 560
const MIN_WIDTH = 360
const MIN_HEIGHT = 320

figma.showUI(__html__, {
  width: INITIAL_WIDTH,
  height: INITIAL_HEIGHT,
  themeColors: true,
})

function roundCoord(n: number): number {
  return Math.round(n * 1000) / 1000
}

type LayerNode = {
  name: string
  type: string
  visible: boolean
  locked: boolean
  /** Position of this node's origin relative to the parent's top-left */
  x?: number
  y?: number
  /** Pixel size when the node exposes layout dimensions */
  width?: number
  height?: number
  /** Text details when this node is a text layer */
  text?: string
  fontName?: string
  fontSize?: number | 'mixed'
  children?: LayerNode[]
}

type SpecImage = {
  name: string
  x: number
  y: number
  width: number
  height: number
  default: string
}

type SpecText = {
  name: string
  x: number
  y: number
  width: number
  height: number
  default: string
  maxLength: number
  fontName: string
  fontSize: number | 'mixed'
}

type FrontSpec = {
  images: SpecImage[]
  text: SpecText[]
}

type TemplateSpec = {
  height: number
  width: number
  front: FrontSpec
}

function hasImageFill(node: SceneNode): boolean {
  if (!('fills' in node)) return false
  const fillsValue = node.fills
  if (fillsValue === figma.mixed || !Array.isArray(fillsValue)) return false
  return fillsValue.some((paint) => paint.type === 'IMAGE')
}

function toFontLabel(font: FontName | PluginAPI['mixed']): string {
  if (font === figma.mixed) return 'mixed'
  return `${font.family}-${font.style}`.replace(/\s+/g, '')
}

function makeImageDefault(width: number, height: number): string {
  const safeW = Math.max(1, Math.round(width))
  const safeH = Math.max(1, Math.round(height))
  return `https://placehold.net/shape-${safeW}x${safeH}.png`
}

function traverseForSpec(
  node: SceneNode,
  offsetX: number,
  offsetY: number,
  front: FrontSpec,
): void {
  let nextOffsetX = offsetX
  let nextOffsetY = offsetY
  if ('x' in node && 'y' in node) {
    const layout = node as LayoutMixin
    nextOffsetX += layout.x
    nextOffsetY += layout.y
  }

  if ('width' in node && 'height' in node) {
    const layout = node as LayoutMixin
    const width = roundCoord(layout.width)
    const height = roundCoord(layout.height)
    const x = roundCoord(nextOffsetX)
    const y = roundCoord(nextOffsetY)

    if (hasImageFill(node)) {
      front.images.push({
        name: node.name,
        x,
        y,
        width,
        height,
        default: makeImageDefault(width, height),
      })
    }

    if (node.type === 'TEXT') {
      front.text.push({
        name: node.name,
        x,
        y,
        width,
        height,
        default: node.characters,
        maxLength: node.characters.length,
        fontName: toFontLabel(node.fontName),
        fontSize:
          node.fontSize === figma.mixed ? 'mixed' : roundCoord(node.fontSize),
      })
    }
  }

  if ('children' in node) {
    const parent = node as ChildrenMixin
    for (const child of parent.children) {
      traverseForSpec(child, nextOffsetX, nextOffsetY, front)
    }
  }
}

function buildTemplateSpec(root: SceneNode): TemplateSpec | null {
  if (!('width' in root && 'height' in root)) return null
  const layout = root as LayoutMixin
  const front: FrontSpec = { images: [], text: [] }
  if ('children' in root) {
    const parent = root as ChildrenMixin
    for (const child of parent.children) {
      traverseForSpec(child, 0, 0, front)
    }
  } else {
    traverseForSpec(root, 0, 0, front)
  }
  return {
    height: roundCoord(layout.height),
    width: roundCoord(layout.width),
    front,
  }
}

function sceneNodeToLayer(node: SceneNode): LayerNode {
  const row: LayerNode = {
    name: node.name,
    type: node.type,
    visible: node.visible,
    locked: node.locked,
  }
  if ('x' in node && 'y' in node) {
    const box = node as LayoutMixin
    row.x = roundCoord(box.x)
    row.y = roundCoord(box.y)
  }
  if ('width' in node && 'height' in node) {
    const box = node as LayoutMixin
    row.width = roundCoord(box.width)
    row.height = roundCoord(box.height)
  }
  if (node.type === 'TEXT') {
    row.text = node.characters
    if (node.fontName !== figma.mixed) {
      row.fontName = `${node.fontName.family} ${node.fontName.style}`
    } else {
      row.fontName = 'mixed'
    }
    if (node.fontSize !== figma.mixed) {
      row.fontSize = roundCoord(node.fontSize)
    } else {
      row.fontSize = 'mixed'
    }
  }
  if ('children' in node) {
    const parent = node as ChildrenMixin
    const kids = parent.children
    if (kids.length > 0) {
      row.children = kids.map(sceneNodeToLayer)
    }
  }
  return row
}

type ScanOk = {
  ok: true
  notice?: string
  struct?: TemplateSpec | null
  roots: Array<{
    rootName: string
    rootType: string
    layers: LayerNode
  }>
}

type ScanErr = { ok: false; message: string }

function buildLayerTree(selection: readonly SceneNode[]): ScanOk | ScanErr {
  if (selection.length === 0) {
    return {
      ok: false,
      message: 'Select one or more layers on the canvas, then refresh.',
    }
  }
  const roots = selection.map((node) => ({
    rootName: node.name,
    rootType: node.type,
    layers: sceneNodeToLayer(node),
  }))
  const struct =
    selection.length >= 1 ? buildTemplateSpec(selection[0]) : null
  const notice =
    selection.length > 1
      ? 'Struct tab uses the first selected layer as the root.'
      : undefined
  return { ok: true, roots, struct, notice }
}

figma.ui.onmessage = (
  msg:
    | { type: 'scan' }
    | { type: 'close' }
    | { type: 'resize-ui'; width: number; height: number },
) => {
  if (msg.type === 'scan') {
    const result = buildLayerTree(figma.currentPage.selection)
    figma.ui.postMessage({ type: 'scan-result', result })
    return
  }
  if (msg.type === 'resize-ui') {
    const width = Math.max(MIN_WIDTH, Math.round(msg.width))
    const height = Math.max(MIN_HEIGHT, Math.round(msg.height))
    figma.ui.resize(width, height)
    return
  }
  if (msg.type === 'close') {
    figma.closePlugin()
  }
}
