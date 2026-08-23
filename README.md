# 🪁 flykite.space 🪁

A kite flying browser experience. 

## Highlights

- Physics-inspired kite motion responds to player input, wind, lift, and gusts.
- Custom sky and water shaders provide moving clouds, planar reflections, ripples, wakes, and foam.
- Water contact switches to underwater kite and string effects, then emits bubbles and low-gravity voxel splashes.
- Lighting presets and live controls make it easy to move between natural and highly stylized color palettes.
- Supports pointer and touch controls, device orientation, and optional rear-camera passthrough.

## Graphics and gameplay

### Kite

- The kite follows the camera while wind and player movement control its position, roll, and pitch.
- Motion uses frame-rate-independent smoothing for consistent behavior across devices.
- The string is generated at runtime with sag, sideways movement, and vibration.

### Environment and VFX

- Procedural cloud textures are generated on the CPU and animated in a custom sky shader.
- The water uses a fixed planar reflection target and computes most surface detail in the fragment shader.
- Kite contact drives the water wake, ripples, pixel foam, bubbles, and voxel splash particles.
- Particle systems use instancing and fixed-size pools to avoid continuous allocation during gameplay.

## Mobile performance

- Rendering resolution is capped at 1.5 device pixel ratio.
- Reflections use a fixed 256×256 render target.
- Only active particle instances are uploaded and drawn.
- Particle emission and simulation time are capped to prevent large bursts after a slow frame or background-tab resume.
- The cloud and water effects avoid volumetric rendering and ray marching.

## Stack

| Layer | Implementation |
| --- | --- |
| Application | React 19 and TypeScript |
| Scene and frame loop | React Three Fiber |
| Rendering | Three.js, WebGL, custom GLSL, render targets, and instancing |
| Scene helpers | Drei texture loading and wide-line rendering |
| Browser input | Pointer Events, MediaDevices, and Device Orientation APIs |
| Build and validation | Vite 8, TypeScript project builds, and ESLint |

## Project structure

```text
src/
├── components/   # HUD, crosshair, camera feed, and device overlays
├── game/         # Camera, kite motion, environment shaders, lighting, and VFX
├── hooks/        # Device-orientation permission and sensor state
├── App.tsx       # Runtime state and feature composition
└── main.tsx      # Application entry point
```

## Running locally

```bash
npm install
npm run dev
```

Production and validation commands:

```bash
npm run build
npm run lint
npm run preview
```

Camera access and device orientation require browser permission and a secure context. Use HTTPS when testing those features on a physical device.

## Controls

- Drag across the scene to look around and steer the kite.
- Use the HUD to tune the renderer and wind response at runtime.
- Enable Camera mode for rear-camera passthrough; enable Motion to use device orientation when supported.
