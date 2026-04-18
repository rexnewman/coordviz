import { useTexture } from '@react-three/drei'
import { WGS84, DISPLAY_SCALE } from '../math/wgs84'

const a = WGS84.a / DISPLAY_SCALE
const b = WGS84.b / DISPLAY_SCALE

export function EarthMesh({ opacity = 1 }: { opacity?: number }) {
  const texture = useTexture('/earth.jpg')

  return (
    <mesh scale={[a, b, a]} rotation={[0, -Math.PI / 2, 0]}>
      <sphereGeometry args={[1, 64, 32]} />
      <meshStandardMaterial map={texture} transparent opacity={opacity} />
    </mesh>
  )
}
