import { useRef, useEffect } from 'react'
import { ArrowHelper, Group, Vector3 } from 'three'
import type * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import type { Mat3, Vec3 } from '../math/types'
import { ecefToThree } from '../math/wgs84'

interface FrameAxesProps {
  rotation: Mat3
  originEcef: Vec3
  length: number
  opacity?: number
}

const COLORS = { x: 0xff4444, y: 0x44ff44, z: 0x4488ff }

function colFromMat(R: Mat3, col: 0 | 1 | 2): Vector3 {
  return new Vector3(R[col + 3], R[col + 6], R[col]).normalize()
}

export function FrameAxes({ rotation, originEcef, length, opacity = 1 }: FrameAxesProps) {
  const groupRef = useRef<Group>(null)

  useEffect(() => {
    const g = groupRef.current
    if (!g) return
    while (g.children.length) g.remove(g.children[0])

    const [ox, oy, oz] = ecefToThree(originEcef)
    const origin = new Vector3(ox, oy, oz)
    const headLen = Math.min(0.22, length * 0.08)
    const headW   = headLen * 0.5

    for (const [col, color] of [[0, COLORS.x], [1, COLORS.y], [2, COLORS.z]] as [0|1|2, number][]) {
      const dir   = colFromMat(rotation, col)
      const arrow = new ArrowHelper(dir, origin, length, color, headLen, headW)
      if (opacity < 1) {
        const lineMat = arrow.line.material as THREE.Material & { transparent: boolean; opacity: number }
        lineMat.transparent = true
        lineMat.opacity = opacity
        const cone = arrow.cone.material
        if (Array.isArray(cone)) {
          cone.forEach(m => { m.transparent = true; m.opacity = opacity })
        } else {
          cone.transparent = true
          cone.opacity = opacity
        }
      }
      g.add(arrow)
    }
  }, [rotation, originEcef, length, opacity])

  useFrame(() => {})
  return <group ref={groupRef} />
}
