import { useMemo } from 'react'
import { Line, Text, Billboard } from '@react-three/drei'
import { Vector3 } from 'three'
import { ecefToLla } from '../math/transforms'
import { ecefToThree } from '../math/wgs84'
import type { Vec3 } from '../math/types'

const DEG = Math.PI / 180

type Pt3 = [number, number, number]

/**
 * Generate arc points sweeping from `fromAngle` to `toAngle` in the plane
 * spanned by axis1 and axis2 (both unit vectors in Three.js world space).
 */
function arc(fromAngle: number, toAngle: number, radius: number, a1: Vector3, a2: Vector3, steps = 72): Pt3[] {
  const pts: Pt3[] = []
  for (let i = 0; i <= steps; i++) {
    const t = fromAngle + (toAngle - fromAngle) * (i / steps)
    const p = a1.clone().multiplyScalar(Math.cos(t) * radius)
                .addScaledVector(a2, Math.sin(t) * radius)
    pts.push([p.x, p.y, p.z])
  }
  return pts
}

/** Small tick lines perpendicular to an arc at a given angle, for readability. */
function tick(angle: number, radius: number, a1: Vector3, a2: Vector3, len = 0.18): Pt3[] {
  const inner = a1.clone().multiplyScalar(Math.cos(angle) * (radius - len / 2))
                  .addScaledVector(a2, Math.sin(angle) * (radius - len / 2))
  const outer = a1.clone().multiplyScalar(Math.cos(angle) * (radius + len / 2))
                  .addScaledVector(a2, Math.sin(angle) * (radius + len / 2))
  return [[inner.x, inner.y, inner.z], [outer.x, outer.y, outer.z]]
}

// ─── Three.js world-space reference directions ───────────────────────────────
// Our ecefToThree mapping: [Ex,Ey,Ez] → [Ey,Ez,Ex]
//   ECEF +X (prime meridian) → Three.js +Z
//   ECEF +Y (90 °E)          → Three.js +X
//   ECEF +Z (north pole)     → Three.js +Y
const PRIME_MERIDIAN = new Vector3(0, 0, 1)   // ECEF +X in Three.js
const EAST_90        = new Vector3(1, 0, 0)   // ECEF +Y in Three.js
const NORTH_POLE     = new Vector3(0, 1, 0)   // ECEF +Z in Three.js

// ─── Radii (display units; Earth equatorial radius ≈ 6.378) ──────────────────
// All three are set just above the surface so they're visible at full Earth opacity.
const R_GMST = 6.42
const R_LON  = 6.55
const R_LAT  = 6.68

interface AngleArcsProps {
  ecef: Vec3
  gmstRad: number
}

