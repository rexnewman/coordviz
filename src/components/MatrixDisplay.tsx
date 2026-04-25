import { useEffect, useRef } from 'react'
import katex from 'katex'
import 'katex/dist/katex.min.css'

interface MatrixDisplayProps {
  gmstRad: number
  latRad: number
  lonRad: number
}

function fmt(v: number) { return v.toFixed(4) }

function render(el: HTMLDivElement, latex: string) {
  katex.render(latex, el, { displayMode: true, throwOnError: false })
}

// Rz(θ): standard passive rotation about Z
function Rz(sym: [string, string]): string {
  const [c, s] = sym
  return String.raw`\begin{bmatrix}${c}&${s}&0\\-${s}&${c}&0\\0&0&1\end{bmatrix}`
}

// Ry(-(90°+φ)) = [-sinφ 0 cosφ; 0 1 0; -cosφ 0 -sinφ]
function RyNED(sym: [string, string]): string {
  const [c, s] = sym  // c=cosφ, s=sinφ
  return String.raw`\begin{bmatrix}-${s}&0&${c}\\0&1&0\\-${c}&0&-${s}\end{bmatrix}`
}

// M_{NED→ENU}: swap first two rows, negate third
const M_NED2ENU = String.raw`\begin{bmatrix}0&1&0\\1&0&0\\0&0&-1\end{bmatrix}`

export function MatrixDisplay({ gmstRad, latRad, lonRad }: MatrixDisplayProps) {
  const eciRef = useRef<HTMLDivElement>(null)
  const nedRef = useRef<HTMLDivElement>(null)
  const enuRef = useRef<HTMLDivElement>(null)

  // ECI → ECEF: single rotation Rz(θ)
  useEffect(() => {
    if (!eciRef.current) return
    const c = fmt(Math.cos(gmstRad)), s = fmt(Math.sin(gmstRad))
    const ns = fmt(-Math.sin(gmstRad))
    render(eciRef.current, String.raw`
      \small
      \begin{aligned}
        T^{\text{ECEF}/\text{ECI}}
          &= R_z(\theta) \\
          &= ${Rz([String.raw`\cos\theta`, String.raw`\sin\theta`])}
           = ${Rz([c, s])}
      \end{aligned}
    `)
    void ns  // ns included in Rz helper via -s
  }, [gmstRad])

  // ECEF → NED: Ry(-(90°+φ)) · Rz(λ)
  //   N̂ = [-sinφ cosλ, -sinφ sinλ,  cosφ]
  //   Ê = [-sinλ, cosλ, 0]
  //   D̂ = [-cosφ cosλ, -cosφ sinλ, -sinφ]
  useEffect(() => {
    if (!nedRef.current) return
    const cp = fmt(Math.cos(latRad))
    const cl = fmt(Math.cos(lonRad)), sl = fmt(Math.sin(lonRad))
    const nsp = fmt(-Math.sin(latRad)), nsl = fmt(-Math.sin(lonRad))
    const spcp = fmt(-Math.sin(latRad) * Math.cos(lonRad))
    const spsl = fmt(-Math.sin(latRad) * Math.sin(lonRad))
    const cpcp = fmt(-Math.cos(latRad) * Math.cos(lonRad))
    const cpsl = fmt(-Math.cos(latRad) * Math.sin(lonRad))
    render(nedRef.current, String.raw`
      \small
      \begin{aligned}
        T^{\text{NED}/\text{ECEF}}
          &= R_y\!\left(-(90^\circ\!+\varphi)\right)\cdot R_z(\lambda) \\
          &= ${RyNED([String.raw`\cos\!\varphi`, String.raw`\sin\!\varphi`])}
             ${Rz([String.raw`\cos\!\lambda`, String.raw`\sin\!\lambda`])} \\
          &= \begin{bmatrix}
               ${spcp} & ${spsl} & ${cp}  \\
               ${nsl}  & ${cl}   & 0      \\
               ${cpcp} & ${cpsl} & ${nsp}
             \end{bmatrix}
      \end{aligned}
    `)
    void sl  // suppress unused warning — sl appears inside fmt calls above
  }, [latRad, lonRad])

  // ECEF → ENU: M_{NED→ENU} · T^{NED/ECEF}  where M = [0 1 0; 1 0 0; 0 0 -1]
  //   (swap N↔E rows, negate D→U row)
  useEffect(() => {
    if (!enuRef.current) return
    const cp = fmt(Math.cos(latRad)), sp = fmt(Math.sin(latRad))
    const cl = fmt(Math.cos(lonRad))
    const nsl = fmt(-Math.sin(lonRad))
    const spcp = fmt(-Math.sin(latRad) * Math.cos(lonRad))
    const spsl = fmt(-Math.sin(latRad) * Math.sin(lonRad))
    const cpcp = fmt( Math.cos(latRad) * Math.cos(lonRad))
    const cpsl = fmt( Math.cos(latRad) * Math.sin(lonRad))
    render(enuRef.current, String.raw`
      \small
      \begin{aligned}
        T^{\text{ENU}/\text{ECEF}}
          &= ${M_NED2ENU} \cdot R_y\!\left(-(90^\circ\!+\varphi)\right)\cdot R_z(\lambda) \\
          &= ${M_NED2ENU}
             ${RyNED([String.raw`\cos\!\varphi`, String.raw`\sin\!\varphi`])}
             ${Rz([String.raw`\cos\!\lambda`, String.raw`\sin\!\lambda`])} \\
          &= \begin{bmatrix}
               ${nsl}  & ${cl}   & 0      \\
               ${spcp} & ${spsl} & ${cp}  \\
               ${cpcp} & ${cpsl} & ${sp}
             \end{bmatrix}
      \end{aligned}
    `)
  }, [latRad, lonRad])

  return (
    <div style={{
      position: 'absolute',
      top: 12,
      left: 12,
      color: '#ccd',
      fontFamily: 'serif',
      fontSize: '11px',
      pointerEvents: 'none',
      userSelect: 'none',
      background: 'rgba(10,10,20,0.60)',
      borderRadius: 6,
      padding: '8px 14px',
      maxWidth: 620,
      display: 'flex',
      flexDirection: 'column',
      gap: 2,
    }}>
      <div ref={eciRef} />
      <div ref={nedRef} />
      <div ref={enuRef} />
    </div>
  )
}
