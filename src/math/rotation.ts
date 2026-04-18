import type { Mat3, Quat, Vec3 } from './types'

// ---------------------------------------------------------------------------
// Basic vector ops
// ---------------------------------------------------------------------------

export function vec3Add(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
}

export function vec3Scale(v: Vec3, s: number): Vec3 {
  return [v[0] * s, v[1] * s, v[2] * s]
}

export function vec3Norm(v: Vec3): number {
  return Math.sqrt(v[0] ** 2 + v[1] ** 2 + v[2] ** 2)
}

export function vec3Normalize(v: Vec3): Vec3 {
  const n = vec3Norm(v)
  return n === 0 ? [0, 0, 0] : [v[0] / n, v[1] / n, v[2] / n]
}

// ---------------------------------------------------------------------------
// Matrix ops
// ---------------------------------------------------------------------------

/** Identity 3×3 */
export function mat3Identity(): Mat3 {
  return [1, 0, 0, 0, 1, 0, 0, 0, 1]
}

/** Multiply two 3×3 row-major matrices: C = A * B */
export function mat3Mul(A: Mat3, B: Mat3): Mat3 {
  return [
    A[0]*B[0] + A[1]*B[3] + A[2]*B[6],
    A[0]*B[1] + A[1]*B[4] + A[2]*B[7],
    A[0]*B[2] + A[1]*B[5] + A[2]*B[8],

    A[3]*B[0] + A[4]*B[3] + A[5]*B[6],
    A[3]*B[1] + A[4]*B[4] + A[5]*B[7],
    A[3]*B[2] + A[4]*B[5] + A[5]*B[8],

    A[6]*B[0] + A[7]*B[3] + A[8]*B[6],
    A[6]*B[1] + A[7]*B[4] + A[8]*B[7],
    A[6]*B[2] + A[7]*B[5] + A[8]*B[8],
  ]
}

/** Apply rotation matrix to a vector: v' = R * v */
export function mat3MulVec(R: Mat3, v: Vec3): Vec3 {
  return [
    R[0]*v[0] + R[1]*v[1] + R[2]*v[2],
    R[3]*v[0] + R[4]*v[1] + R[5]*v[2],
    R[6]*v[0] + R[7]*v[1] + R[8]*v[2],
  ]
}

/** Transpose (= inverse for rotation matrices) */
export function mat3Transpose(R: Mat3): Mat3 {
  return [R[0], R[3], R[6], R[1], R[4], R[7], R[2], R[5], R[8]]
}

// ---------------------------------------------------------------------------
// Elementary rotation matrices
// ---------------------------------------------------------------------------

/** Rotation about Z axis by angle θ (radians) */
export function Rz(theta: number): Mat3 {
  const c = Math.cos(theta), s = Math.sin(theta)
  return [c, -s, 0,  s, c, 0,  0, 0, 1]
}

/** Rotation about Y axis by angle θ (radians) */
export function Ry(theta: number): Mat3 {
  const c = Math.cos(theta), s = Math.sin(theta)
  return [c, 0, s,  0, 1, 0,  -s, 0, c]
}

/** Rotation about X axis by angle θ (radians) */
export function Rx(theta: number): Mat3 {
  const c = Math.cos(theta), s = Math.sin(theta)
  return [1, 0, 0,  0, c, -s,  0, s, c]
}

// ---------------------------------------------------------------------------
// Euler (3-2-1 / ZYX) ↔ rotation matrix
// ---------------------------------------------------------------------------

/**
 * Body rotation matrix from Euler 3-2-1 angles (yaw ψ, pitch θ, roll φ) in radians.
 * R_body_from_parent = Rx(φ) * Ry(θ) * Rz(ψ)
 */
export function eulerToMat3(roll: number, pitch: number, yaw: number): Mat3 {
  return mat3Mul(Rx(roll), mat3Mul(Ry(pitch), Rz(yaw)))
}

// ---------------------------------------------------------------------------
// Quaternion ops
// ---------------------------------------------------------------------------

/** Quaternion from axis-angle */
export function quatFromAxisAngle(axis: Vec3, angle: number): Quat {
  const half = angle / 2
  const s = Math.sin(half)
  const n = vec3Normalize(axis)
  return [Math.cos(half), n[0] * s, n[1] * s, n[2] * s]
}

/** Convert rotation matrix to quaternion [w,x,y,z] */
export function mat3ToQuat(R: Mat3): Quat {
  const trace = R[0] + R[4] + R[8]
  let w: number, x: number, y: number, z: number
  if (trace > 0) {
    const s = 0.5 / Math.sqrt(trace + 1)
    w = 0.25 / s
    x = (R[7] - R[5]) * s
    y = (R[2] - R[6]) * s
    z = (R[3] - R[1]) * s
  } else if (R[0] > R[4] && R[0] > R[8]) {
    const s = 2 * Math.sqrt(1 + R[0] - R[4] - R[8])
    w = (R[7] - R[5]) / s
    x = 0.25 * s
    y = (R[1] + R[3]) / s
    z = (R[2] + R[6]) / s
  } else if (R[4] > R[8]) {
    const s = 2 * Math.sqrt(1 + R[4] - R[0] - R[8])
    w = (R[2] - R[6]) / s
    x = (R[1] + R[3]) / s
    y = 0.25 * s
    z = (R[5] + R[7]) / s
  } else {
    const s = 2 * Math.sqrt(1 + R[8] - R[0] - R[4])
    w = (R[3] - R[1]) / s
    x = (R[2] + R[6]) / s
    y = (R[5] + R[7]) / s
    z = 0.25 * s
  }
  return [w, x, y, z]
}
