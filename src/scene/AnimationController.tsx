import { useFrame } from '@react-three/fiber'

interface Props {
  playing: boolean
  onTick: (dt: number) => void
}

/** Drives animation by calling onTick(deltaSeconds) each frame while playing. */
export function AnimationController({ playing, onTick }: Props) {
  useFrame((_, delta) => {
    if (playing) onTick(delta)
  })
  return null
}
