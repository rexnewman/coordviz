import { useRef, useEffect } from 'react'
import { ArrowHelper, Group, Vector3 } from 'three'
import { useFrame } from '@react-three/fiber'
import type { Mat3, Vec3 } from '../math/types'
import { ecefToThree } from '../math/wgs84'

interface FrameAxesProps {
  /** 3×3 rotation matrix (row-major) whose columns are the X, Y, Z axes in ECEF */
  rotation: Mat3
  /** Entity position in ECEF metres — where to draw the axes */
  originEcef: Vec3
  /** Length of each axis arrow in display units */
  length: number
  /** Optional opacity 0–1 */
  opacity?: number
}

const COLORS = {
  x: 0xff4444,  // red
  y: 0x44ff44,  // green
  z: 0x4488ff,  // blue
}

// Rotation matrix columns are ECEF vectors; remap to Three.js space: [Ey, Ez, Ex]
function colFromMat(R: Mat3, col: 0 | 1 | 2): Vector3 {
  return new Vector3(R[col + 3], R[col + 6], R[col]).normalize()
}

export function FrameAxes({ rotation, originEcef, length, opacity = 1 }: FrameAxesProps) {
  const groupRef = useRef<Group>(null)

  useEffect(() => {
    const g = groupRef.current
    if (!g) return

    // Clear old arrows
    while (g.children.length) g.remove(g.children[0])

    const [ox, oy, oz] = ecefToThree(originEcef)
    const origin = new Vector3(ox, oy, oz)

    const dirs: [0 | 1 | 2, number][] = [[0, COLORS.x], [1, COLORS.y], [2, COLORS.z]]
    for (const [col, color] of dirs) {
      const dir = colFromMat(rotation, col)
      const arrow = new ArrowHelper(dir, origin, length, color, length * 0.2, length * 0.1)
      if (opacity < 1) {
        arrow.line.material.transparent = true
        arrow.line.material.opacity = opacity
        if (Array.isArray(arrow.cone.material)) {
          arrow.cone.material.forEach(m => { m.transparent = true; m.opacity = opacity })
        } else {
          arrow.cone.material.transparent = true
          arrow.cone.material.opacity = opacity
        }
      }
      g.add(arrow)
    }
  }, [rotation, originEcef, length, opacity])

  // No per-frame update needed — arrows rebuilt on prop change
  useFrame(() => {})

  return <group ref={groupRef} />
}
