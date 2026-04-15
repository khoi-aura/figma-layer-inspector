/**
 * Lists and inspects layer trees for any selected nodes (frames, groups, components, etc.).
 * See https://developers.figma.com/docs/plugins/plugin-quickstart-guide/
 */

figma.showUI(__html__, { width: 460, height: 560, themeColors: true })

type LayerNode = {
  name: string
  type: string
  visible: boolean
  locked: boolean
  /** Pixel size when the node exposes layout dimensions */
  width?: number
  height?: number
  children?: LayerNode[]
}

function sceneNodeToLayer(node: SceneNode): LayerNode {
  const row: LayerNode = {
    name: node.name,
    type: node.type,
    visible: node.visible,
    locked: node.locked,
  }
  if ('width' in node && 'height' in node) {
    const box = node as LayoutMixin
    row.width = Math.round(box.width * 1000) / 1000
    row.height = Math.round(box.height * 1000) / 1000
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
