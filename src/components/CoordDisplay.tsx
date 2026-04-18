import { CoordFrame } from '../math/types'
import type { Vec3 } from '../math/types'
import {
  ecefToLla, ecefToEnu, ecefToEci, enuToNed, gmst,
} from '../math/transforms'

interface CoordDisplayProps {
  ecef: Vec3
  epochMs: number
}

function fmt(n: number, decimals = 3): string {
  return n.toFixed(decimals)
}

export function CoordDisplay({ ecef, epochMs }: CoordDisplayProps) {
  const g = gmst(epochMs)
  const lla = ecefToLla(ecef)
  const eci = ecefToEci(ecef, g)
  const enu = ecefToEnu(ecef, lla)
  const ned = enuToNed(enu)

  const rows: { frame: string; vals: string[] }[] = [
    {
      frame: 'ECI',
      vals: [`X: ${fmt(eci[0])} m`, `Y: ${fmt(eci[1])} m`, `Z: ${fmt(eci[2])} m`],
    },
    {
      frame: 'ECEF',
      vals: [`X: ${fmt(ecef[0])} m`, `Y: ${fmt(ecef[1])} m`, `Z: ${fmt(ecef[2])} m`],
    },
    {
      frame: 'LLA',
      vals: [`Lat: ${fmt(lla.lat, 6)}°`, `Lon: ${fmt(lla.lon, 6)}°`, `Alt: ${fmt(lla.alt, 1)} m`],
    },
    {
      frame: 'ENU',
      vals: [`E: ${fmt(enu[0])} m`, `N: ${fmt(enu[1])} m`, `U: ${fmt(enu[2])} m`],
    },
    {
      frame: 'NED',
      vals: [`N: ${fmt(ned[0])} m`, `E: ${fmt(ned[1])} m`, `D: ${fmt(ned[2])} m`],
    },
  ]

  const frameColors: Record<string, string> = {
    ECI:  '#ff6666',
    ECEF: '#66ff66',
    LLA:  '#ffdd44',
    ENU:  '#66aaff',
    NED:  '#ff88cc',
  }

  return (
    <div style={{
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      background: 'rgba(10,10,20,0.88)',
      borderTop: '1px solid #223',
      display: 'flex',
      flexDirection: 'row',
      gap: '1px',
      fontFamily: 'monospace',
      fontSize: '11px',
      color: '#aab',
      zIndex: 10,
    }}>
      {rows.map(({ frame, vals }) => (
        <div key={frame} style={{
          flex: 1,
          padding: '6px 10px',
          borderRight: '1px solid #223',
        }}>
          <div style={{
            color: frameColors[frame],
            fontWeight: 'bold',
            marginBottom: 3,
            fontSize: '12px',
          }}>
            {frame}
          </div>
          {vals.map((v, i) => (
            <div key={i} style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {v}
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
