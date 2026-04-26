import { Suspense, useState, useCallback, useRef, useMemo } from 'react'
import { Canvas } from '@react-three/fiber'
import { CoordFrame, EntityType } from './math/types'
import type { AppState, Vec3 } from './math/types'
import { Line } from '@react-three/drei'
import { llaToEcef, ecefToLla } from './math/transforms'
import { ecefToThree } from './math/wgs84'
import { AngleArcs } from './scene/AngleArcs'
import { AnimationController } from './scene/AnimationController'
import { AttitudeArcs } from './scene/AttitudeArcs'
import { AxisLabels } from './scene/AxisLabels'
import type { AxisEntry } from './scene/AxisLabels'
import { EarthMesh } from './scene/EarthMesh'
import { EntityMesh } from './scene/EntityMesh'
import { FrameAxes } from './scene/FrameAxes'
import { SceneSetup } from './scene/SceneSetup'
import { ControlPanel } from './components/ControlPanel'
import { CoordDisplay } from './components/CoordDisplay'
import { MatrixDisplay } from './components/MatrixDisplay'
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
  entityScale: 1,
  axisScale: 1.5,
  earthOpacity: 1,
  sunIntensity:   1.2,
  showAngleArcs:    true,
  showAttitudeArcs: true,
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

  // ── Playback ──────────────────────────────────────────────────────────────
  type PlayPhase = 'eci'
  const [playback, setPlayback] = useState<{ phase: PlayPhase; t: number } | null>(null)

  const onPlay = useCallback((phase: PlayPhase) => {
    setPlayback({ phase, t: 0 })
  }, [])

  const onPlayTick = useCallback((dt: number) => {
    setPlayback(prev => {
      if (!prev) return null
      const newT = prev.t + dt / 3   // 3-second animation
      return newT >= 1 ? null : { ...prev, t: newT }
    })
  }, [])

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
  const onPositionChange  = useCallback((ecef: Vec3) => onChange({ ecef }), [onChange])
  const onAttitudeChange  = useCallback(
    (attitude: AppState['attitude']) => onChange({ attitude }),
    [onChange],
  )

  const g = gmst(state.epochMs)
  // During ECI playback, sweep the effective GMST for ECI frame + GMST arc from 0 → g
  const animGmstRad = useMemo(
    () => (playback?.phase === 'eci' ? g * playback.t : g),
    [playback, g],
  )

  const lla = ecefToLla(state.ecef)
  const surfaceEcef: Vec3 = llaToEcef({ lat: lla.lat, lon: lla.lon, alt: 0 })

  // Center-origin axes (ECI/ECEF) extend axisScale units beyond entity altitude.
  // Local axes (ENU/NED/Body) use axisScale directly.
  const entityPos3 = ecefToThree(state.ecef)
  const entityDist = Math.sqrt(entityPos3[0]**2 + entityPos3[1]**2 + entityPos3[2]**2)
  const centerAxisLen = entityDist + state.axisScale
  const localAxisLen  = state.axisScale

  const frameOrigin = (frame: CoordFrame): Vec3 => {
    if (frame === CoordFrame.ECI || frame === CoordFrame.ECEF) return ZERO
    if (frame === CoordFrame.LLA) return surfaceEcef
    return state.ecef  // ENU, NED
  }

  // Sun position in Three.js world space.
  // At noon UTC the sun is near the prime meridian; each hour shifts 15° west.
  const d = new Date(state.epochMs)
  const timeOfDay = d.getUTCHours() + d.getUTCMinutes() / 60 + d.getUTCSeconds() / 3600
  const subSolarLon = (lla.lon - (timeOfDay - 12) * 15) * (Math.PI / 180)
  const SUN_DIST = 30
  const sunPosition: [number, number, number] = [
    Math.sin(subSolarLon) * SUN_DIST,  // Three.js X = ECEF Y
    0,                                  // equatorial sun (no declination)
    Math.cos(subSolarLon) * SUN_DIST,  // Three.js Z = ECEF X
  ]

  return (
    // onContextMenu suppresses the browser right-click menu so right-drag works
    <div style={{ width: '100vw', height: '100vh', position: 'relative', background: '#0a0a0f' }}
         onContextMenu={e => e.preventDefault()}>
      {/* 3D viewport */}
      <Canvas
        camera={{ position: [0, 0, 18], fov: 45, near: 0.01, far: 200 }}
        gl={{ antialias: true }}
        style={{ position: 'absolute', inset: 0 }}
      >
        <AnimationController playing={playback !== null} onTick={onPlayTick} />
        <SceneSetup sunIntensity={state.sunIntensity} sunPosition={sunPosition} orbitEnabled={orbitEnabled} />
        <Suspense fallback={null}>
          <EarthMesh opacity={state.earthOpacity} />
        </Suspense>
        <EntityMesh
          type={state.entityType}
          ecef={state.ecef}
          modelScale={state.entityScale}
          attitude={state.attitude}
          bodyRotation={bodyRotationInEcef(
            state.attitudeFrame as 'ECI' | 'ECEF' | 'LLA' | 'ENU' | 'NED',
            state.ecef, g,
            state.attitude.roll, state.attitude.pitch, state.attitude.yaw,
          )}
          onPositionChange={onPositionChange}
          onAttitudeChange={onAttitudeChange}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
        />

        {/* Reference frame axes */}
        {(Object.keys(FRAME_LABELS) as CoordFrame[]).map(frame => {
          const visible = state.showFrames[frame] || (frame === CoordFrame.ECI && playback?.phase === 'eci')
          if (!visible) return null
          const isCenterFrame = frame === CoordFrame.ECI || frame === CoordFrame.ECEF
          // ECI uses animated gmst during ECI playback so its axes sweep from ECEF alignment
          const effectiveGmst = frame === CoordFrame.ECI ? animGmstRad : g
          const rot = frameRotationInEcef(
            frame as 'ECI' | 'ECEF' | 'LLA' | 'ENU' | 'NED',
            state.ecef,
            effectiveGmst,
          )
          return (
            <FrameAxes
              key={frame}
              rotation={rot}
              originEcef={frameOrigin(frame)}
              length={isCenterFrame ? centerAxisLen : localAxisLen}
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
            length={localAxisLen * 1.3}
            opacity={0.75}
          />
        )}

        {/* Axis labels — rendered once across all frames for coincidence deconfliction */}
        {(() => {
          const entries: AxisEntry[] = []
          ;(Object.keys(FRAME_LABELS) as CoordFrame[]).forEach(frame => {
            const visible = state.showFrames[frame] || (frame === CoordFrame.ECI && playback?.phase === 'eci')
            if (!visible) return
            const isCenterFrame = frame === CoordFrame.ECI || frame === CoordFrame.ECEF
            const effectiveGmst = frame === CoordFrame.ECI ? animGmstRad : g
            entries.push({
              label: frame,
              rotation: frameRotationInEcef(
                frame as 'ECI' | 'ECEF' | 'LLA' | 'ENU' | 'NED',
                state.ecef,
                effectiveGmst,
              ),
              originEcef: frameOrigin(frame),
              length: isCenterFrame ? centerAxisLen : localAxisLen,
            })
          })
          if (state.showFrames[CoordFrame.Body]) {
            entries.push({
              label: 'Body',
              rotation: bodyRotationInEcef(
                state.attitudeFrame as 'ECI' | 'ECEF' | 'LLA' | 'ENU' | 'NED',
                state.ecef, g,
                state.attitude.roll, state.attitude.pitch, state.attitude.yaw,
              ),
              originEcef: state.ecef,
              length: localAxisLen * 1.3,
              opacity: 0.75,
            })
          }
          return <AxisLabels axes={entries} />
        })()}

        {/* Sub-satellite (nadir) point */}
        <Line
          points={[entityPos3, ecefToThree(surfaceEcef)]}
          color="#aaaacc"
          lineWidth={1}
          opacity={0.5}
          transparent
          dashed
          dashSize={0.15}
          gapSize={0.1}
        />
        <mesh position={ecefToThree(surfaceEcef)}>
          <sphereGeometry args={[0.055, 12, 12]} />
          <meshBasicMaterial color="#ccccff" />
        </mesh>
        {/* Angle arcs: λ, φ gated on NED/ENU visibility; θ gated on ECI visibility or playback */}
        {state.showAngleArcs && (
          <AngleArcs
            ecef={state.ecef}
            gmstRad={animGmstRad}
            showLonLat={state.showFrames[CoordFrame.NED] || state.showFrames[CoordFrame.ENU]}
            showGmst={state.showFrames[CoordFrame.ECI] || playback?.phase === 'eci'}
          />
        )}
        {/* Attitude arcs: ψ/θ/φ gated on Body frame visibility */}
        {state.showAttitudeArcs && state.showFrames[CoordFrame.Body] && (
          <AttitudeArcs
            ecef={state.ecef}
            gmstRad={g}
            attitudeFrame={state.attitudeFrame as 'ECI' | 'ECEF' | 'LLA' | 'ENU' | 'NED'}
            rollDeg={state.attitude.roll}
            pitchDeg={state.attitude.pitch}
            yawDeg={state.attitude.yaw}
          />
        )}
      </Canvas>

      {/* key forces remount after drag so Leva fields reflect new position */}
      <ControlPanel key={panelKey} state={state} onChange={onChange} onPlay={onPlay} />

      {/* Coordinate transformation matrices */}
      <MatrixDisplay
        gmstRad={g}
        latRad={lla.lat * Math.PI / 180}
        lonRad={lla.lon * Math.PI / 180}
        rollRad={state.attitude.roll   * Math.PI / 180}
        pitchRad={state.attitude.pitch * Math.PI / 180}
        yawRad={state.attitude.yaw     * Math.PI / 180}
        attitudeFrame={state.attitudeFrame}
      />

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
