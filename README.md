# Harness Body Lab v3.0.1 — clean rewrite

Fresh repository build. This is not a patch on the v2.x application.

## Architecture
- `main.js`: deterministic boot sequence only
- `engine.js`: Three.js mesh, MakeHuman macro stack, morph engine, measurements
- `ui.js`: mobile bottom-sheet and all controls
- `revision.js`: calibration and UI relevance, isolated from rendering
- `debug.js`: guided test mode, isolated from rendering
- large MakeHuman assets remain unfragmented

The app intentionally renders `base.obj` **before** loading the six ~9 MB macro binaries.
If Advanced, Revision or Debug fails, it should not be able to stop the render loop.

## MakeHuman-derived values
- age: MakeHuman's 1 / 25 / 90 year piecewise mapping
- height: current mesh bounding-box height in cm
- weight: MakeHuman-style Mosteller estimate from current surface area and height
- BSA and mesh volume
- 20 original MakeHuman measurement rulers, including bust, underbust, waist, hips,
  upper arm, wrist, thigh, calf, knee, ankle and several lengths/distances.

## Revision
Every slider has a hidden revision row. Revision mode exposes it in place.
Each parameter can be classified as Main / Fine / Advanced, renamed, annotated, assigned a unit,
and supplied with calibration/reference marks.

## Rig / poses
The original MakeHuman default rig data is loaded and counted, but v3.0.1 deliberately does not
apply the previously unreliable manual arm poses. Proper BVH / Mixamo retargeting will be added
as a separately testable module after this clean baseline is validated.

## v3.0.1 hotfix
Fixed the strict-mode runtime error in the Face-group builder. Advanced group/control creation is now defensive so one malformed control cannot abort the whole boot.
