# Harness Body Lab v3.2.0 — clean rewrite

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
The original MakeHuman default rig data is loaded and counted, but v3.2.0 deliberately does not
apply the previously unreliable manual arm poses. Proper BVH / Mixamo retargeting will be added
as a separately testable module after this clean baseline is validated.

## v3.2.0 hotfix
Fixed the strict-mode runtime error in the Face-group builder. Advanced group/control creation is now defensive so one malformed control cannot abort the whole boot.


## v3.2.0 — Measurement Lab

Adds the first user-facing body generator.

Required test inputs:
- body basis
- age
- height
- weight
- bust circumference
- waist circumference
- shoulder-to-crotch

Optional validation inputs:
- hip circumference
- underbust circumference
- shoulder breadth

Optional values can be entered while "zum Generieren" remains disabled. They are then
reported as true hold-out/control measurements and do not influence the solver.

The V3.1 torso length is explicitly a calibration proxy:
`measure-napetowaist-dist + measure-waisttohip-dist`.
This is intentional so that real shoulder-to-crotch measurements can be collected and
used to calibrate the mapping instead of pretending the two definitions are already identical.

The solver uses the original MakeHuman measurement morphs and allows internal direct-morph
extrapolation to ±180% while the core height/weight macros remain inside their native 0–100% range.


## v3.2.0 — Landmark Calibration

Replaces the two V3.1 measurement proxies that produced the large first-test errors.

Fixed MakeHuman topology landmarks:
- left shoulder: vertex 1602
- right shoulder: vertex 8274
- crotch / inseam center: vertex 4376

Definitions:
- Shoulder breadth = direct 3D distance L shoulder ↔ R shoulder.
- Shoulder-to-crotch = vertical Y difference between the average shoulder height and crotch.

These vertices were selected from the MakeHuman base topology. The shoulder vertices are the
mirrored outer endpoints of MakeHuman's existing shoulder measurement; the crotch vertex is the
center seam at the inseam. Because MakeHuman morphs preserve topology, the IDs remain valid while
the body changes.

The Measurement Lab can display the three landmarks directly on the live mesh.

The generator also adds a coupled stabilization loop so torso-length changes no longer leave
height/weight at the values produced by a later morph.


## v3.2.0 — Batch Lab

Adds CSV/JSON dataset import and automated questionnaire comparison.

Standard columns:
`gender, age, height, weight, chest, waist, shoulder_to_crotch, hip, shoulder_breadth, underbust`

The importer recognizes common aliases and converts obvious millimeter body dimensions to centimeters.
Missing optional columns are allowed.

Default ladder:
1. Height + Weight
2. + Chest
3. + Waist
4. CORE 5 = Height + Weight + Chest + Waist + Shoulder-to-Crotch
5. CORE 5 + Shoulder
6. CORE 5 + Hip

The report contains two complementary metrics:
- `fullMAE`: all available reference measurements, including dimensions explicitly supplied to the solver. This represents final reconstruction accuracy and is used for the ranking.
- `holdoutMAE`: only measurements NOT supplied to that questionnaire variant. This measures how well omitted dimensions are predicted.

Keeping both avoids the methodological trap of making a larger questionnaire look artificially better merely because difficult dimensions disappear from the holdout set.

For iPhone performance, start with 10–25 rows. The batch runner disables normal recalculation during
optimization, uses fewer stabilization passes than the interactive generator, and restores the user's
previous visible body after the batch completes.
