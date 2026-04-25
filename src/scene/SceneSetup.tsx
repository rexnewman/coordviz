import { useRef, useEffect } from 'react'
import { OrbitControls, Stars } from '@react-three/drei'
import { MOUSE, Raycaster, Vector2 } from 'three'
import { useThree } from '@react-three/fiber'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { WGS84, DISPLAY_SCALE } from '../math/wgs84'

// Earth surface radius in Three.js display units
const EARTH_R = WGS84.a / DISPLAY_SCALE

interface SceneSetupProps {
  sunIntensity?: number
  sunPosition?: [number, number, number]
  orbitEnabled?: boolean
}

export function SceneSetup({ sunIntensity = 1.2, sunPosition = [20, 10, 10], orbitEnabled = true }: SceneSetupProps) {
  const fill: [number, number, number] = [-sunPosition[0] * 0.5, -sunPosition[1] * 0.5, -sunPosition[2] * 0.5]
  const orbitRef = useRef<OrbitControlsImpl>(null)
  const { camera, gl } = useThree()

  useEffect(() => {
    const canvas = gl.domElement

    // Bubble-phase handler: EntityMesh's capture-phase listener calls
    // stopImmediatePropagation when the entity is hit, so this only runs
    // for right-clicks that miss the entity.
    function onRightDown(e: PointerEvent) {
      if (e.button !== 2) return
      const rect = canvas.getBoundingClientRect()
      const ndc = new Vector2(
        ((e.clientX - rect.left) / rect.width)  * 2 - 1,
        -((e.clientY - rect.top)  / rect.height) * 2 + 1,
      )
      const ray = new Raycaster()
      ray.setFromCamera(ndc, camera)
      const { origin: O, direction: D } = ray.ray
      // Intersect with Earth sphere
      const OD   = O.dot(D)
      const disc = OD * OD - O.dot(O) + EARTH_R * EARTH_R
      if (disc < 0) return                    // clicked empty space
      const t = -OD - Math.sqrt(disc)
      if (t < 0.01) return
      const hit = O.clone().addScaledVector(D, t)
      const orbit = orbitRef.current
      if (!orbit) return
      orbit.target.copy(hit)
      orbit.update()
    }

    canvas.addEventListener('pointerdown', onRightDown)
    return () => canvas.removeEventListener('pointerdown', onRightDown)
  }, [camera, gl])

  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight position={sunPosition} intensity={sunIntensity} castShadow={false} />
      <directionalLight position={fill} intensity={sunIntensity * 0.17} />
      <Stars radius={60} depth={50} count={3000} factor={2} saturation={0} fade />
      <OrbitControls
        ref={orbitRef}
        enabled={orbitEnabled}
        enableDamping
        dampingFactor={0.08}
        minDistance={2}
        maxDistance={40}
        enablePan={false}
        mouseButtons={{ LEFT: MOUSE.ROTATE, MIDDLE: MOUSE.DOLLY, RIGHT: MOUSE.ROTATE }}
      />
    </>
  )
}
