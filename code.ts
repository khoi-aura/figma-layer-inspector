/**
 * Lists and inspects layer trees for any selected nodes (frames, groups, components, etc.).
 * See https://developers.figma.com/docs/plugins/plugin-quickstart-guide/
 */

figma.showUI(__html__, { width: 460, height: 560, themeColors: true })

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
  return { ok: true, roots }
}

figma.ui.onmessage = (msg: { type: string }) => {
  if (msg.type === 'scan') {
    const result = buildLayerTree(figma.currentPage.selection)
    figma.ui.postMessage({ type: 'scan-result', result })
    return
  }
  if (msg.type === 'close') {
    figma.closePlugin()
  }
}
