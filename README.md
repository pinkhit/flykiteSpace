# 🪁 flykite.space 🪁

A kite flying browser experience. 

## Highlights

- Physics based kite motion responds to player input, wind, lift, and gusts.
- Custom sky and water shaders provide moving clouds, planar reflections, ripples, wakes, and foam.
- Kite interacts with world objects, supported by particle emission VFXs.
- Lighting presets and live controls to move between natural or stylized color palettes.
- Supports pointer and touch controls, device orientation, and optional rear-camera passthrough.
- Includes a 32×32 pixel kite editor and a moderated, shared Supabase gallery.

## Graphics and gameplay

### Kite

- The kite tracks the camera while wind and player inputs control its position, roll, and pitch.
- Motion uses frame-rate-independent smoothing for consistent behavior across devices.
- The string is generated at runtime with sag, sideways movement, and vibration.
- Kite contact drives the water wake, ripples, pixel foam, bubbles, and cross-shaped voxel splash particles.

### Environment and VFX

- Procedural cloud textures are generated on the CPU and animated in a custom sky shader.
- The water uses a fixed planar reflection target and computes most surface detail in the fragment shader.
- Interactive animated low-poly birds orbit in 360° flight bands, with speed driven by wind strength.
- Particle system based VFX uses instancing and fixed-size pools to avoid continuous allocation during gameplay.

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

## Asset credits

- [Low Poly Bird (Animated)](https://sketchfab.com/3d-models/low-poly-bird-animated-82ada91f0ac64ab595fbc3dc994a3590) by Charlie Tinley ([@Tnkii](https://sketchfab.com/Tnkii)), licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).

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

## Shared kite library

The editor works locally without a backend. To enable global uploads and the
community gallery:

1. Create a Supabase project.
2. Open its SQL editor and run
   `supabase/migrations/20260826000000_create_kite_library.sql`, followed by
   `supabase/migrations/20260826010000_add_kite_artist_name.sql`, then
   `supabase/migrations/20260826020000_add_kite_country.sql`.
3. In **Authentication → Sign In / Providers**, enable anonymous sign-ins.
4. Copy `.env.example` to `.env.local`, then add the project URL and publishable
   key. Never put a secret or legacy service-role key in a `VITE_` variable.
5. Add the same two environment variables to the Vercel project and redeploy.

New uploads are visible to their creator immediately and enter the library as
`pending`. Approve artwork from the Supabase SQL editor after reviewing it:

```sql
update public.kites
set moderation_status = 'approved'
where id = 'the-kite-id';
```

Rejecting a submission hides it from the public library while preserving a
moderation record:

```sql
update public.kites
set moderation_status = 'rejected'
where id = 'the-kite-id';
```

## Controls

- Drag across the scene to look around and steer the kite.
- On desktop, press W to lengthen the string and S to shorten it.
- Use the Birds toggle to hide the flock and pause its simulation.
- Use the HUD to tune the renderer and wind response at runtime.
- Enable Camera mode for rear-camera passthrough; enable Motion to use device orientation when supported.
