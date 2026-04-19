import { useRef, useEffect } from 'react'
import { useControls, folder, button } from 'leva'
import { CoordFrame, EntityType } from '../math/types'
import type { AppState, Vec3 } from '../math/types'
import {
  llaToEcef, eciToEcef, enuToEcef, enuToNed, nedToEnu,
  ecefToLla, ecefToEnu, ecefToEci, gmst,
} from '../math/transforms'

function ecefFromInput(frame: CoordFrame, vals: Vec3, ecefCurrent: Vec3, epochMs: number): Vec3 {
  const g = gmst(epochMs)
  switch (frame) {
    case CoordFrame.ECEF:
      return vals
    case CoordFrame.ECI:
      return eciToEcef(vals, g)
    case CoordFrame.LLA: {
      const [lat, lon, alt] = vals
      return llaToEcef({ lat, lon, alt })
    }
    case CoordFrame.ENU: {
      const ref = ecefToLla(ecefCurrent)
      return enuToEcef(vals, ref)
    }
    case CoordFrame.NED: {
      const ref = ecefToLla(ecefCurrent)
      return enuToEcef(nedToEnu(vals), ref)
    }
    default:
      return ecefCurrent
  }
}

function ecefToDisplay(frame: CoordFrame, ecef: Vec3, epochMs: number): Vec3 {
  const g = gmst(epochMs)
  switch (frame) {
    case CoordFrame.ECEF:
      return ecef
    case CoordFrame.ECI:
      return ecefToEci(ecef, g)
    case CoordFrame.LLA: {
      const { lat, lon, alt } = ecefToLla(ecef)
      return [lat, lon, alt]
    }
    case CoordFrame.ENU: {
      const ref = ecefToLla(ecef)
      return ecefToEnu(ecef, ref)
    }
    case CoordFrame.NED: {
      const ref = ecefToLla(ecef)
      return enuToNed(ecefToEnu(ecef, ref))
    }
    default:
      return ecef
  }
}

function coordLabels(frame: CoordFrame): [string, string, string] {
  switch (frame) {
    case CoordFrame.LLA:  return ['Lat (°)', 'Lon (°)', 'Alt (m)']
    case CoordFrame.ENU:  return ['East (m)', 'North (m)', 'Up (m)']
    case CoordFrame.NED:  return ['North (m)', 'East (m)', 'Down (m)']
    default:              return ['X (m)', 'Y (m)', 'Z (m)']
  }
}

function defaultPosition(frame: CoordFrame): Vec3 {
  switch (frame) {
    case CoordFrame.LLA:  return [0, 0, 400_000]
    case CoordFrame.ECEF: return [6_778_137, 0, 0]
    case CoordFrame.ECI:  return [6_778_137, 0, 0]
    default:              return [0, 0, 0]
  }
}

interface ControlPanelProps {
  state: AppState
  onChange: (next: Partial<AppState>) => void
}

