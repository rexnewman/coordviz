import { useRef, useEffect } from 'react'
import { Group, Matrix4, Raycaster, Vector2, Vector3 } from 'three'
import { useThree } from '@react-three/fiber'
import type { ThreeEvent } from '@react-three/fiber'
import { EntityType } from '../math/types'
import type { Vec3, Attitude, Mat3 } from '../math/types'
import { ecefToThree, threeToEcef } from '../math/wgs84'
import { ecefToLla, llaToEcef } from '../math/transforms'

interface EntityMeshProps {
  type: EntityType
  ecef: Vec3
  modelScale?: number
  attitude: Attitude
  bodyRotation: Mat3
  onPositionChange: (ecef: Vec3) => void
  onAttitudeChange: (attitude: Attitude) => void
  onDragStart: () => void
  onDragEnd: () => void
}

function normalize180(a: number): number {
  a = a % 360
  if (a >  180) a -= 360
  if (a < -180) a += 360
  return a
}

const ATTITUDE_SENSITIVITY = 0.3  // degrees per pixel

// Same ECEF→Three.js column remapping used in FrameAxes / AxisLabels
function colFromMat(R: Mat3, col: 0 | 1 | 2): Vector3 {
  return new Vector3(R[col + 3], R[col + 6], R[col]).normalize()
}

export function EntityMesh({
  type, ecef, modelScale = 1, attitude, bodyRotation,
  onPositionChange, onAttitudeChange, onDragStart, onDragEnd,
}: EntityMeshProps) {
  const pos   = ecefToThree(ecef)
  const scale = 0.15 * modelScale

  const { camera, gl } = useThree()
  const groupRef   = useRef<Group>(null)
  const raycaster  = useRef(new Raycaster())
  const dragType   = useRef<'position' | 'attitude' | null>(null)
  const altRef     = useRef(0)
  const attRef     = useRef(attitude)
  attRef.current   = attitude
  const attOrigin  = useRef({ x: 0, y: 0, yaw: 0, pitch: 0 })
  const rRef       = useRef(new Vector3(...pos).length())
  rRef.current     = new Vector3(...pos).length()

  // Apply body-frame orientation to the visible model
  useEffect(() => {
    const group = groupRef.current
    if (!group) return
    const m4 = new Matrix4()
    m4.makeBasis(colFromMat(bodyRotation, 0), colFromMat(bodyRotation, 1), colFromMat(bodyRotation, 2))
    group.setRotationFromMatrix(m4)
  }, [bodyRotation])

  useEffect(() => {
    const canvas = gl.domElement

    function ndcOf(clientX: number, clientY: number): Vector2 {
      const rect = canvas.getBoundingClientRect()
      return new Vector2(
         ((clientX - rect.left) / rect.width)  * 2 - 1,
        -((clientY - rect.top)  / rect.height) * 2 + 1,
      )
    }

    function hitAltSphere(clientX: number, clientY: number): Vec3 | null {
      raycaster.current.setFromCamera(ndcOf(clientX, clientY), camera)
      const { origin: O, direction: D } = raycaster.current.ray
      const r = rRef.current
      const OD   = O.dot(D)
      const disc = OD * OD - O.dot(O) + r * r
      if (disc < 0) return null
      const t = -OD - Math.sqrt(disc)
      if (t < 0.01) return null
      const hit = O.clone().addScaledVector(D, t)
      return threeToEcef([hit.x, hit.y, hit.z])
    }

    // Capture-phase right-click handler — fires BEFORE OrbitControls' bubble-phase
    // listener.  If we hit the entity mesh, we stop propagation so OrbitControls
    // never sees the event, then handle attitude drag ourselves.
    function onRightClickCapture(e: PointerEvent) {
      if (e.button !== 2) return
      const group = groupRef.current
      if (!group) return
      raycaster.current.setFromCamera(ndcOf(e.clientX, e.clientY), camera)
      const hits = raycaster.current.intersectObject(group, true)
      if (hits.length === 0) return               // missed entity — let OrbitControls orbit
      e.stopImmediatePropagation()                // block OrbitControls
      dragType.current = 'attitude'
      const a = attRef.current
      attOrigin.current = { x: e.clientX, y: e.clientY, yaw: a.yaw, pitch: a.pitch }
      canvas.setPointerCapture(e.pointerId)
      canvas.style.cursor = 'move'
      onDragStart()
    }

    function onPointerMove(e: PointerEvent) {
      if (dragType.current === 'position') {
        const hitEcef = hitAltSphere(e.clientX, e.clientY)
        if (!hitEcef) return
        const lla = ecefToLla(hitEcef)
        onPositionChange(llaToEcef({ lat: lla.lat, lon: lla.lon, alt: altRef.current }))
      } else if (dragType.current === 'attitude') {
        const dx =  e.clientX - attOrigin.current.x
        const dy =  e.clientY - attOrigin.current.y
        const newYaw   = normalize180(attOrigin.current.yaw   + dx * ATTITUDE_SENSITIVITY)
        const newPitch = Math.max(-90, Math.min(90,
          attOrigin.current.pitch - dy * ATTITUDE_SENSITIVITY))
        onAttitudeChange({ roll: attRef.current.roll, pitch: newPitch, yaw: newYaw })
      }
    }

    function onPointerUp(e: PointerEvent) {
      if (dragType.current === null) return
      dragType.current = null
      canvas.style.cursor = 'default'
      canvas.releasePointerCapture(e.pointerId)
      onDragEnd()
    }

    function onContextMenu(e: Event) { e.preventDefault() }

    canvas.addEventListener('pointerdown', onRightClickCapture, { capture: true })
    canvas.addEventListener('pointermove', onPointerMove)
    canvas.addEventListener('pointerup', onPointerUp)
    canvas.addEventListener('contextmenu', onContextMenu)
    return () => {
      canvas.removeEventListener('pointerdown', onRightClickCapture, { capture: true })
      canvas.removeEventListener('pointermove', onPointerMove)
      canvas.removeEventListener('pointerup', onPointerUp)
      canvas.removeEventListener('contextmenu', onContextMenu)
    }
  }, [camera, gl, onPositionChange, onAttitudeChange, onDragStart, onDragEnd])

  function onPointerDown(e: ThreeEvent<PointerEvent>) {
    if (e.button !== 0) return   // right-click handled by native capture listener above
    e.stopPropagation()
    dragType.current = 'position'
    altRef.current = ecefToLla(ecef).alt
    gl.domElement.setPointerCapture(e.pointerId)
    gl.domElement.style.cursor = 'grabbing'
    onDragStart()
  }

  function onPointerEnter() { gl.domElement.style.cursor = 'grab' }
  function onPointerLeave() {
    if (dragType.current === null) gl.domElement.style.cursor = 'default'
  }

  return (
    <group
      ref={groupRef}
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
