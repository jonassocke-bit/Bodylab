# Harness Body Lab v3.7.0 — clean rewrite

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
The original MakeHuman default rig data is loaded and counted, but v3.7.0 deliberately does not
apply the previously unreliable manual arm poses. Proper BVH / Mixamo retargeting will be added
as a separately testable module after this clean baseline is validated.

## v3.7.0 hotfix
Fixed the strict-mode runtime error in the Face-group builder. Advanced group/control creation is now defensive so one malformed control cannot abort the whole boot.


## v3.7.0 — Measurement Lab

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


## v3.7.0 — Landmark Calibration

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


## v3.7.0 — Batch Lab

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


## v3.7.0 — CSV blank-value hotfix

Important correctness fix:
empty numeric CSV cells are now imported as `null` / unavailable rather than JavaScript numeric zero.

V3.2.0 therefore incorrectly treated an empty `underbust` cell as a real 0 cm reference
measurement. This could add roughly 80–100 cm of error per person and made the first batch
ranking meaningless. Re-run the same CSV after installing V3.2.1.


## v3.7.0 — ANSUR II direct loader

The Batch Lab can now load the public ANSUR II individual records directly:
- 1,986 female subjects
- 4,082 male subjects
- 6,068 combined records for reconstruction benchmarking

Mapping to Body Lab:
- `stature / 10` -> height cm
- `weightkg / 10` -> kg (ANSUR stores hectograms despite the variable name)
- `chestcircumference / 10` -> chest cm
- `waistcircumference / 10` -> waist cm
- `(acromialheight - crotchheight) / 10` -> vertical shoulder-to-crotch cm
- `biacromialbreadth / 10` -> shoulder breadth cm
- `buttockcircumference / 10` -> hip/seat circumference analogue
- underbust is unavailable in ANSUR II

Important: ANSUR definitions and MakeHuman ruler definitions are not guaranteed to be anatomically identical.
Systematic errors may therefore reflect measurement-definition mismatch as well as model-shape error.

## v3.7.0 — Questionnaire Optimizer
After a 32-combination batch, derives the smallest questionnaire meeting a selectable MAE target, the Pareto-best subset at each questionnaire length, and average/median marginal value of every optional measurement.

## v3.7.0 — Blind Validation
Five additional ANSUR-II measurements are never solver inputs: neck, wrist, thigh, calf and ankle circumference.
Every questionnaire now reports Blind-MAE/RMSE/P90 and per-measure blind errors. The optimizer defaults to Blind-MAE.

## v3.7.0 — Harness Blind Validation
Adds harness-focused blind metrics: chest breadth/depth, waist breadth/depth, hip breadth, waist back length and neck-base circumference. None are solver inputs. The optimizer defaults to Harness Blind-MAE while Whole-Body Blind-MAE remains available.


## v3.7.0 — Mixed Gender Batch Fix + Diagnostics

Fixes an important sampling bug in mixed ANSUR batches:

The previous direct loader appended all female ANSUR rows first and all male rows second.
`Max. Personen = 250` then used `rows.slice(0,250)`, so a supposedly mixed 250-person run
actually contained only women.

V3.5.1 interleaves female and male records before any row limit is applied.

The Batch Lab now also displays:
- full loaded female/male counts,
- effective female/male counts after the selected row limit,
- current source sex while a batch is running,
- the MakeHuman gender value actually applied.

Exports now include:
- `genderComposition`,
- `sourceGender`,
- `sourceSex`,
- `appliedMakeHumanGender`.

For an ANSUR "all" batch with Max. Personen 250, the effective sample should now show
approximately 125 female and 125 male records.


## v3.7.0 — Global Calibration Lab

V3.6 begins the active calibration phase.

### Measurement calibration
Uses the last Batch Lab raw report, de-duplicates subjects across questionnaire scenarios, and
fits `ANSUR reference = scale * MakeHuman mesh + offset` on a deterministic 70% subject split.
The remaining 30% are untouched validation subjects. The UI reports raw vs calibrated MAE,
bias, P90 and training R² for every available defensible ANSUR↔MakeHuman analogue.

The current calibration set includes the five questionnaire dimensions, Whole-Body Blind
dimensions, Harness-Blind dimensions and additional arm/leg length/circumference analogues.

