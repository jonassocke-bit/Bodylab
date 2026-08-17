# BODY LAB v3.29.1

> **Aktueller Build: v3.21.3** — diese Datei, `VERSION`, die App-Anzeige und der Seitentitel werden gemeinsam ausgeliefert.

BODY LAB V3.20.1

Fix: Step 5 now performs the full real mesh reconstruction/measurement path for every untouched final-test person. It checkpoints after every person and invalidates the old instantaneous regression-only V3.20 result.

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


## V3.12 — Persistent Batch + tuned solver
- Last dataset and last successfully completed Batch are stored in IndexedDB and restored automatically after reload.
- Stable Batch ID `BL-<hash>-<rows>` makes comparisons reproducible.
- Saved Batch JSON export/import and explicit delete controls.
- V3.12 preserves baseline waist depth instead of chasing its low-confidence predicted target.
- Morphs with strong waist-depth spill are penalized; fewer morphs, stronger regularization and smaller correction steps are used.


## V3.13.1 — Final Validation + adaptive progress/ETA
Batch Lab now shows percentage, completed/total model runs, a progress bar and a live ETA. The ETA
uses the median time of the most recent completed model runs, so it adapts automatically to both
person count and scenario/parameter count.

Final Validation uses the frozen V3.11 solver and only the deterministic 20% holdout rows that were
excluded from its hidden-geometry training split. It performs no tuning. The final report includes
mean MAE, P90, female/male results and per-harness-measure comparisons.


## V3.13.1 — Frozen V3.11 deterministic rebuild

Fixes Final Validation when the legacy V3.11 localStorage model is missing.

If no frozen V3.11 model is found, Final Validation now rebuilds it automatically from the
currently restored ANSUR dataset using the exact original V3.11 training function. The original
deterministic `sourceRow` 80/20 split, feature vector and ridge settings are reused, so the same
dataset reproduces the same frozen candidate rather than performing new tuning.

The rebuilt model is then stored under a dedicated V3.13 frozen-model key for future reloads.
Final Validation still evaluates only the deterministic 20% holdout.


## V3.14
Final V3.11 + constrained post-hoc waist-depth repair. Final Validation compares Baseline → V3.11 → V3.14 on the same 20% holdout. No further solver iteration is planned after this run.


## V3.15.1 — Coupled Cross-Section Solver

Rather than repairing waist depth in isolation, V3.15.1 treats anatomical cross-sections as coupled geometry.

Training targets:
- Chest: circumference + chest breadth + chest depth.
- Waist: circumference + waist breadth + waist depth.
- Hip/buttock: circumference + hip breadth. No hip-depth target is invented because the current ANSUR mapping does not provide one.
- Neck circumference and neck-base circumference remain separate anatomical levels and are not combined artificially.

The solver starts from the exact frozen V3.11 result, re-locks the directly known chest/waist/hip circumferences after every trial, and then uses remaining morph freedom to distribute each perimeter into breadth/depth according to the learned ANSUR shape targets. Low-confidence mappings remain down-weighted using the existing calibration-R² trust function. Shoulder, torso length and neck-base gains from V3.11 are protected by hard drift guards.

Final Validation remains the same frozen holdout and compares Baseline → V3.11 → V3.15.1.


## V3.15.1 Hotfix
Fixes a boot-time variable-name mismatch in `main.js`: the FinalValidationV315 instance was created as `finalValidationV314` but exported as `finalValidationV315`, causing a ReferenceError during boot. Solver logic is unchanged.


## V3.16 — Resumable maximum-quality validation
No solver-quality shortcuts were introduced. V3.15 redundantly calculated Baseline→V3.11 twice per person:
once for the reported V3.11 result and again inside the V3.15 candidate before cross-section optimization.
V3.16 reuses the already computed exact V3.11 state and runs only the additional coupled cross-section stage.
Candidate count, step schedule, real mesh evaluation, circumference re-locks, trust weights and safety guards are unchanged.

Final Validation saves a checkpoint after every completed person in IndexedDB and can resume from the next
person after iOS suspension, app switching or reload.


## V3.20 — Final Calibration Workflow

Calibration UI is intentionally reduced to five steps:

