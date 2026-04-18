import { useRef } from 'react'
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
    }),

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

    Attitude: folder({
      'Parent frame': {
        value: state.attitudeFrame,
        options: [CoordFrame.ECI, CoordFrame.ECEF, CoordFrame.ENU, CoordFrame.NED],
        onChange: (v: CoordFrame) => onChange({ attitudeFrame: v }),
      },
      'Roll (°)': {
        value: state.attitude.roll,
        min: -180, max: 180, step: 1,
        onChange: (v: number) => onChange({ attitude: { ...stateRef.current.attitude, roll: v } }),
      },
      'Pitch (°)': {
        value: state.attitude.pitch,
        min: -90, max: 90, step: 1,
        onChange: (v: number) => onChange({ attitude: { ...stateRef.current.attitude, pitch: v } }),
      },
      'Yaw (°)': {
        value: state.attitude.yaw,
        min: -180, max: 180, step: 1,
        onChange: (v: number) => onChange({ attitude: { ...stateRef.current.attitude, yaw: v } }),
      },
    }),

    Time: folder({
      'Epoch (ms UTC)': {
        value: state.epochMs,
        step: 60_000,
        onChange: (v: number) => onChange({ epochMs: v }),
      },
      'GMST (°)': {
        value: (gmst(state.epochMs) * 180 / Math.PI).toFixed(3),
        editable: false,
      },
      'Set to now': button(() => onChange({ epochMs: Date.now() })),
    }),

    Display: folder({
      'Show ECI':  { value: state.showFrames[CoordFrame.ECI],  onChange: (v: boolean) => onChange({ showFrames: { ...stateRef.current.showFrames, [CoordFrame.ECI]: v } }) },
      'Show ECEF': { value: state.showFrames[CoordFrame.ECEF], onChange: (v: boolean) => onChange({ showFrames: { ...stateRef.current.showFrames, [CoordFrame.ECEF]: v } }) },
      'Show LLA':  { value: state.showFrames[CoordFrame.LLA],  onChange: (v: boolean) => onChange({ showFrames: { ...stateRef.current.showFrames, [CoordFrame.LLA]: v } }) },
      'Show ENU':  { value: state.showFrames[CoordFrame.ENU],  onChange: (v: boolean) => onChange({ showFrames: { ...stateRef.current.showFrames, [CoordFrame.ENU]: v } }) },
      'Show NED':  { value: state.showFrames[CoordFrame.NED],  onChange: (v: boolean) => onChange({ showFrames: { ...stateRef.current.showFrames, [CoordFrame.NED]: v } }) },
      'Show Body': { value: state.showFrames[CoordFrame.Body], onChange: (v: boolean) => onChange({ showFrames: { ...stateRef.current.showFrames, [CoordFrame.Body]: v } }) },
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
      'Time of day (h)': {
        value: state.timeOfDay,
        min: 0, max: 24, step: 0.1,
        onChange: (v: number) => onChange({ timeOfDay: v }),
      },
    }),
  })

  return null
}

export { defaultPosition, ecefFromInput, ecefToDisplay }
