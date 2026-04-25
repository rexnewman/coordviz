import { useMemo } from 'react'
import { Line, Text, Billboard } from '@react-three/drei'
import { Vector3 } from 'three'
import { frameRotationInEcef } from '../math/transforms'
import { ecefToThree } from '../math/wgs84'
import type { Vec3, Mat3 } from '../math/types'

const DEG = Math.PI / 180

type Pt3 = [number, number, number]

function arc(
  fromAngle: number, toAngle: number, radius: number,
  a1: Vector3, a2: Vector3, center: Vector3, steps = 72,
): Pt3[] {
  const pts: Pt3[] = []
  for (let i = 0; i <= steps; i++) {
    const t = fromAngle + (toAngle - fromAngle) * (i / steps)
    const p = a1.clone().multiplyScalar(Math.cos(t) * radius)
                .addScaledVector(a2, Math.sin(t) * radius)
                .add(center)
    pts.push([p.x, p.y, p.z])
  }
  return pts
}

function tick(
  angle: number, radius: number,
  a1: Vector3, a2: Vector3, center: Vector3, len = 0.08,
): Pt3[] {
  const ri = radius - len / 2
  const ro = radius + len / 2
  const ca = Math.cos(angle), sa = Math.sin(angle)
  const inner = a1.clone().multiplyScalar(ca * ri).addScaledVector(a2, sa * ri).add(center)
  const outer = a1.clone().multiplyScalar(ca * ro).addScaledVector(a2, sa * ro).add(center)
  return [[inner.x, inner.y, inner.z], [outer.x, outer.y, outer.z]]
}

// Extract column `col` from a row-major Mat3 and convert ECEF → Three.js world space.
// ecefToThree mapping: [Ex,Ey,Ez] → [Ey,Ez,Ex], so col j → new Vector3(R[j+3], R[j+6], R[j]).
function colFromMat(R: Mat3, col: number): Vector3 {
  return new Vector3(R[col + 3], R[col + 6], R[col])
}

// ─── Radii (Three.js display units) ──────────────────────────────────────────
// Staggered so all three arcs remain visually distinct at any view angle.
const R_YAW   = 0.75
const R_PITCH = 0.90
const R_ROLL  = 1.05

const MIN_ARC_RAD = 0.5 * DEG   // don't draw arc for angles smaller than this

const COL_YAW   = '#cc44ff'
const COL_PITCH = '#ff5599'
const COL_ROLL  = '#44bbff'

interface AttitudeArcsProps {
  ecef: Vec3
  gmstRad: number
  attitudeFrame: 'ECI' | 'ECEF' | 'LLA' | 'ENU' | 'NED'
  rollDeg: number
  pitchDeg: number
  yawDeg: number
}