1. Freeze deterministic data split.
   - ~70% Training
   - ~15% Validation
   - ~15% Final Test
   - first 50 Final rows are conservatively excluded because the user already inspected 50 former holdout persons.

2. Train hidden-geometry predictors only on Training.
   Core-5 inputs: gender, height, weight/BMI, chest, waist, hip and simple ratios.
   Hidden targets: shoulder, shoulder-to-crotch, chest breadth/depth, waist breadth/depth, hip breadth, neck base.

3. Validation / one-time residual calibration.
   Validation may still influence the model. Only a conservative additive offset (80% of validation bias)
   is learned per target; no iterative solver tweaking is exposed.

4. Freeze.
   Model + validation offsets are copied into a frozen final model. Training/validation controls lock.

5. Final Test.
   Uses only the final split minus the 50 conservatively excluded already-seen rows.
   No model updates occur. Reports MAE/P90 overall, women/men, and per target.

Legacy V3.7/V3.11/V3.12/V3.15 calibration experiments and sensitivity-lab UI are removed from the visible Calibration menu.


## V3.21 — Guided Mesh Fit
Five-step guided mesh-fit workflow after final calibration. Statistical solver remains frozen.


## v3.21.2 — Version consistency + Morph-ID diagnosis fix

- `version.js` is the single source of truth for the current build.
- The same version is shown in the top-left app badge, browser/page title, Calibration/Mesh-Fit menu and GitHub README.
- `VERSION` contains the machine-readable current version.
- The previous diagnostic incorrectly searched semantic words inside compact modifier IDs such as `d24`.
  V3.21.2 discovers torso morphs through `modifier-config.js` metadata (`group` / `target`) and then applies the corresponding compact ID to `directState`.
- The diagnosis therefore must now find actual controls such as `torso-scale-depth`, `hip-scale-depth`, `stomach-navel`, etc., rather than returning an empty morph list.


### Version-Anzeige-Check für v3.21.2
Nach dem Upload auf GitHub müssen dieselben Werte sichtbar sein:
- App oben links: `BODY LAB · v3.21.2`
- Browser-/Seitentitel: `Harness Body Lab v3.21.2`
- Calib-Menü: `V3.21.2`
- Mesh-Fit/Diagnose: `V3.21.2`
- GitHub README: `BODY LAB v3.21.2`
- Datei `VERSION`: `3.21.2`
- ZIP/Release-Dateiname: `BODYLAB_V3.21.2_...`


## v3.21.3 – Boot-Fix
- Versionsquelle ohne zusätzliche JavaScript-Datei direkt in `index.html`.
- Morph-Metadaten-Fix aus v3.21.2 bleibt enthalten.
- Alle JavaScript-Dateien wurden vor Ausgabe syntaktisch geprüft.


## v3.21.4 — Exact Boot Diagnostic
- All JS/module URLs are cache-busted with `?v=3.21.4` to prevent Safari/GitHub Pages from mixing old modules with the new build.
- Boot errors now show exact filename, line and column where available.
- A pre-boot module probe explicitly loads the dynamic assets (`body-morphs.js`, `face-morphs.js`, config, macro meta, rig data) before the app starts.
- If one of those assets is stale or syntactically invalid, the red error card names that asset directly.


## v3.21.6 — calibration.js syntax hotfix

Exact fix for the reported browser error:
`calibration.js` line 15, `SyntaxError: Unexpected token '{'`.

Cause: the `CalibrationLab` constructor was not closed before the `stampVersion()` class method.
A single missing `}` has been restored. The diagnostic error reporting and the metadata-based morph lookup remain intact.


## v3.21.7
5-Personen-Diagnose für Zielfunktion und Morph-Auswahl. Kein großer Batch.


## v3.21.8 — Safari parser hotfix
Exact browser-reported fix for `calibration.js` line 24:
one redundant closing brace at EOF was removed.
No Objective/Morph diagnosis logic was changed.


## v3.21.9 — 100-Personen Ziel-Audit
Vergleicht für 100 Validation-Personen ANSUR-Rohmaß, eingefrorenes Solver-Ziel und tatsächliches Baseline-Mesh. Kein Training, kein Morph-Tuning.


## v3.23.1 — Modifier Limit & Gender Diagnosis

New 100-person diagnostic, with no training and no permanent model changes.

