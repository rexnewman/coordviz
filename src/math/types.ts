/** Three-element vector [x, y, z] */
export type Vec3 = [number, number, number]

/** 3×3 rotation matrix stored row-major */
export type Mat3 = [
  number, number, number,
  number, number, number,
  number, number, number,
]

/** Unit quaternion [w, x, y, z] */
export type Quat = [number, number, number, number]

export enum CoordFrame {
  ECI  = 'ECI',
  ECEF = 'ECEF',
  LLA  = 'LLA',
  ENU  = 'ENU',
  NED  = 'NED',
  Body = 'Body',
}

export enum EntityType {
  Satellite = 'Satellite',
  Airplane  = 'Airplane',
}

/** Attitude as Euler 3-2-1 angles in degrees (yaw → pitch → roll) */
export interface Attitude {
  roll:  number
  pitch: number
  yaw:   number
}

/** LLA position: lat/lon in degrees, altitude in metres */
export interface LLAPosition {
  lat: number
  lon: number
  alt: number
}

/** The canonical internal state driving the whole app */
export interface AppState {
  entityType:    EntityType
  /** Position stored internally as ECEF metres */
  ecef:          Vec3
  inputFrame:    CoordFrame
  attitude:      Attitude
  /** UTC epoch as JS Date timestamp (ms) */
  epochMs:       number
  showFrames:    Record<CoordFrame, boolean>
  entityScale:    number
  axisScale:      number
  earthOpacity:   number
  sunIntensity:   number
  showAngleArcs:     boolean
  showAttitudeArcs:  boolean
}