export function AttitudeArcs({
  ecef, gmstRad, attitudeFrame, rollDeg, pitchDeg, yawDeg,
}: AttitudeArcsProps) {
  const {
    yawArcPts, pitchArcPts, rollArcPts,
    yawTick, pitchTick, rollTick,
    stubYaw, stubPitch, stubRoll,
    yawLabelPos, pitchLabelPos, rollLabelPos,
  } = useMemo(() => {
    const yawRad   = yawDeg   * DEG
    const pitchRad = pitchDeg * DEG
    const rollRad  = rollDeg  * DEG

    const ep = ecefToThree(ecef)
    const center = new Vector3(ep[0], ep[1], ep[2])
    const Rp = frameRotationInEcef(attitudeFrame, ecef, gmstRad)

    // Parent frame axes in Three.js world space
    const pX = colFromMat(Rp, 0)
    const pY = colFromMat(Rp, 1)
    const pZ = colFromMat(Rp, 2)

    // ── Intermediate frame 1: yaw ψ about parent Z ───────────────────────────
    // X1 = cos(ψ)·pX + sin(ψ)·pY  (direction from which pitch arc starts)
    // Y1 = −sin(ψ)·pX + cos(ψ)·pY (direction from which roll arc starts, unchanged by pitch)
    // Z1 = pZ                       (pitch axis, unchanged by yaw)
    const cy = Math.cos(yawRad), sy = Math.sin(yawRad)
    const X1 = pX.clone().multiplyScalar(cy).addScaledVector(pY, sy)
    const Y1 = pX.clone().multiplyScalar(-sy).addScaledVector(pY, cy)
    const Z1 = pZ.clone()

    // ── Intermediate frame 2: pitch θ about Y1 ───────────────────────────────
    // Ry(θ)·X1 = cos(θ)·X1 − sin(θ)·Z1  →  a2 for pitch arc = −Z1
    // Z2 = sin(θ)·X1 + cos(θ)·Z1          (roll's a2 axis)
    // Y2 = Y1                              (unchanged by pitch)
    const cp = Math.cos(pitchRad), sp = Math.sin(pitchRad)
    const X2   = X1.clone().multiplyScalar(cp).addScaledVector(Z1, -sp)
    const Y2   = Y1.clone()
    const Z2   = X1.clone().multiplyScalar(sp).addScaledVector(Z1, cp)
    const negZ1 = Z1.clone().negate()

    // ── Arcs (suppressed for |angle| < 0.5°) ─────────────────────────────────
    const yawArcPts   = Math.abs(yawRad)   >= MIN_ARC_RAD ? arc(0, yawRad,   R_YAW,   pX, pY,   center) : null
    const pitchArcPts = Math.abs(pitchRad) >= MIN_ARC_RAD ? arc(0, pitchRad, R_PITCH, X1, negZ1, center) : null
    const rollArcPts  = Math.abs(rollRad)  >= MIN_ARC_RAD ? arc(0, rollRad,  R_ROLL,  Y2, Z2,   center) : null

    // ── Tick marks at arc endpoint (current angle) ────────────────────────────
    const yawTick   = tick(yawRad,   R_YAW,   pX, pY,   center)
    const pitchTick = tick(pitchRad, R_PITCH, X1, negZ1, center)
    const rollTick  = tick(rollRad,  R_ROLL,  Y2, Z2,   center)

    // ── Reference stubs: entity center → zero-angle start direction ───────────
    const o = center.toArray() as Pt3
    const stubYaw:   Pt3[] = [o, center.clone().addScaledVector(pX, R_YAW   * 1.05).toArray() as Pt3]
    const stubPitch: Pt3[] = [o, center.clone().addScaledVector(X1, R_PITCH * 1.05).toArray() as Pt3]
    const stubRoll:  Pt3[] = [o, center.clone().addScaledVector(Y2, R_ROLL  * 1.05).toArray() as Pt3]

    // ── Label positions: radially outward from arc endpoint ───────────────────
    // Yaw endpoint direction  = X1 (the post-yaw x-axis)
    // Pitch endpoint direction = X2 (the post-pitch x-axis)
    // Roll endpoint direction  = cos(φ)·Y2 + sin(φ)·Z2  (the post-roll y-axis)
    const yawLabelPos   = center.clone().addScaledVector(X1, R_YAW   * 1.4).toArray() as Pt3
    const pitchLabelPos = center.clone().addScaledVector(X2, R_PITCH * 1.4).toArray() as Pt3
    const rollEndDir    = Y2.clone().multiplyScalar(Math.cos(rollRad)).addScaledVector(Z2, Math.sin(rollRad))
    const rollLabelPos  = center.clone().addScaledVector(rollEndDir, R_ROLL * 1.4).toArray() as Pt3

    return {
      yawArcPts, pitchArcPts, rollArcPts,
      yawTick, pitchTick, rollTick,
      stubYaw, stubPitch, stubRoll,
      yawLabelPos, pitchLabelPos, rollLabelPos,
    }
  }, [ecef, gmstRad, attitudeFrame, rollDeg, pitchDeg, yawDeg])

  return (
    <group>
      {/* Reference stubs from entity center in the zero-angle start direction */}
      <Line points={stubYaw}   color={COL_YAW}   lineWidth={1} opacity={0.3} transparent />
      <Line points={stubPitch} color={COL_PITCH} lineWidth={1} opacity={0.3} transparent />
      <Line points={stubRoll}  color={COL_ROLL}  lineWidth={1} opacity={0.3} transparent />

      {/* Yaw arc ψ: sweeps from parent X toward parent Y */}
      {yawArcPts && <Line points={yawArcPts} color={COL_YAW} lineWidth={2.5} />}
      <Line points={yawTick} color={COL_YAW} lineWidth={2} />
      <Billboard position={yawLabelPos}>
        <Text fontSize={0.22} color={COL_YAW} anchorX="center" anchorY="middle">
          {`ψ = ${yawDeg.toFixed(1)}°`}
        </Text>
      </Billboard>

      {/* Pitch arc θ: sweeps from post-yaw X1 toward −Z1 (up in NED, down in ENU) */}
      {pitchArcPts && <Line points={pitchArcPts} color={COL_PITCH} lineWidth={2.5} />}
      <Line points={pitchTick} color={COL_PITCH} lineWidth={2} />
      <Billboard position={pitchLabelPos}>
        <Text fontSize={0.22} color={COL_PITCH} anchorX="center" anchorY="middle">
          {`θ = ${pitchDeg.toFixed(1)}°`}
        </Text>
      </Billboard>

      {/* Roll arc φ: sweeps from post-pitch Y2 toward Z2 */}
      {rollArcPts && <Line points={rollArcPts} color={COL_ROLL} lineWidth={2.5} />}
      <Line points={rollTick} color={COL_ROLL} lineWidth={2} />
      <Billboard position={rollLabelPos}>
        <Text fontSize={0.22} color={COL_ROLL} anchorX="center" anchorY="middle">
          {`φ = ${rollDeg.toFixed(1)}°`}
        </Text>
      </Billboard>
    </group>
  )
}