It compares female and male chest-depth errors and tests:
- baseline chest depth,
- `torso-scale-depth` at 100%,
- diagnostic extrapolation to 120%,
- whether going beyond 100% continues to reduce target error,
- sensitivity of chest depth to separate breast/front-chest morphs.

The result classifies the likely cause as:
1. modifier limit,
2. sex/breast geometry or measurement-definition issue,
3. both,
4. neither as a single dominant cause.

`calibration.js` logic is unchanged from v3.21.9; only module cache/version strings are updated.

## v3.23.1 — Gender-aware Chest Depth Mesh Fit
- ANSUR Chest Depth is treated as total AP depth at the chest point; for women this includes bust projection.
- Female cross-section fitting prioritizes breast geometry before generic torso depth.
- Male fitting prioritizes torso depth.
- `torso-scale-depth` is capped at 100% in the production fitter; no artificial >100% torso-depth workaround.
- New Step 6 runs a real 100-person validation mesh fit and reports before/after MAE by sex and measure.


## v3.23.1 — Result aggregation fix
Step 6 now aggregates all eight mesh measurements directly against their ANSUR/import aliases. This fixes missing chestBreadth/chestDepth output. Mesh fitter and calibration logic are unchanged from v3.23.0.


## v3.24.0 — Female Thorax + Breast Projection

Production-candidate mesh-fit strategy:
- male training split only is used to fit a ridge model for thorax/base chest depth from inputs available in production (height, weight, chest, waist, hip, age);
- female ANSUR Chest Depth remains the total Bustpoint depth;
- for women, breast projection is temporarily neutralized, torso depth is fitted to the male-derived thorax target, and the remaining total depth is restored using Breast Size plus breast-local modifiers only;
- for men, torso-scale-depth is fitted directly to total Chest Depth;
- the old global cross-section optimizer is intentionally not used in this V3.24 path, avoiding the hip-width damage seen in V3.23;
- 100-person validation reports overall MAE, female/male chest-depth MAE, all 8 measures, and protected-measure regressions.

If V3.24 passes, the only remaining calibration step is a frozen final holdout, then production freeze.


## v3.25.0 — Local Breast Projection Fitter

This build keeps torso-scale-depth clamped to ±100%.
For women:
1. estimate thorax/base chest depth from the male training split,
2. fit torso depth only to that thorax target,
3. freeze torso depth,
4. create the remaining Bustpoint projection only with Breast Size, Breast Firmness and local breast controls:
   `breast-trans`, `breast-dist`, `breast-point`, `breast-volume-vert`,
5. strongly penalize regressions in chest breadth, waist breadth/depth, hip breadth, shoulder, torso and neck base.

Men keep the direct torso-depth path that already performed well in V3.24.

If the 100-person validation passes, the only remaining calibration operation is an untouched final holdout followed by production freeze.


## v3.26.0 — Two-Stage Female Chest Fit

Stage 1:
- torso depth and breast-local controls restricted to the normal ±100% range.

Stage 2:
- activates only if female Chest Depth still misses the solver target by more than 1.25 cm;
- permits controlled overdrive on torso-scale-depth up to ±160%;
- permits Breast Size up to 160% and local breast controls up to ±180%;
- includes a mild overdrive penalty and the same collateral-geometry protection;
- Stage 2 is retained only if it materially improves chest-depth error without a meaningful protected-geometry penalty.

Men continue to use the stable direct torso-depth path.

If this 100-person validation passes, proceed directly to the untouched final holdout and freeze.


## v3.27.0 — Hierarchical Female Chest Fit
A: stable baseline.
B: female Chest Depth gets priority; adaptive overdrive up to 200% is allowed only while measured error continues to improve.
C: collateral geometry is repaired while the achieved Chest Depth is guarded.
Men retain the already-good direct torso-depth path.
If validation passes, proceed directly to untouched final holdout and freeze.


## v3.29.1 — Resumable Live Multi-Stage Repair
- checkpoint persisted after every completed validation person
- start/resume, pause-after-current-person, discard checkpoint
- calibration menu can be hidden while the optimizer continues; live HUD remains visible
- optional 80 ms live visualization delay per morph step
- V3.27 female chest-depth solution preserved; collateral hip/waist/torso repair uses adaptive overdrive up to 200% only while real mesh score improves
