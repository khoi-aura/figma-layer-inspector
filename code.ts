/**
 * Layer inspector + Aura Post Card JSON export (schema-aligned).
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

// --- Layer inspector types (unchanged shape for UI) ---

type LayerNode = {
  name: string
  type: string
  visible: boolean
  locked: boolean
  x?: number
  y?: number
  width?: number
  height?: number
  text?: string
  fontName?: string
  fontSize?: number | 'mixed'
  children?: LayerNode[]
}

// --- Aura Post Card (matches schema.json) ---

type ImageSlotName = 'none' | 'background' | 'photo1' | 'photo2' | 'photo3'
type TextSlotName = 'none' | 'text1' | 'text2'

type BorderSpec = {
  width: number
  color: string
}

/** Schema uses typo `desturate` */
type CardImage = {
  name: ImageSlotName
  x: number
  y: number
  width: number
  height: number
  default: string
  desturate?: boolean
  tint?: boolean
  border?: BorderSpec
}

type FontNameEnum =
  | 'DawningofaNewDay'
  | 'Canela-Light'
  | 'Caprasimo-Regular'
  | 'BebasNeue-Regular'
  | 'TTCommonsPro-Lt'
  | 'TTCommonsPro-Md'

const FONT_ENUM_SET: ReadonlySet<string> = new Set([
  'DawningofaNewDay',
  'Canela-Light',
  'Caprasimo-Regular',
  'BebasNeue-Regular',
  'TTCommonsPro-Lt',
  'TTCommonsPro-Md',
])

type CardText = {
  name: TextSlotName
  x: number
  y: number
  width: number
  height: number
  default: string
  maxLength: number
  align?: 'leading' | 'center' | 'trailing'
  verticalAlign?: 'top' | 'middle' | 'bottom'
  border?: BorderSpec
  multiline?: boolean
  color?: string
  fontName?: FontNameEnum
  fontSize?: number
}

type CardFace = {
  images?: CardImage[]
  text?: CardText[]
  desaturateImages?: boolean
  colorOptions?: string[]
  background?: {
    default: string
    tint: boolean
  }
}

type AuraPostCard = {
  name: string
  thumbnail: string
  height: number
  width: number
  preview?: boolean
  front: CardFace
  back: CardFace
}

// --- Raw extraction bucket (pre-normalization) ---

type RawFaceBucket = {
  images: Array<{
    name: string
    x: number
    y: number
    width: number
    height: number
    default: string
    border?: BorderSpec
    tint?: boolean
    desturate?: boolean
  }>
  text: Array<{
    name: string
    x: number
    y: number
    width: number
    height: number
    default: string
    maxLength: number
    align: 'leading' | 'center' | 'trailing'
    verticalAlign: 'top' | 'middle' | 'bottom'
    border?: BorderSpec
    multiline: boolean
    color?: string
    fontName: string
    fontSize: number | 'mixed'
  }>
}

const IMAGE_NAME_ENUM: ReadonlySet<string> = new Set([
  'none',
  'background',
  'photo1',
  'photo2',
  'photo3',
])
const TEXT_NAME_ENUM: ReadonlySet<string> = new Set(['none', 'text1', 'text2'])

function normalizeImageSlotName(name: string): ImageSlotName {
  const t = name.trim()
  return IMAGE_NAME_ENUM.has(t) ? (t as ImageSlotName) : 'none'
}

function normalizeTextSlotName(name: string): TextSlotName {
  const t = name.trim()
  return TEXT_NAME_ENUM.has(t) ? (t as TextSlotName) : 'none'
}

/** Export order: photo slots first, then background, then none. */
const IMAGE_EXPORT_ORDER: Record<ImageSlotName, number> = {
  photo1: 0,
  photo2: 1,
  photo3: 2,
  background: 3,
  none: 4,
}

/** Export order: text slots first, then none. */
const TEXT_EXPORT_ORDER: Record<TextSlotName, number> = {
  text1: 0,
  text2: 1,
  none: 2,
}

