import { useRef, useEffect } from 'react'
import { Raycaster, Vector3 } from 'three'
import { useThree } from '@react-three/fiber'
import type { ThreeEvent } from '@react-three/fiber'
import { EntityType } from '../math/types'
import type { Vec3 } from '../math/types'
import { ecefToThree, threeToEcef } from '../math/wgs84'
import { ecefToLla, llaToEcef } from '../math/transforms'

interface EntityMeshProps {
  type: EntityType
  ecef: Vec3
  modelScale?: number
  onPositionChange: (ecef: Vec3) => void
  onDragStart: () => void
  onDragEnd: () => void
}

export function EntityMesh({ type, ecef, modelScale = 1, onPositionChange, onDragStart, onDragEnd }: EntityMeshProps) {
  const pos = ecefToThree(ecef)
  const scale = 0.15 * modelScale

  const { camera, gl } = useThree()
  const raycaster = useRef(new Raycaster())
  const isDragging = useRef(false)
  const altRef = useRef(0)
  // Entity's distance from Earth centre in display units — the altitude sphere radius
  const rRef = useRef(new Vector3(...pos).length())
  rRef.current = new Vector3(...pos).length()

  useEffect(() => {
    const canvas = gl.domElement

    function hitAltSphere(clientX: number, clientY: number): Vec3 | null {
      const rect = canvas.getBoundingClientRect()
      const x = ((clientX - rect.left) / rect.width) * 2 - 1
      const y = -((clientY - rect.top) / rect.height) * 2 + 1
      raycaster.current.setFromCamera({ x, y }, camera)
      const { origin: O, direction: D } = raycaster.current.ray
      const r = rRef.current
      const OD = O.dot(D)
      const disc = OD * OD - O.dot(O) + r * r
      if (disc < 0) return null
      const t = -OD - Math.sqrt(disc)
      if (t < 0.01) return null
      const hit = O.clone().addScaledVector(D, t)
      return threeToEcef([hit.x, hit.y, hit.z])
    }

    function onPointerMove(e: PointerEvent) {
      if (!isDragging.current) return
      const hitEcef = hitAltSphere(e.clientX, e.clientY)
      if (!hitEcef) return
      const lla = ecefToLla(hitEcef)
      onPositionChange(llaToEcef({ lat: lla.lat, lon: lla.lon, alt: altRef.current }))
    }

    function onPointerUp(e: PointerEvent) {
      if (!isDragging.current) return
      isDragging.current = false
      canvas.style.cursor = 'default'
      canvas.releasePointerCapture(e.pointerId)
      onDragEnd()
    }

    canvas.addEventListener('pointermove', onPointerMove)
    canvas.addEventListener('pointerup', onPointerUp)
    return () => {
      canvas.removeEventListener('pointermove', onPointerMove)
      canvas.removeEventListener('pointerup', onPointerUp)
    }
  }, [camera, gl, onPositionChange, onDragEnd])

  function onPointerDown(e: ThreeEvent<PointerEvent>) {
    e.stopPropagation()
    isDragging.current = true
    altRef.current = ecefToLla(ecef).alt
    gl.domElement.setPointerCapture(e.pointerId)
    gl.domElement.style.cursor = 'grabbing'
    onDragStart()
  }

  function onPointerEnter() { gl.domElement.style.cursor = 'grab' }
  function onPointerLeave() { if (!isDragging.current) gl.domElement.style.cursor = 'default' }

  return (
    <group
      position={pos}
      onPointerDown={onPointerDown}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
    >
      {type === EntityType.Satellite ? (
        <>
          <mesh>
            <boxGeometry args={[scale, scale * 0.6, scale * 0.6]} />
            <meshStandardMaterial color="#c0c0d0" metalness={0.8} roughness={0.3} />
          </mesh>
          <mesh position={[-scale * 1.2, 0, 0]}>
            <boxGeometry args={[scale * 1.4, scale * 0.05, scale * 0.8]} />
            <meshStandardMaterial color="#1a4080" metalness={0.5} roughness={0.4} />
          </mesh>
          <mesh position={[scale * 1.2, 0, 0]}>
            <boxGeometry args={[scale * 1.4, scale * 0.05, scale * 0.8]} />
            <meshStandardMaterial color="#1a4080" metalness={0.5} roughness={0.4} />
          </mesh>
        </>
      ) : (
        <>
          <mesh rotation={[0, 0, -Math.PI / 2]}>
            <coneGeometry args={[scale * 0.4, scale * 1.6, 8]} />
            <meshStandardMaterial color="#d0d0d0" metalness={0.6} roughness={0.4} />
          </mesh>
          <mesh>
            <boxGeometry args={[scale * 0.2, scale * 0.05, scale * 2.0]} />
            <meshStandardMaterial color="#b0b0b0" metalness={0.5} roughness={0.5} />
          </mesh>
        </>
      )}
    </group>
  )
}
