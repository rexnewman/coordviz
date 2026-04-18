/** WGS-84 ellipsoid constants */
export const WGS84 = {
  /** Semi-major axis (metres) */
  a: 6_378_137.0,
  /** Flattening */
  f: 1 / 298.257_223_563,
  /** First eccentricity squared */
  get e2() { return 2 * this.f - this.f * this.f },
  /** Semi-minor axis (metres) */
  get b() { return this.a * (1 - this.f) },
} as const

/**
 * Returns the radius of curvature in the prime vertical N(lat).
 * @param lat geodetic latitude in radians
 */
export function primeVerticalRadius(lat: number): number {
  const sinLat = Math.sin(lat)
  return WGS84.a / Math.sqrt(1 - WGS84.e2 * sinLat * sinLat)
}

/** Display scale factor: divide ECEF metres by this so Earth ≈ 6.378 units in Three.js */
export const DISPLAY_SCALE = 1_000_000

/**
 * Convert ECEF metres to Three.js world-space coordinates.
 * Mapping: Three.js X = ECEF Y,  Three.js Y = ECEF Z,  Three.js Z = ECEF X
 * This puts north pole at Three.js +Y (up) and prime meridian at Three.js +Z (facing default camera).
 */
export function ecefToThree(ecef: [number, number, number]): [number, number, number] {
  return [ecef[1] / DISPLAY_SCALE, ecef[2] / DISPLAY_SCALE, ecef[0] / DISPLAY_SCALE]
}

/** Inverse of ecefToThree: Three.js world coords → ECEF metres */
export function threeToEcef(three: [number, number, number]): [number, number, number] {
  return [three[2] * DISPLAY_SCALE, three[0] * DISPLAY_SCALE, three[1] * DISPLAY_SCALE]
}
