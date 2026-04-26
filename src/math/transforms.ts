/**
 * All frame-to-frame coordinate transformations.
 *
 * Internal position hub: ECEF (metres).
 * Three.js world space = ECEF / DISPLAY_SCALE.
 *
 * Frame conventions:
 *   ECI  — X toward vernal equinox, Z toward north pole (inertial)
 *   ECEF — X toward prime meridian / equator, Z toward north pole (rotates with Earth)
 *   LLA  — geodetic lat (°), lon (°), alt (m) on WGS-84
 *   ENU  — East, North, Up at entity position (local tangent plane)
 *   NED  — North, East, Down at entity position
 */

import { WGS84, primeVerticalRadius } from './wgs84'
import { Rz, Ry, Rx, mat3MulVec, mat3Transpose, mat3Mul } from './rotation'
import type { Vec3, Mat3, LLAPosition } from './types'

const DEG = Math.PI / 180

// ---------------------------------------------------------------------------
// LLA ↔ ECEF
// ---------------------------------------------------------------------------

/** LLA (degrees / metres) → ECEF (metres) */
export function llaToEcef(lla: LLAPosition): Vec3 {
  const lat = lla.lat * DEG
  const lon = lla.lon * DEG
  const N = primeVerticalRadius(lat)
  const r = (N + lla.alt) * Math.cos(lat)
  return [
    r * Math.cos(lon),
    r * Math.sin(lon),
    (N * (1 - WGS84.e2) + lla.alt) * Math.sin(lat),
  ]
}

/**
 * ECEF (metres) → LLA (degrees / metres).
 * Uses Bowring iterative method.
 */
export function ecefToLla(ecef: Vec3): LLAPosition {
  const [x, y, z] = ecef
  const lon = Math.atan2(y, x)
  const p = Math.sqrt(x * x + y * y)

  // Initial estimate
  let lat = Math.atan2(z, p * (1 - WGS84.e2))

  for (let i = 0; i < 10; i++) {
    const sinLat = Math.sin(lat)
    const N = primeVerticalRadius(lat)
    const latNew = Math.atan2(z + WGS84.e2 * N * sinLat, p)
    if (Math.abs(latNew - lat) < 1e-12) { lat = latNew; break }
    lat = latNew
  }

  const sinLat = Math.sin(lat)
  const N = primeVerticalRadius(lat)
  const alt = p / Math.cos(lat) - N || z / sinLat - N * (1 - WGS84.e2)

  return { lat: lat / DEG, lon: lon / DEG, alt }
}

// ---------------------------------------------------------------------------
// ECI ↔ ECEF
// ---------------------------------------------------------------------------

/**
 * Compute Greenwich Mean Sidereal Time (radians) from a JS timestamp (ms).
 * Uses the standard formula referenced to J2000.0.
 */
export function gmst(epochMs: number): number {
  // Julian date of epoch
  const JD = epochMs / 86_400_000 + 2_440_587.5
  // Julian centuries from J2000.0
  const T = (JD - 2_451_545.0) / 36_525
  // GMST in seconds (IAU 1982)
  const gmstSec =
    67_310.54841 +
    (876_600 * 3_600 + 8_640_184.812866) * T +
    0.093104 * T * T -
    6.2e-6 * T * T * T
  return ((gmstSec % 86_400) * (2 * Math.PI / 86_400) + 2 * Math.PI) % (2 * Math.PI)
}

/** ECEF → ECI given GMST angle (radians) */
export function ecefToEci(ecef: Vec3, gmstRad: number): Vec3 {
  return mat3MulVec(Rz(-gmstRad), ecef)
}

/** ECI → ECEF given GMST angle (radians) */
export function eciToEcef(eci: Vec3, gmstRad: number): Vec3 {
  return mat3MulVec(Rz(gmstRad), eci)
}

// ---------------------------------------------------------------------------
// ECEF ↔ ENU / NED
// ---------------------------------------------------------------------------

/**
 * Rotation matrix from ECEF to ENU at geodetic reference position.
 * Columns of the inverse (= rows here) are [East, North, Up] unit vectors in ECEF.
 */