function compareImageExportOrder(a: CardImage, b: CardImage): number {
  const diff = IMAGE_EXPORT_ORDER[a.name] - IMAGE_EXPORT_ORDER[b.name]
  if (diff !== 0) return diff
  if (a.y !== b.y) return a.y - b.y
  return a.x - b.x
}

function compareTextExportOrder(a: CardText, b: CardText): number {
  const diff = TEXT_EXPORT_ORDER[a.name] - TEXT_EXPORT_ORDER[b.name]
  if (diff !== 0) return diff
  if (a.y !== b.y) return a.y - b.y
  return a.x - b.x
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

/** Map Figma family-style labels to schema enum strings. */
function canonicalFontLabel(label: string): string {
  switch (label) {
    case 'TTCommonsPro-Light':
      return 'TTCommonsPro-Lt'
    case 'TTCommonsPro-Medium':
      return 'TTCommonsPro-Md'
    case 'DawningofaNewDay-Regular':
      return 'DawningofaNewDay'
    default:
      return label
  }
}

function makeImageDefault(width: number, height: number): string {
  const safeW = Math.max(1, Math.round(width))
  const safeH = Math.max(1, Math.round(height))
  return `https://placehold.co/${safeW}x${safeH}/666666/FFFFFF.png`
}

function makeThumbnailUrl(width: number, height: number): string {
  const safeW = Math.max(1, Math.min(800, Math.round(width)))
  const safeH = Math.max(1, Math.min(800, Math.round(height)))
  return `https://placehold.co/${safeW}x${safeH}/333333/CCCCCC.png`
}

function toSpecTextAlign(
  align: TextNode['textAlignHorizontal'] | PluginAPI['mixed'],
): 'leading' | 'center' | 'trailing' {
  if (align === 'CENTER') return 'center'
  if (align === 'RIGHT') return 'trailing'
  return 'leading'
}

function toSpecTextVerticalAlign(
  align: TextNode['textAlignVertical'] | PluginAPI['mixed'],
): 'top' | 'middle' | 'bottom' {
  if (align === 'BOTTOM') return 'bottom'
  if (align === 'CENTER') return 'middle'
  return 'top'
}

function rgbToHex(color: RGB | RGBA): string {
  const r = Math.round(color.r * 255)
  const g = Math.round(color.g * 255)
  const b = Math.round(color.b * 255)
  return (
    '#' +
    [r, g, b]
      .map((v) => v.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase()
  )
}

function solidFillFromNode(node: SceneNode): string | undefined {
  if (!('fills' in node)) return undefined
  const fillsValue = node.fills
  if (fillsValue === figma.mixed || !Array.isArray(fillsValue)) return undefined
  const solid = fillsValue.find(
    (p): p is SolidPaint =>
      p.type === 'SOLID' && p.visible !== false,
  )
  if (!solid) return undefined
  return rgbToHex(solid.color)
}

function strokeToBorder(node: SceneNode): BorderSpec | undefined {
  if (!('strokes' in node) || !('strokeWeight' in node)) return undefined
  const strokes = node.strokes as readonly Paint[] | PluginAPI['mixed']
  if (strokes === figma.mixed || !Array.isArray(strokes) || strokes.length === 0)
    return undefined
  const w = node.strokeWeight as number | PluginAPI['mixed']
  if (w === figma.mixed || typeof w !== 'number' || w <= 0) return undefined
  const solid = strokes.find(
    (p): p is SolidPaint =>
      p.type === 'SOLID' && p.visible !== false,
  )
  if (!solid) return undefined
  return { width: roundCoord(w), color: rgbToHex(solid.color) }
}

function textNodeFillHex(node: TextNode): string | undefined {
  const fillsValue = node.fills as readonly Paint[] | PluginAPI['mixed']
  if (fillsValue === figma.mixed || !Array.isArray(fillsValue)) return undefined
  const solid = fillsValue.find(
    (p): p is SolidPaint =>
      p.type === 'SOLID' && p.visible !== false,
  )
  if (!solid) return undefined
  return rgbToHex(solid.color)
}

function findNamedNode(root: SceneNode, name: string): SceneNode | null {
  if (root.name === name) {
    return root.visible ? root : null
  }
  if (!('children' in root)) return null
  for (const child of root.children) {
    if (!child.visible) continue
    const found = findNamedNode(child as SceneNode, name)
    if (found) return found
  }
  return null
}

function extractColorOptions(faceRoot: SceneNode): string[] {
  const container = findNamedNode(faceRoot, 'colorOptions')
  if (!container || !('children' in container)) return []
  const parent = container as ChildrenMixin
  const kids = [...parent.children].filter(
    (c): c is SceneNode =>
      c.visible && 'width' in c && 'height' in c,
  )
  kids.sort((a, b) => {
    const la = a as LayoutMixin
    const lb = b as LayoutMixin
    if (la.y !== lb.y) return la.y - lb.y
    return la.x - lb.x
  })
  const out: string[] = []
  for (const k of kids) {
    const hex = solidFillFromNode(k)
    if (hex) out.push(hex)
  }
  return out
}

function extractFaceBackground(faceRoot: SceneNode): CardFace['background'] {
  const bg = findNamedNode(faceRoot, 'background')
  if (!bg || !('width' in bg && 'height' in bg)) return undefined
  const box = bg as LayoutMixin
  if (!hasImageFill(bg)) return undefined
  return {
    default: makeImageDefault(box.width, box.height),
    tint: false,
  }
}

type ResolvedCard = {
  cardName: string
  width: number
  height: number
  frontRoot: SceneNode
  /** Optional named face children under selected root. */
  backRoot: SceneNode | null
  insideRoot: SceneNode | null
  rootColorOptions: string[]
}

function findDirectChild(
  parent: ChildrenMixin,
  name: string,
): SceneNode | undefined {
  return parent.children.find(
    (c) => c.name === name && c.visible,
  ) as SceneNode | undefined
}

type ResolveCardFromSelectionResult =
  | { ok: true; resolved: ResolvedCard }
  | { ok: false; reason: string }

function resolveCardFromSelection(node: SceneNode): ResolveCardFromSelectionResult {
  if (!('children' in node)) {
    return {
      ok: false,
      reason:
        'Selected root must be a container layer with child layers named `front` (required), and optionally `back`, `inside`, `colorOptions`.',
    }
  }

  const parent = node as ChildrenMixin & SceneNode
  const front = findDirectChild(parent, 'front')
  const back = findDirectChild(parent, 'back') ?? null
  const inside = findDirectChild(parent, 'inside') ?? null

  if (!front) {
    return {
      ok: false,
      reason:
        'Could not generate card JSON because `front` is missing. Add a visible child layer named `front` under the selected root and refresh.',
    }
  }
  if (!('width' in front && 'height' in front)) {
    return {
      ok: false,
      reason:
        'Could not generate card JSON because `front` has no measurable width/height. Use a frame/group-like layer with size for `front`.',
    }
  }

  const frontLayout = front as LayoutMixin
  return {
    ok: true,
    resolved: {
      cardName: node.name,
      width: roundCoord(frontLayout.width),
      height: roundCoord(frontLayout.height),
      frontRoot: front,
      backRoot: back,
      insideRoot: inside,
      rootColorOptions: extractColorOptions(node),
    },
  }
}

function traverseForSpec(
  node: SceneNode,
  offsetX: number,
  offsetY: number,
  bucket: RawFaceBucket,
): void {
  if (!node.visible) {
    return
  }

  let nextOffsetX = offsetX
  let nextOffsetY = offsetY
  if ('x' in node && 'y' in node) {
    const layout = node as LayoutMixin
    nextOffsetX += layout.x
    nextOffsetY += layout.y
  }

  if (node.name === 'colorOptions') {
    return
  }

  if ('width' in node && 'height' in node) {
    const layout = node as LayoutMixin
    const width = roundCoord(layout.width)
    const height = roundCoord(layout.height)
    const x = roundCoord(nextOffsetX)
    const y = roundCoord(nextOffsetY)

    if (hasImageFill(node) && node.name !== 'background') {
      const border = strokeToBorder(node)
      bucket.images.push({
        name: node.name,
        x,
        y,
        width,
        height,
        default: makeImageDefault(width, height),
        border,
      })
    }

    if (node.type === 'TEXT') {
      const tn = node as TextNode
      const multiline = tn.characters.includes('\n')
      bucket.text.push({
        name: node.name,
        x,
        y,
        width,
        height,
        default: tn.characters,
        maxLength: tn.characters.length,
        align: toSpecTextAlign(tn.textAlignHorizontal),
        verticalAlign: toSpecTextVerticalAlign(tn.textAlignVertical),
        border: strokeToBorder(node),
        multiline,
        color: textNodeFillHex(tn),
        fontName: canonicalFontLabel(toFontLabel(tn.fontName)),
        fontSize:
          tn.fontSize === figma.mixed ? 'mixed' : roundCoord(tn.fontSize),
      })
    }
  }

  if ('children' in node) {
    const parent = node as ChildrenMixin
    for (const child of parent.children) {
      if (!child.visible || child.name === 'colorOptions') continue
      traverseForSpec(child as SceneNode, nextOffsetX, nextOffsetY, bucket)
    }
  }
}

function buildRawFace(faceRoot: SceneNode): RawFaceBucket {
  const bucket: RawFaceBucket = { images: [], text: [] }
  if (!faceRoot.visible) {
    return bucket
  }
  if ('children' in faceRoot) {
    const parent = faceRoot as ChildrenMixin
    for (const child of parent.children) {
      if (!child.visible) continue
      traverseForSpec(child as SceneNode, 0, 0, bucket)
    }
  } else {
    traverseForSpec(faceRoot, 0, 0, bucket)
  }
  return bucket
}

function normalizeFontName(label: string): FontNameEnum | undefined {
  const canonical = canonicalFontLabel(label)
  if (FONT_ENUM_SET.has(canonical)) return canonical as FontNameEnum
  return undefined
}

function normalizeFontSize(size: number | 'mixed'): number {
  if (size === 'mixed') return 16
  return size
}

function rawFaceToCardFace(
  raw: RawFaceBucket,
  faceRoot: SceneNode,
  fallbackColorOptions: string[],
): CardFace {
  const colorOptions = extractColorOptions(faceRoot)
  const background = extractFaceBackground(faceRoot)

  const images: CardImage[] = raw.images.map((im) => {
    const img: CardImage = {
      name: normalizeImageSlotName(im.name),
      x: im.x,
      y: im.y,
      width: im.width,
      height: im.height,
      default: im.default,
    }
    if (im.border) img.border = im.border
    if (im.tint === true) img.tint = true
    if (im.desturate === true) img.desturate = true
    return img
  })

  const text: CardText[] = raw.text.map((t) => {
    const fontSizeNum = normalizeFontSize(t.fontSize)
    const fn = normalizeFontName(t.fontName)
    const row: CardText = {
      name: normalizeTextSlotName(t.name),
      x: t.x,
      y: t.y,
      width: t.width,
      height: t.height,
      default: t.default,
      maxLength: t.maxLength,
      align: t.align,
      verticalAlign: t.verticalAlign,
      multiline: t.multiline,
    }
    if (t.border) row.border = t.border
    if (t.color) row.color = t.color
    if (fn) row.fontName = fn
    row.fontSize = fontSizeNum
    return row
  })

  images.sort(compareImageExportOrder)
  text.sort(compareTextExportOrder)

  const face: CardFace = {}
  if (images.length) face.images = images
  if (text.length) face.text = text
  if (colorOptions.length) face.colorOptions = colorOptions
  else if (fallbackColorOptions.length) face.colorOptions = fallbackColorOptions
  if (background) face.background = background
  return face
}

function buildAuraPostCardFromResolved(resolved: ResolvedCard): AuraPostCard {
  const rawFront = buildRawFace(resolved.frontRoot)
  const rawBack = resolved.backRoot
    ? buildRawFace(resolved.backRoot)
    : { images: [], text: [] }
  const front = rawFaceToCardFace(
    rawFront,
    resolved.frontRoot,
    resolved.rootColorOptions,
  )
  const back = resolved.backRoot
    ? rawFaceToCardFace(rawBack, resolved.backRoot, resolved.rootColorOptions)
    : {}

  return {
    name: resolved.cardName,
    thumbnail: makeThumbnailUrl(resolved.width, resolved.height),
    width: resolved.width,
    height: resolved.height,
    preview: false,
    front,
    back,
  }
}

// --- Validation (schema rules) ---

type ExportError = { path: string; message: string }

function collectFontNameMismatchErrors(resolved: ResolvedCard): ExportError[] {
  const errors: ExportError[] = []
  const allowedList = [...FONT_ENUM_SET].sort().join(', ')

  const check = (raw: RawFaceBucket, face: 'front' | 'back') => {
    raw.text.forEach((t, i) => {
      const path = `/${face}/text/${i}/fontName`
      if (t.fontName === 'mixed') {
        errors.push({
          path,
          message:
            'Figma reports mixed fonts or styles on this text layer (resolved label: "mixed"). Use a single font and style so the export can match the schema.',
        })
        return
      }
      if (!FONT_ENUM_SET.has(t.fontName)) {
        errors.push({
          path,
          message: `Font label from Figma is "${t.fontName}"; it must exactly match one of: ${allowedList}.`,
        })
      }
    })
  }

  check(buildRawFace(resolved.frontRoot), 'front')
  if (resolved.backRoot) {
    check(buildRawFace(resolved.backRoot), 'back')
  }

  return errors
}

function isHttpsUrl(s: string): boolean {
  return /^https:/.test(s)
}

function validateAuraPostCard(card: AuraPostCard): ExportError[] {
  const errors: ExportError[] = []

  if (!card.name || typeof card.name !== 'string') {
    errors.push({ path: '/name', message: 'name is required' })
  }
  if (typeof card.thumbnail !== 'string' || !isHttpsUrl(card.thumbnail)) {
    errors.push({
      path: '/thumbnail',
      message: 'thumbnail must be a string matching ^https:',
    })
  }
  if (typeof card.width !== 'number') {
    errors.push({ path: '/width', message: 'width is required' })
  }
  if (typeof card.height !== 'number') {
    errors.push({ path: '/height', message: 'height is required' })
  }
  if (!card.front || typeof card.front !== 'object') {
    errors.push({ path: '/front', message: 'front is required' })
  }
  const hasBack = card.back !== undefined && card.back !== null
  const hasInside =
    (card as { inside?: unknown }).inside !== undefined &&
    (card as { inside?: unknown }).inside !== null
  if (!hasBack && !hasInside) {
    errors.push({
      path: '/',
      message: 'oneOf: either back or inside is required',
    })
  }

  if (card.front) {
    errors.push(...validateCardFace(card.front, '/front'))
  }
  if (card.back) {
    errors.push(...validateCardFace(card.back, '/back'))
  }

  return errors
}

function validateCardFace(face: CardFace, base: string): ExportError[] {
  const errors: ExportError[] = []
  if (face.images) {
    face.images.forEach((im, i) => {
      errors.push(...validateImage(im, `${base}/images/${i}`))
    })
  }
  if (face.text) {
    face.text.forEach((t, i) => {
      errors.push(...validateText(t, `${base}/text/${i}`))
    })
  }
  if (face.background) {
    const bg = face.background
    if (typeof bg.default !== 'string' || !isHttpsUrl(bg.default)) {
      errors.push({
        path: `${base}/background/default`,
        message: 'background.default must match ^https:',
      })
    }
    if (typeof bg.tint !== 'boolean') {
      errors.push({
        path: `${base}/background/tint`,
        message: 'background.tint is required when background is set',
      })
    }
  }
  return errors
}

function validateImage(im: CardImage, path: string): ExportError[] {
  const errors: ExportError[] = []
  if (!IMAGE_NAME_ENUM.has(im.name)) {
    errors.push({ path: `${path}/name`, message: 'invalid image name enum' })
  }
  ;(['x', 'y', 'width', 'height'] as const).forEach((k) => {
    if (typeof im[k] !== 'number') {
      errors.push({ path: `${path}/${k}`, message: 'required number' })
    }
  })
  if (typeof im.default !== 'string' || !isHttpsUrl(im.default)) {
    errors.push({
      path: `${path}/default`,
      message: 'default must match ^https:',
    })
  }
  if (im.border) {
    if (typeof im.border.width !== 'number') {
      errors.push({ path: `${path}/border/width`, message: 'required number' })
    }
    if (typeof im.border.color !== 'string') {
      errors.push({ path: `${path}/border/color`, message: 'required string' })
    }
  }
  return errors
}

function validateText(t: CardText, path: string): ExportError[] {
  const errors: ExportError[] = []
  if (!TEXT_NAME_ENUM.has(t.name)) {
    errors.push({ path: `${path}/name`, message: 'invalid text name enum' })
  }
  ;(['x', 'y', 'width', 'height', 'maxLength'] as const).forEach((k) => {
    if (typeof t[k] !== 'number') {
      errors.push({ path: `${path}/${k}`, message: 'required number' })
    }
  })
  if (typeof t.default !== 'string') {
    errors.push({ path: `${path}/default`, message: 'required string' })
  }
  if (t.align !== undefined && !['leading', 'center', 'trailing'].includes(t.align)) {
    errors.push({ path: `${path}/align`, message: 'invalid align enum' })
  }
  if (
    t.verticalAlign !== undefined &&
    !['top', 'middle', 'bottom'].includes(t.verticalAlign)
  ) {
    errors.push({ path: `${path}/verticalAlign`, message: 'invalid verticalAlign enum' })
  }
  if (t.fontName !== undefined && !FONT_ENUM_SET.has(t.fontName)) {
    errors.push({ path: `${path}/fontName`, message: 'invalid fontName enum' })
  }
  if (t.fontSize !== undefined && typeof t.fontSize !== 'number') {
    errors.push({ path: `${path}/fontSize`, message: 'must be number' })
  }
  if (t.border) {
    if (typeof t.border.width !== 'number') {
      errors.push({ path: `${path}/border/width`, message: 'required number' })
    }
    if (typeof t.border.color !== 'string') {
      errors.push({ path: `${path}/border/color`, message: 'required string' })
    }
  }
  return errors
}

function sceneNodeToLayer(node: SceneNode): LayerNode | null {
  if (!node.visible) {
    return null
  }
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
    const kids = parent.children.filter((c) => c.visible)
    const mapped = kids
      .map(sceneNodeToLayer)
      .filter((c): c is LayerNode => c !== null)
    if (mapped.length > 0) {
      row.children = mapped
    }
  }
  return row
}

type ScanOk = {
  ok: true
  notice?: string
  struct: AuraPostCard | null
  exportErrors?: ExportError[]
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
  const roots = selection.flatMap((node) => {
    const layers = sceneNodeToLayer(node)
    if (!layers) return []
    return [
      {
        rootName: node.name,
        rootType: node.type,
        layers,
      },
    ]
  })

  const notice =
    selection.length > 1
      ? 'Card export uses the first selected layer as the root.'
      : undefined

  const resolvedResult =
    selection.length >= 1 ? resolveCardFromSelection(selection[0]) : null
  if (!resolvedResult || !resolvedResult.ok) {
    const reason =
      resolvedResult && !resolvedResult.ok
        ? resolvedResult.reason
        : 'Could not resolve selected root for card export.'
    return {
      ok: true,
      roots,
      struct: null,
      exportErrors: [
        {
          path: '/',
          message: reason,
        },
      ],
      notice,
    }
  }

  const fontErrors = collectFontNameMismatchErrors(resolvedResult.resolved)
  const built = buildAuraPostCardFromResolved(resolvedResult.resolved)
  const exportErrors = [...fontErrors, ...validateAuraPostCard(built)]
  if (exportErrors.length > 0) {
    return {
      ok: true,
      roots,
      struct: null,
      exportErrors,
      notice,
    }
  }

  return {
    ok: true,
    roots,
    struct: built,
    notice,
  }
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