export function ControlPanel({ state, onChange }: ControlPanelProps) {
  // Always-current ref so static Leva onChange closures read fresh state
  const stateRef = useRef(state)
  stateRef.current = state

  const [labels0, labels1, labels2] = coordLabels(state.inputFrame)
  const displayed = ecefToDisplay(state.inputFrame, state.ecef, state.epochMs)
  const step = state.inputFrame === CoordFrame.LLA ? 0.1
             : (state.inputFrame === CoordFrame.ECEF || state.inputFrame === CoordFrame.ECI) ? 1000
             : 100

  // Static schema — Leva initialises values once and owns them from then on.
  // All callbacks read stateRef.current so they're never stale.
  useControls({
    Entity: folder({
      'Type': {
        value: state.entityType,
        options: Object.values(EntityType),
        onChange: (v: EntityType) => onChange({ entityType: v }),
      },
      'Input frame': {
        value: state.inputFrame,
        options: [CoordFrame.LLA, CoordFrame.ECEF, CoordFrame.ECI, CoordFrame.ENU, CoordFrame.NED],
        onChange: (v: CoordFrame) => onChange({ inputFrame: v }),
      },
      'Model scale': {
        value: state.entityScale,
        min: 0.1, max: 10, step: 0.1,
        onChange: (v: number) => onChange({ entityScale: v }),
      },
    }),

    Display: folder({
      'Show ECI':  { value: state.showFrames[CoordFrame.ECI],  onChange: (v: boolean) => onChange({ showFrames: { ...stateRef.current.showFrames, [CoordFrame.ECI]: v } }) },
      'Show ECEF': { value: state.showFrames[CoordFrame.ECEF], onChange: (v: boolean) => onChange({ showFrames: { ...stateRef.current.showFrames, [CoordFrame.ECEF]: v } }) },
      'Show LLA':  { value: state.showFrames[CoordFrame.LLA],  onChange: (v: boolean) => onChange({ showFrames: { ...stateRef.current.showFrames, [CoordFrame.LLA]: v } }) },
      'Show ENU':  { value: state.showFrames[CoordFrame.ENU],  onChange: (v: boolean) => onChange({ showFrames: { ...stateRef.current.showFrames, [CoordFrame.ENU]: v } }) },
      'Show NED':  { value: state.showFrames[CoordFrame.NED],  onChange: (v: boolean) => onChange({ showFrames: { ...stateRef.current.showFrames, [CoordFrame.NED]: v } }) },
      'Show Body': { value: state.showFrames[CoordFrame.Body], onChange: (v: boolean) => onChange({ showFrames: { ...stateRef.current.showFrames, [CoordFrame.Body]: v } }) },
      'Show angle arcs': { value: state.showAngleArcs, onChange: (v: boolean) => onChange({ showAngleArcs: v }) },
      'Axis scale': {
        value: state.axisScale,
        min: 0.2, max: 5, step: 0.1,
        onChange: (v: number) => onChange({ axisScale: v }),
      },
      'Earth opacity': {
        value: state.earthOpacity,
        min: 0, max: 1, step: 0.01,
        onChange: (v: number) => onChange({ earthOpacity: v }),
      },
      'Sun intensity': {
        value: state.sunIntensity,
        min: 0, max: 4, step: 0.05,
        onChange: (v: number) => onChange({ sunIntensity: v }),
      },
    }),
  })

  const [, setPosRaw] = useControls(() => ({
    Position: folder({
      pos_0: {
        label: labels0,
        value: displayed[0],
        step,
        onChange: (v: number) => {
          const s = stateRef.current
          const cur = ecefToDisplay(s.inputFrame, s.ecef, s.epochMs)
          onChange({ ecef: ecefFromInput(s.inputFrame, [v, cur[1], cur[2]], s.ecef, s.epochMs) })
        },
      },
      pos_1: {
        label: labels1,
        value: displayed[1],
        step,
        onChange: (v: number) => {
          const s = stateRef.current
          const cur = ecefToDisplay(s.inputFrame, s.ecef, s.epochMs)
          onChange({ ecef: ecefFromInput(s.inputFrame, [cur[0], v, cur[2]], s.ecef, s.epochMs) })
        },
      },
      pos_2: {
        label: labels2,
        value: displayed[2],
        step,
        onChange: (v: number) => {
          const s = stateRef.current
          const cur = ecefToDisplay(s.inputFrame, s.ecef, s.epochMs)
          onChange({ ecef: ecefFromInput(s.inputFrame, [cur[0], cur[1], v], s.ecef, s.epochMs) })
        },
      },
    }),
  }))
  const setPos = setPosRaw as (v: Record<string, unknown>) => void

  useEffect(() => {
    const s = stateRef.current
    const disp = ecefToDisplay(s.inputFrame, s.ecef, s.epochMs)
    setPos({ pos_0: disp[0], pos_1: disp[1], pos_2: disp[2] })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.ecef, state.inputFrame, state.epochMs])

  const [, setAttRaw] = useControls(() => ({
    Attitude: folder({
      'Parent frame': {
        value: state.attitudeFrame,
        options: [CoordFrame.ECI, CoordFrame.ECEF, CoordFrame.ENU, CoordFrame.NED],
        onChange: (v: CoordFrame) => onChange({ attitudeFrame: v }),
      },
      'Roll (°)': {
        value: state.attitude.roll,
        min: -180, max: 180, step: 0.1,
        onChange: (v: number) => onChange({ attitude: { ...stateRef.current.attitude, roll: v } }),
      },
      'Pitch (°)': {
        value: state.attitude.pitch,
        min: -90, max: 90, step: 0.1,
        onChange: (v: number) => onChange({ attitude: { ...stateRef.current.attitude, pitch: v } }),
      },
      'Yaw (°)': {
        value: state.attitude.yaw,
        min: -180, max: 180, step: 0.1,
        onChange: (v: number) => onChange({ attitude: { ...stateRef.current.attitude, yaw: v } }),
      },
    }),
  }))
  const setAtt = setAttRaw as (v: Record<string, unknown>) => void

  useEffect(() => {
    setAtt({
      'Roll (°)':  state.attitude.roll,
      'Pitch (°)': state.attitude.pitch,
      'Yaw (°)':   state.attitude.yaw,
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.attitude])

  // Derive time-of-day (UTC hours) from epoch for display
  const epochToTod = (ms: number) => {
    const d = new Date(ms)
    return d.getUTCHours() + d.getUTCMinutes() / 60 + d.getUTCSeconds() / 3600
  }
  const epochToIso = (ms: number) => new Date(ms).toISOString().slice(0, 19)
  const epochToGmstDeg = (ms: number) => +(gmst(ms) * 180 / Math.PI).toFixed(3)

  const [, setTimeRaw] = useControls(() => ({
    Time: folder({
      'UTC datetime': {
        value: epochToIso(state.epochMs),
        onChange: (v: string) => {
          if (v.length < 19) return
          const ms = new Date(v.endsWith('Z') ? v : v + 'Z').getTime()
          if (!isNaN(ms)) onChange({ epochMs: ms })
        },
      },
      'θ GMST (°)': {
        value: epochToGmstDeg(state.epochMs),
        min: 0, max: 360, step: 0.01,
        onChange: (v: number) => {
          const targetRad = v * Math.PI / 180
          const s = stateRef.current
          const curGmst = gmst(s.epochMs)
          let delta = targetRad - curGmst
          while (delta >  Math.PI) delta -= 2 * Math.PI
          while (delta < -Math.PI) delta += 2 * Math.PI
          // GMST rate ≈ one revolution per sidereal day
          const deltaMs = delta * (86_164_090.5 / (2 * Math.PI))
          onChange({ epochMs: s.epochMs + deltaMs })
        },
      },
      'Time of day (h)': {
        value: epochToTod(state.epochMs),
        min: 0, max: 24, step: 0.01,
        onChange: (v: number) => {
          const s = stateRef.current
          const d = new Date(s.epochMs)
          const midnight = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
          onChange({ epochMs: midnight + v * 3_600_000 })
        },
      },
      'Set to now': button(() => onChange({ epochMs: Date.now() })),
    }),
  }))
  // Leva doesn't infer flat keys through folder() — cast to allow programmatic updates
  const setTime = setTimeRaw as (v: Record<string, unknown>) => void

  useEffect(() => {
    setTime({
      'UTC datetime': epochToIso(state.epochMs),
      'θ GMST (°)':   epochToGmstDeg(state.epochMs),
      'Time of day (h)': epochToTod(state.epochMs),
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.epochMs])

  return null
}

export { defaultPosition, ecefFromInput, ecefToDisplay }