export function ecefToEnuMatrix(ref: LLAPosition): Mat3 {
  const lat = ref.lat * DEG
  const lon = ref.lon * DEG
  const sinLat = Math.sin(lat), cosLat = Math.cos(lat)
  const sinLon = Math.sin(lon), cosLon = Math.cos(lon)
  // R_enu_from_ecef — rows are E, N, U expressed in ECEF
  return [
    -sinLon,           cosLon,          0,
    -sinLat * cosLon, -sinLat * sinLon, cosLat,
     cosLat * cosLon,  cosLat * sinLon, sinLat,
  ]
}

/** ECEF position → ENU (metres) relative to reference LLA */
export function ecefToEnu(ecef: Vec3, ref: LLAPosition): Vec3 {
  const refEcef = llaToEcef(ref)
  const delta: Vec3 = [ecef[0] - refEcef[0], ecef[1] - refEcef[1], ecef[2] - refEcef[2]]
  return mat3MulVec(ecefToEnuMatrix(ref), delta)
}

/** ENU (metres) relative to reference LLA → ECEF */
export function enuToEcef(enu: Vec3, ref: LLAPosition): Vec3 {
  const R = mat3Transpose(ecefToEnuMatrix(ref))
  const refEcef = llaToEcef(ref)
  const rot = mat3MulVec(R, enu)
  return [rot[0] + refEcef[0], rot[1] + refEcef[1], rot[2] + refEcef[2]]
}

/** ENU → NED: swap axes and negate Up */
export function enuToNed(enu: Vec3): Vec3 {
  return [enu[1], enu[0], -enu[2]]   // [N, E, D]
}

/** NED → ENU */
export function nedToEnu(ned: Vec3): Vec3 {
  return [ned[1], ned[0], -ned[2]]   // [E, N, U]
}

// ---------------------------------------------------------------------------
// Frame rotation matrices (for axis visualization)
// ---------------------------------------------------------------------------

/**
 * Returns the 3×3 rotation matrix whose columns are the basis vectors of
 * the given frame expressed in ECEF, at the entity's ECEF position.
 * Used by FrameAxes to orient the axis arrows.
 */
export function frameRotationInEcef(
  frame: 'ECI' | 'ECEF' | 'LLA' | 'ENU' | 'NED',
  ecef: Vec3,
  gmstRad: number,
): Mat3 {
  switch (frame) {
    case 'ECI':
      return Rz(-gmstRad)
    case 'ECEF':
      return [1, 0, 0, 0, 1, 0, 0, 0, 1]
    case 'LLA': {
      // LLA origin sits on the surface; use ENU orientation (East, North, Up)
      const lla = ecefToLla(ecef)
      return mat3Transpose(ecefToEnuMatrix(lla))
    }
    case 'ENU': {
      const lla = ecefToLla(ecef)
      return mat3Transpose(ecefToEnuMatrix(lla))
    }
    case 'NED': {
      const lla = ecefToLla(ecef)
      const R_enu = mat3Transpose(ecefToEnuMatrix(lla))
      return [
         R_enu[1],  R_enu[0], -R_enu[2],
         R_enu[4],  R_enu[3], -R_enu[5],
         R_enu[7],  R_enu[6], -R_enu[8],
      ]
    }
  }
}

/**
 * Body frame rotation in ECEF: compose parent frame with Euler 3-2-1 attitude.
 * @param parentFrame the reference frame for the attitude
 * @param ecef entity position in ECEF
 * @param gmstRad GMST angle
 * @param rollDeg roll angle in degrees
 * @param pitchDeg pitch angle in degrees
 * @param yawDeg yaw angle in degrees
 */
export function bodyRotationInEcef(
  parentFrame: 'ECI' | 'ECEF' | 'LLA' | 'ENU' | 'NED',
  ecef: Vec3,
  gmstRad: number,
  rollDeg: number,
  pitchDeg: number,
  yawDeg: number,
): Mat3 {
  const R_parent = frameRotationInEcef(parentFrame, ecef, gmstRad)
  // 3-2-1 intrinsic: yaw about body-Z, then pitch about body-Y₁, then roll about body-X₂.
  // Columns = body axes in parent → Rz(ψ)·Ry(θ)·Rx(φ).
  const R_body = mat3Mul(Rz(yawDeg * DEG), mat3Mul(Ry(pitchDeg * DEG), Rx(rollDeg * DEG)))
  return mat3Mul(R_parent, R_body)
}
