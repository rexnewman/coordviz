import { Suspense, useState, useCallback, useRef } from 'react'
import { Canvas } from '@react-three/fiber'
import { CoordFrame, EntityType } from './math/types'
import type { AppState, Vec3 } from './math/types'
import { llaToEcef, ecefToLla } from './math/transforms'
import { EarthMesh } from './scene/EarthMesh'
import { EntityMesh } from './scene/EntityMesh'
import { FrameAxes } from './scene/FrameAxes'
import { SceneSetup } from './scene/SceneSetup'
import { ControlPanel } from './components/ControlPanel'
import { CoordDisplay } from './components/CoordDisplay'
import { frameRotationInEcef, bodyRotationInEcef, gmst } from './math/transforms'

const DEFAULT_ECEF: Vec3 = llaToEcef({ lat: 0, lon: 0, alt: 400_000 })

const INITIAL_STATE: AppState = {
  entityType:    EntityType.Satellite,
  ecef:          DEFAULT_ECEF,
  inputFrame:    CoordFrame.LLA,
  attitude:      { roll: 0, pitch: 0, yaw: 0 },
  attitudeFrame: CoordFrame.NED,
  epochMs:       Date.now(),
  showFrames: {
    [CoordFrame.ECI]:  true,
    [CoordFrame.ECEF]: true,
    [CoordFrame.LLA]:  false,
    [CoordFrame.ENU]:  true,
    [CoordFrame.NED]:  true,
    [CoordFrame.Body]: true,
  },
  axisScale: 1.5,
  earthOpacity: 1,
  sunIntensity: 1.2,
  timeOfDay:    12,
}

const FRAME_LABELS: Partial<Record<CoordFrame, string>> = {
  [CoordFrame.ECI]:  'ECI',
  [CoordFrame.ECEF]: 'ECEF',
  [CoordFrame.LLA]:  'LLA',
  [CoordFrame.ENU]:  'ENU',
  [CoordFrame.NED]:  'NED',
}

const ZERO: Vec3 = [0, 0, 0]

export default function App() {
  const [state, setState] = useState<AppState>(INITIAL_STATE)
  const [orbitEnabled, setOrbitEnabled] = useState(true)
  // Incrementing this key remounts ControlPanel so Leva fields reset to current state
  const [panelKey, setPanelKey] = useState(0)
  const ecefRef = useRef(state.ecef)
  ecefRef.current = state.ecef

  const onChange = useCallback((next: Partial<AppState>) => {
    setState(prev => {
      // Suppress near-zero ecef updates to break sync-loop between drag and Leva onChange
      if (next.ecef && prev.ecef) {
        const [ax, ay, az] = next.ecef
        const [bx, by, bz] = prev.ecef
        if (Math.abs(ax - bx) < 0.001 && Math.abs(ay - by) < 0.001 && Math.abs(az - bz) < 0.001) {
          const { ecef: _ignored, ...rest } = next
          return Object.keys(rest).length ? { ...prev, ...rest } : prev
        }
      }
      return { ...prev, ...next }
    })
  }, [])

  const onDragStart = useCallback(() => setOrbitEnabled(false), [])
  const onDragEnd   = useCallback(() => {
    setOrbitEnabled(true)
    setPanelKey(k => k + 1)   // remount ControlPanel with updated initial values
  }, [])
  const onPositionChange = useCallback((ecef: Vec3) => onChange({ ecef }), [onChange])

  const g = gmst(state.epochMs)
  const axisLen = state.axisScale

  const lla = ecefToLla(state.ecef)
  const surfaceEcef: Vec3 = llaToEcef({ lat: lla.lat, lon: lla.lon, alt: 0 })

  const frameOrigin = (frame: CoordFrame): Vec3 => {
    if (frame === CoordFrame.ECI || frame === CoordFrame.ECEF) return ZERO
    if (frame === CoordFrame.LLA) return surfaceEcef
    return state.ecef  // ENU, NED
  }

  // Sun position in Three.js world space.
  // At timeOfDay=12 the sun is directly over the entity's meridian.
  // Each hour shifts the sub-solar longitude 15° west (Earth rotates east).
  const subSolarLon = (lla.lon - (state.timeOfDay - 12) * 15) * (Math.PI / 180)
  const SUN_DIST = 30
  const sunPosition: [number, number, number] = [
    Math.sin(subSolarLon) * SUN_DIST,  // Three.js X = ECEF Y
    0,                                  // equatorial sun (no declination)
    Math.cos(subSolarLon) * SUN_DIST,  // Three.js Z = ECEF X
  ]

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', background: '#0a0a0f' }}>
      {/* 3D viewport */}
      <Canvas
        camera={{ position: [0, 0, 18], fov: 45, near: 0.01, far: 200 }}
        gl={{ antialias: true }}
        style={{ position: 'absolute', inset: 0 }}
      >
        <SceneSetup sunIntensity={state.sunIntensity} sunPosition={sunPosition} orbitEnabled={orbitEnabled} />
        <Suspense fallback={null}>
          <EarthMesh opacity={state.earthOpacity} />
        </Suspense>
        <EntityMesh
          type={state.entityType}
          ecef={state.ecef}
          onPositionChange={onPositionChange}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
        />

        {/* Reference frame axes */}
        {(Object.keys(FRAME_LABELS) as CoordFrame[]).map(frame => {
          if (!state.showFrames[frame]) return null
          const rot = frameRotationInEcef(
            frame as 'ECI' | 'ECEF' | 'LLA' | 'ENU' | 'NED',
            state.ecef,
            g,
          )
          return (
            <FrameAxes
              key={frame}
              rotation={rot}
              originEcef={frameOrigin(frame)}
              length={axisLen}
            />
          )
        })}

        {/* Body frame axes */}
        {state.showFrames[CoordFrame.Body] && (
          <FrameAxes
            rotation={bodyRotationInEcef(
              state.attitudeFrame as 'ECI' | 'ECEF' | 'LLA' | 'ENU' | 'NED',
              state.ecef,
              g,
              state.attitude.roll,
              state.attitude.pitch,
              state.attitude.yaw,
            )}
            originEcef={state.ecef}
            length={axisLen * 1.3}
            opacity={0.75}
          />
        )}
      </Canvas>

      {/* key forces remount after drag so Leva fields reflect new position */}
      <ControlPanel key={panelKey} state={state} onChange={onChange} />

      {/* Bottom coordinate readout */}
      <CoordDisplay ecef={state.ecef} epochMs={state.epochMs} />

      {/* Legend */}
      <div style={{
        position: 'absolute',
        top: 12,
        left: '50%',
        transform: 'translateX(-50%)',
        color: '#556',
        fontFamily: 'monospace',
        fontSize: '11px',
        letterSpacing: '0.15em',
        pointerEvents: 'none',
        userSelect: 'none',
      }}>
        CoordViz &mdash; Drag to orbit &bull; Scroll to zoom
      </div>

      {/* Axis color legend */}
      <div style={{
        position: 'absolute',
        top: 40,
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        gap: 16,
        fontFamily: 'monospace',
        fontSize: '11px',
        pointerEvents: 'none',
        userSelect: 'none',
      }}>
        {[['#ff4444', 'X'], ['#44ff44', 'Y'], ['#4488ff', 'Z']].map(([color, label]) => (
          <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 18, height: 3, background: color, display: 'inline-block', borderRadius: 2 }} />
            <span style={{ color: '#778' }}>{label}</span>
          </span>
        ))}
      </div>
    </div>
  )
}
