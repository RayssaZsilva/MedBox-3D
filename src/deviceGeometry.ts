import { BufferGeometry, Float32BufferAttribute, ShapeUtils, Vector2 } from 'three'

export const caseSize = { halfWidth: 3.38, rear: -2.16, front: 2.23, bottom: -0.645, split: 1, top: 0.67 }
export const panelSlope = 0.33
export const panelAngle = Math.atan(panelSlope)
export const hingeZ = -1.97
export const ledZ = 1.12
export const lcdX = -1.48
export const panelZ = 1.67

export function deckHeight(z: number) {
  return caseSize.top - Math.max(0, z - caseSize.split) * panelSlope
}

type Ring = { outline: Vector2[]; height: (z: number) => number }

function rounded(left: number, right: number, rear: number, front: number, radius: number, split?: number) {
  const centers = [[right - radius, front - radius], [left + radius, front - radius],
    [left + radius, rear + radius], [right - radius, rear + radius]]
  const points = centers.flatMap(([x, z], corner) => Array.from({ length: 9 }, (_, segment) => {
    const angle = (corner + segment / 8) * Math.PI / 2
    return new Vector2(x + radius * Math.cos(angle), z + radius * Math.sin(angle))
  }))
  if (split === undefined) return points
  // Match the break of the inclined panel on each bevel ring.
  return points.flatMap((point, index) => {
    const next = points[(index + 1) % points.length]
    return (point.y < split) !== (next.y < split) && point.y !== split && next.y !== split
      ? [point, new Vector2((point.x + next.x) / 2, split)]
      : [point]
  })
}

function geometry(positions: number[], indices: number[]) {
  const mesh = new BufferGeometry()
  mesh.setAttribute('position', new Float32BufferAttribute(positions, 3))
  mesh.setIndex(indices)
  mesh.computeVertexNormals()
  return mesh
}

function surface(outline: Vector2[], height: (z: number) => number, holes: Vector2[][] = [], down = false) {
  const faces = ShapeUtils.triangulateShape(outline, holes)
  const positions = [...outline, ...holes.flat()].flatMap(({ x, y: z }) => [x, height(z), z])
  return geometry(positions, faces.flatMap(([a, b, c]) => down ? [a, b, c] : [a, c, b]))
}

function loft(rings: Ring[], inside = false) {
  const count = rings[0].outline.length
  const positions = rings.flatMap(({ outline, height }) => outline.flatMap(({ x, y: z }) => [x, height(z), z]))
  const indices = rings.slice(1).flatMap((_, row) => Array.from({ length: count }, (_, index) => {
    const a = row * count + index
    const b = row * count + (index + 1) % count
    const c = b + count
    const d = a + count
    return inside ? [a, b, c, a, c, d] : [a, c, b, a, d, c]
  }).flat())
  return geometry(positions, indices)
}

export function createHousing() {
  const { halfWidth, rear, front, bottom, split } = caseSize
  const outerRing = (inset: number) =>
    rounded(-halfWidth + inset, halfWidth - inset, rear + inset, front - inset, 0.34 - inset, split)
  const lip = outerRing(0.08)
  const opening = (inset: number) => rounded(-3.18 + inset, 3.18 - inset, -2.025 + inset, 0.935 - inset, 0.125 - inset)
  const lcd = rounded(lcdX - 1.147, lcdX + 1.147, panelZ - 0.355, panelZ + 0.355, 0.08)

  return {
    outerWall: loft([
      { outline: outerRing(0.085), height: () => bottom },
      { outline: outerRing(0.025), height: () => bottom + 0.027 },
      { outline: outerRing(0), height: () => bottom + 0.084 },
      { outline: outerRing(0), height: (z) => deckHeight(z) - 0.095 },
      { outline: outerRing(0.025), height: (z) => deckHeight(z) - 0.036 },
      { outline: lip, height: deckHeight },
    ]),
    bottom: surface(outerRing(0.085), () => bottom, [], true),
    rearDeck: surface(lip.filter((point) => point.y <= split), deckHeight, [opening(0)]),
    frontDeck: surface(lip.filter((point) => point.y >= split), deckHeight, [lcd]),
    lcdPocket: loft([{ outline: lcd, height: (z) => deckHeight(z) - 0.10 }, { outline: lcd, height: deckHeight }], true),
    chamber: loft([
      { outline: opening(0.095), height: () => -0.455 },
      { outline: opening(0.05), height: () => -0.40 },
      { outline: opening(0), height: deckHeight },
    ], true),
    chamberFloor: surface(opening(0.095), () => -0.455),
  }
}

/** Rounded medication well with a recessed floor, inner wall and molded lip. */
export function createWell() {
  const outline = (inset: number) => rounded(-0.768 + inset, 0.768 - inset, -1.985 + inset, 0.90 - inset, 0.14 - inset)
  return {
    side: loft([
      { outline: outline(0.072), height: () => 0.27 },
      { outline: outline(0.02), height: () => 0.30 },
      { outline: outline(0), height: () => 0.625 },
      { outline: outline(0.021), height: () => 0.672 },
      { outline: outline(0.064), height: () => 0.672 },
      { outline: outline(0.086), height: () => 0.639 },
      { outline: outline(0.095), height: () => 0.36 },
      { outline: outline(0.122), height: () => 0.323 },
    ]),
    floor: surface(outline(0.122), () => 0.323),
    bottom: surface(outline(0.072), () => 0.27, [], true),
  }
}
