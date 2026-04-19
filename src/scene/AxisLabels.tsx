import { useMemo, useEffect } from 'react'
import { Vector3, CanvasTexture } from 'three'
import { Billboard } from '@react-three/drei'
import { ecefToThree } from '../math/wgs84'
import type { Mat3, Vec3 } from '../math/types'

export interface AxisEntry {
  label: string
  rotation: Mat3
  originEcef: Vec3
  length: number
  opacity?: number
}

const AXIS_NAMES  = ['x', 'y', 'z'] as const
const AXIS_COLORS = ['#ff4444', '#44ff44', '#4488ff'] as const

function colFromMat(R: Mat3, col: 0 | 1 | 2): Vector3 {
  return new Vector3(R[col + 3], R[col + 6], R[col]).normalize()
}

function perpendicular(dir: Vector3): Vector3 {
  for (const c of [new Vector3(0,1,0), new Vector3(1,0,0), new Vector3(0,0,1)]) {
    if (Math.abs(dir.dot(c)) < 0.95) return c.clone().cross(dir).normalize()
  }
  return new Vector3(1, 0, 0)
}

// ── Canvas label texture ──────────────────────────────────────────────────────
// Renders  "x" (italic, large) + "ECI" (normal, smaller, subscripted) onto a
// transparent canvas so the label looks like proper math notation.

const CANVAS_W = 256
const CANVAS_H = 100
const MAIN_SIZE = 58   // px — axis letter
const SUB_SIZE  = 36   // px — subscript frame name
const DISPLAY_H = 0.32 // Three.js display-unit height of the label plane

function makeLabelTexture(axisChar: string, subscript: string, color: string): CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width  = CANVAS_W
  canvas.height = CANVAS_H
  const ctx = canvas.getContext('2d')!
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H)
  ctx.fillStyle = color

  // Italic axis letter
  ctx.font = `italic bold ${MAIN_SIZE}px "Times New Roman", Georgia, serif`
  ctx.textBaseline = 'alphabetic'
  const mainW = ctx.measureText(axisChar).width
  ctx.fillText(axisChar, 4, CANVAS_H * 0.72)

  // Subscript
  ctx.font = `${SUB_SIZE}px "Times New Roman", Georgia, serif`
  ctx.fillText(subscript, mainW + 6, CANVAS_H * 0.88)

  return new CanvasTexture(canvas)
}

// ── Single label billboard ────────────────────────────────────────────────────

interface MathLabelProps {
  axisChar: string
  subscript: string
  color: string
  opacity: number
  position: [number, number, number]
}

function MathLabel({ axisChar, subscript, color, opacity, position }: MathLabelProps) {
  const texture = useMemo(
    () => makeLabelTexture(axisChar, subscript, color),
    [axisChar, subscript, color],
  )
  useEffect(() => () => { texture.dispose() }, [texture])

  const aspect = CANVAS_W / CANVAS_H
  return (
    <Billboard position={position}>
      <mesh>
        <planeGeometry args={[DISPLAY_H * aspect, DISPLAY_H]} />
        <meshBasicMaterial
          map={texture}
          transparent
          depthWrite={false}
          opacity={opacity}
        />
      </mesh>
    </Billboard>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

interface LabelEntry {
  axisChar: string
  subscript: string
  tip: Vector3
  color: string
  opacity: number
  dir: Vector3
}

const COINCIDENT_THRESHOLD = 0.25
const SPREAD = 0.45

export function AxisLabels({ axes }: { axes: AxisEntry[] }) {
  const groups = useMemo(() => {
    const entries: LabelEntry[] = []
    for (const { label, rotation, originEcef, length, opacity = 1 } of axes) {
      const [ox, oy, oz] = ecefToThree(originEcef)
      const origin = new Vector3(ox, oy, oz)
      for (let col = 0; col < 3; col++) {
        const dir = colFromMat(rotation, col as 0 | 1 | 2)
        entries.push({
          axisChar: AXIS_NAMES[col],
          subscript: label,
          tip: origin.clone().addScaledVector(dir, length + 0.3),
          color: AXIS_COLORS[col],
          opacity,
          dir,
        })
      }
    }

    const assigned = new Set<number>()
    const result: LabelEntry[][] = []
    for (let i = 0; i < entries.length; i++) {
      if (assigned.has(i)) continue
      const group: LabelEntry[] = [entries[i]]
      assigned.add(i)
      for (let j = i + 1; j < entries.length; j++) {
        if (!assigned.has(j) && entries[i].tip.distanceTo(entries[j].tip) < COINCIDENT_THRESHOLD) {
          group.push(entries[j])
          assigned.add(j)
        }
      }
      result.push(group)
    }
    return result
  }, [axes])

  return (
    <>
      {groups.map((group, gi) =>
        group.map((entry, li) => {
          const perp = perpendicular(group[0].dir)
          const offset = -(group.length - 1) * SPREAD * 0.5 + li * SPREAD
          const pos = entry.tip.clone().addScaledVector(perp, offset)
          return (
            <MathLabel
              key={`${gi}-${li}`}
              axisChar={entry.axisChar}
              subscript={entry.subscript}
              color={entry.color}
              opacity={entry.opacity}
              position={pos.toArray() as [number, number, number]}
            />
          )
        })
      )}
    </>
  )
}