export function AngleArcs({ ecef, gmstRad }: AngleArcsProps) {
  const lla    = ecefToLla(ecef)
  const latRad = lla.lat * DEG
  const lonRad = lla.lon * DEG

  const entityPos = ecefToThree(ecef) as Pt3
  // Entity projected onto equatorial plane (Y = 0 in Three.js)
  const eqProj: Pt3 = [entityPos[0], 0, entityPos[2]]

  // Meridian direction in the equatorial plane (points toward entity's longitude)
  const meridianDir = new Vector3(Math.sin(lonRad), 0, Math.cos(lonRad))

  // ── Arcs ──────────────────────────────────────────────────────────────────
  // Longitude (λ): equatorial plane, prime meridian → entity's meridian
  const lonArc = useMemo(
    () => arc(0, lonRad, R_LON, PRIME_MERIDIAN, EAST_90),
    [lonRad],
  )

  // Latitude (φ): meridian plane, equatorial plane → entity's latitude
  const latArc = useMemo(
    () => arc(0, latRad, R_LAT, meridianDir, NORTH_POLE),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [latRad, lonRad],
  )

  // GMST (θ): equatorial plane, ECEF X → ECI X
  // ECI X in Three.js = Ry(-GMST) applied to +Z = (-sin(GMST), 0, cos(GMST))
  // Arc from ECEF X sweeping by +GMST using yAxis = (−1, 0, 0) gives correct direction.
  const gmstArc = useMemo(
    () => arc(0, gmstRad, R_GMST, PRIME_MERIDIAN, new Vector3(-1, 0, 0)),
    [gmstRad],
  )

  // ── Tick marks at arc ends ────────────────────────────────────────────────
  const lonTickEnd  = tick(lonRad,  R_LON, PRIME_MERIDIAN, EAST_90)
  const latTickEnd  = tick(latRad,  R_LAT, meridianDir, NORTH_POLE)
  const gmstTickEnd = tick(gmstRad, R_GMST, PRIME_MERIDIAN, new Vector3(-1, 0, 0))

  // ── Label positions (radially outward from arc endpoint) ─────────────────
  const lonLabelPos = new Vector3(
    Math.sin(lonRad),
    0,
    Math.cos(lonRad),
  ).multiplyScalar(R_LON * 1.2).toArray() as Pt3

  // Label at arc midpoint, offset radially outward — vertically centred on the arc,
  // to the side (outward), and clear of the entity / attitude arcs at the endpoint.
  const latMidDir = meridianDir.clone()
    .multiplyScalar(Math.cos(latRad / 2))
    .addScaledVector(NORTH_POLE, Math.sin(latRad / 2))
  const latLabelPos = latMidDir.clone()
    .multiplyScalar(R_LAT * 1.2)
    .toArray() as Pt3

  const gmstLabelPos = new Vector3(
    -Math.sin(gmstRad),
    0,
    Math.cos(gmstRad),
  ).multiplyScalar(R_GMST * 1.2).toArray() as Pt3

  const COL_LON  = '#ffcc00'
  const COL_LAT  = '#00ffcc'
  const COL_GMST = '#ff8844'
  const COL_PROJ = '#666677'

  return (
    <group>
      {/* ── Projection geometry (always visible above Earth) ── */}
      {/* Vertical drop: entity → equatorial plane */}
      <Line points={[entityPos, eqProj]} color={COL_PROJ} lineWidth={1} opacity={0.6} transparent />
      {/* Equatorial arm: origin → equatorial projection */}
      <Line points={[[0, 0, 0], eqProj]} color={COL_PROJ} lineWidth={1} opacity={0.6} transparent />
      {/* Small dot at equatorial projection */}
      <mesh position={eqProj}>
        <sphereGeometry args={[0.06, 8, 8]} />
        <meshBasicMaterial color={COL_PROJ} />
      </mesh>

      {/* ── Reference stubs at arc start (0 °) ── */}
      {/* Prime meridian stub for lon & GMST */}
      <Line points={[[0,0,0], [0, 0, R_LON * 1.05]]}  color={COL_LON}  lineWidth={1} opacity={0.3} transparent />
      <Line points={[[0,0,0], [0, 0, R_GMST * 1.05]]} color={COL_GMST} lineWidth={1} opacity={0.3} transparent />
      {/* Meridian stub for lat */}
      <Line
        points={[[0,0,0], meridianDir.clone().multiplyScalar(R_LAT * 1.05).toArray() as Pt3]}
        color={COL_LAT} lineWidth={1} opacity={0.3} transparent
      />

      {/* ── Longitude arc ── */}
      <Line points={lonArc} color={COL_LON} lineWidth={2.5} />
      <Line points={lonTickEnd} color={COL_LON} lineWidth={2} />
      <Billboard position={lonLabelPos}>
        <Text fontSize={0.28} color={COL_LON} anchorX="center" anchorY="middle">
          {`λ = ${lla.lon.toFixed(1)}°`}
        </Text>
      </Billboard>

      {/* ── Latitude arc ── */}
      <Line points={latArc} color={COL_LAT} lineWidth={2.5} />
      <Line points={latTickEnd} color={COL_LAT} lineWidth={2} />
      <Billboard position={latLabelPos}>
        <Text fontSize={0.28} color={COL_LAT} anchorX="center" anchorY="middle">
          {`φ = ${lla.lat.toFixed(1)}°`}
        </Text>
      </Billboard>

      {/* ── GMST arc ── */}
      <Line points={gmstArc} color={COL_GMST} lineWidth={2.5} />
      <Line points={gmstTickEnd} color={COL_GMST} lineWidth={2} />
      <Billboard position={gmstLabelPos}>
        <Text fontSize={0.28} color={COL_GMST} anchorX="center" anchorY="middle">
          {`θ = ${(gmstRad * 180 / Math.PI).toFixed(1)}°`}
        </Text>
      </Billboard>
    </group>
  )
}
