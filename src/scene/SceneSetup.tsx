import { OrbitControls, Stars } from '@react-three/drei'

interface SceneSetupProps {
  sunIntensity?: number
  sunPosition?: [number, number, number]
  orbitEnabled?: boolean
}

export function SceneSetup({ sunIntensity = 1.2, sunPosition = [20, 10, 10], orbitEnabled = true }: SceneSetupProps) {
  const fill: [number, number, number] = [-sunPosition[0] * 0.5, -sunPosition[1] * 0.5, -sunPosition[2] * 0.5]
  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight position={sunPosition} intensity={sunIntensity} castShadow={false} />
      <directionalLight position={fill} intensity={sunIntensity * 0.17} />
      <Stars radius={60} depth={50} count={3000} factor={2} saturation={0} fade />
      <OrbitControls
        enabled={orbitEnabled}
        enableDamping
        dampingFactor={0.08}
        minDistance={2}
        maxDistance={40}
        enablePan={false}
      />
    </>
  )
}
