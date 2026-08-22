# Not Minecraft Kite

An experimental browser-based kite experience built around responsive flight, a stylized procedural sky, and an interactive water surface. The project combines a real-time 3D scene with desktop pointer controls, mobile device orientation, and an optional camera-passthrough mode for a lightweight mixed-reality presentation.

## Experience highlights

- Responsive kite motion driven by player look input, line length, and layered wind simulation
- Custom GLSL sky rendering with animated flow-map clouds and configurable atmosphere
- Reflective water with procedural pulses, contact ripples, wakes, foam, and submersion effects
- Desktop pointer controls plus permission-aware device orientation on supported mobile browsers
- Optional rear-camera passthrough using the browser MediaDevices API
- Live developer HUD for tuning wind, water, lighting, cloud, and visual-effect parameters
- Alternate disco palette for real-time color animation across the scene

## Tech stack

| Layer | Technology | Role in the project |
| --- | --- | --- |
| Application | React 19 + TypeScript | Component architecture, UI state, browser integrations, and strongly typed game systems |
| 3D framework | React Three Fiber | Declarative Three.js scene graph and frame-loop integration for React |
| Rendering | Three.js + WebGL | Cameras, lighting, geometry, materials, reflections, instancing, and real-time scene rendering |
| Scene utilities | Drei | Lightweight helpers for texture loading and Three.js workflows |
| Shaders and VFX | GLSL + custom Three.js materials | Procedural clouds, water deformation, reflection treatment, ripples, wakes, foam, and color effects |
| Device features | MediaDevices + Device Orientation APIs | Rear-camera passthrough and motion-controlled viewing on compatible devices |
| Build pipeline | Vite 8 | Fast local development, hot module replacement, and optimized production builds |
| Quality tooling | ESLint + TypeScript project builds | Static analysis and compile-time validation |

## Project structure

```text
src/
├── components/   # HUD, crosshair, overlays, and camera passthrough
├── game/         # Scene, camera rig, kite systems, environment, shaders, and VFX
├── hooks/        # Browser input and device-orientation integration
├── App.tsx       # Runtime state and feature composition
└── main.tsx      # Application entry point
```

## Running locally

Install dependencies and launch the development server:

```bash
npm install
npm run dev
```

Create and preview a production build:

```bash
npm run build
npm run preview
```

Run the linter with:

```bash
npm run lint
```

Camera access and device orientation require browser permission and a secure context. Use HTTPS when testing those features on a physical device.

## Controls

- Drag across the scene to look around and influence the kite.
- Use the HUD to tune the environment, flight line, water response, and rendering palette at runtime.
- Enable camera mode to place the kite over a live rear-camera feed.
- On supported mobile devices, grant motion access to control the view with physical device movement.