### Morph Sensitivity Matrix
Every non-face MakeHuman body control is perturbed on both female and male standard bases.
V3.6 records how strongly each control changes every calibration dimension and exports the full
control × measurement response matrix. This is the basis for selecting a compact, stable set of
morphs for the later calibrated solver instead of optimizing all controls blindly.

Calibration profiles can be stored locally as active candidates, but V3.6 intentionally does not
silently alter production solver behavior yet. Calibration must first demonstrate improvement on
the held-out validation split.


## v3.7.0 — Calibrated Core-5 Solver Candidate

Built from the user's actual V3.6 Measurement Calibration and Morph Sensitivity exports.

V3.7 adds:
- embedded V3.6 ANSUR↔MakeHuman measurement calibration coefficients,
- an 80/20-held-out statistical model predicting harness-relevant hidden torso geometry from
  gender + height + weight + BMI + chest + waist + hip and ratio features,
- a deliberately small safe morph set selected from the V3.6 sensitivity matrix,
- coordinate-descent form correction with explicit chest/waist/hip re-locking after each pass,
- a 50-person baseline-vs-calibrated A/B validator.

Low-R² protocol mappings are down-weighted or excluded from geometry correction. In particular,
a large apparent MAE improvement is not treated as evidence of geometric validity when the V3.6
training R² shows that the MakeHuman measurement carries almost no individual information.

The production Generator is not silently switched to V3.7 yet. The candidate must first beat the
baseline in the built-in A/B test.


## V3.8 Mess-Revision
Neuer visueller Messprotokoll-Review: 7 priorisierte Maße, direkte Mesh-Markierung, verständliche Beschreibung, Offset-Revision, Status und JSON-Export. Bestehende Parameter-Revision bleibt erhalten.


## V3.8.1
Mess-Revision is now a true bottom sheet (~43–44% viewport height). The 3D mannequin remains visible above it; measurement selection is a compact horizontal strip and only the review sheet scrolls.


## V3.9 Full Measurement Protocol Review
Expanded revision catalog to every measurement currently used by calibration/solver plus relevant existing MakeHuman ruler paths. Each entry explicitly separates reference meaning, ANSUR/protocol note, current Body Lab implementation, confidence/mapping status, and user revision. Derived and non-equivalent mappings are labeled rather than silently treated as exact.


## V3.11.0 — User-validated Measurement Protocol

The complete V3.9 user review is bundled as `measurement-review-v39.json`.

Actual measurement logic now follows the approved corrections:
- Bust circumference: horizontal mesh cross-section, +4 cm relative to previous MakeHuman ruler level.
- Hip/buttock circumference: horizontal mesh cross-section at approved level.
- Neck circumference: separate horizontal slice +1.5 cm.
- Neck-base circumference: separate horizontal slice -0.5 cm.
- Thigh circumference: +7 cm and orthogonal to local upper-leg axis.
- Calf circumference: orthogonal to local lower-leg axis.
- Ankle circumference: -3 cm and orthogonal to local lower-leg axis.
- Upper-arm circumference: orthogonal to local upper-arm axis; remains explicitly non-equivalent to flexed ANSUR biceps circumference.
- Chest depth: centerline front-to-back depth, rather than arbitrary maximum-Z endpoints.

Confirmed measurements remain unchanged.

Crucially, Generator, Batch Lab, Blind Validation, Sensitivity and Measurement Calibration now call the
same revised engine measurement functions. The old V3.7 calibrated-shape correction is deliberately
disabled because its embedded V3.6 calibration coefficients were learned against the previous
measurement protocol. Re-run V3.11 calibration before training the next solver candidate.


## V3.11 — Sensitivity-driven calibrated solver candidate

Uses the user's V3.10 measurement-calibration export and V3.10 142-control sensitivity export.
Hidden harness targets are learned from Core-5 with an 80/20 subject split. Morph corrections are
computed through weighted ridge least squares on the measured sensitivity Jacobian rather than
hand-picked coordinate descent.

Measurement mappings with R² < 0.10 are excluded from geometry correction. Low-R² mappings are
down-weighted. This intentionally prevents apparently impressive mean-offset corrections (for
example the old waist-back-length mapping) from steering individual body shape.

Only interpretable regional groups (`measure`, `torso`, `hip`, `breast`, `stomach`, `buttocks`,
`pelvis`) are eligible; highly entangled ELVS bodyshape/endocrine controls are excluded.

Production generation remains unchanged until the built-in A/B validator shows a real improvement.
