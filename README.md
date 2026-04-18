# CoordViz

Interactive 3D visualizer for aerospace coordinate frames built with React, Three.js, and TypeScript.

## Features

- **WGS-84 Earth** rendered with a Blue Marble texture
- **Multiple reference frames** displayed simultaneously as axis triads:
  - ECI (Earth-Centered Inertial) — origin at Earth center
  - ECEF (Earth-Centered Earth-Fixed) — origin at Earth center
  - LLA (geodetic surface point) — origin on the Earth's surface below the entity
  - ENU (East-North-Up) — local tangent plane at the entity
  - NED (North-East-Down) — local tangent plane at the entity
  - Body frame — entity attitude relative to any parent frame
- **Drag-to-move**: click and drag the entity across the Earth's surface (altitude preserved)
- **Leva control panel** for position (LLA / ECEF / ECI / ENU / NED), attitude (roll / pitch / yaw), epoch, and display settings
- **Real-time coordinate readout** showing ECI, ECEF, LLA, ENU, and NED simultaneously
- **Lighting controls**: sun intensity and time-of-day slider that positions the sun relative to the entity's meridian
- **Earth opacity** slider for seeing through the globe to frame origins

## Getting Started

```bash
npm install
npm run dev
```

Then open [http://localhost:5173](http://localhost:5173).

## Controls

| Action | How |
|---|---|
| Orbit camera | Click and drag background |
| Zoom | Scroll wheel |
| Move entity | Click and drag the satellite/airplane |
| Set position | Leva panel → Position (Lat/Lon/Alt or other frame) |
| Set attitude | Leva panel → Attitude |
| Toggle frames | Leva panel → Display → Show ECI / ECEF / … |
| Adjust lighting | Leva panel → Display → Sun intensity / Time of day |

## Coordinate Frame Conventions

| Frame | Origin | Axes |
|---|---|---|
| ECI | Earth center | X toward vernal equinox, Z toward north pole (inertial) |
| ECEF | Earth center | X toward prime meridian/equator, Z toward north pole (rotates with Earth) |
| LLA | Surface below entity | East, North, Up (ENU orientation) |
| ENU | Entity position | East, North, Up |
| NED | Entity position | North, East, Down |
| Body | Entity position | Euler 3-2-1 (yaw → pitch → roll) from parent frame |

Axis colors: **red = X**, **green = Y**, **blue = Z**

## Stack

- [React](https://react.dev) + [TypeScript](https://www.typescriptlang.org)
- [React Three Fiber](https://docs.pmnd.rs/react-three-fiber) / [Three.js](https://threejs.org)
- [Leva](https://github.com/pmndrs/leva) — control panel
- [Vite](https://vitejs.dev) — build tool
