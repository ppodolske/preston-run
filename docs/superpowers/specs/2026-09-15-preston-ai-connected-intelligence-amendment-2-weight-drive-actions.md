# preston.ai Connected Intelligence — Amendment 2

Date: 2026-09-15  
Status: Approved amendment  
Parent design: `docs/superpowers/specs/2026-09-15-preston-ai-connected-intelligence-design.md`  
Affected phases: v0.16 Goals & Today Intelligence; v0.17 Drive Intelligence & Documents; v0.20 Agent

This amendment is authoritative where it adds to or clarifies the parent Connected Intelligence design.

## 1. Morning Digest / Today weight-trend defect

### 1.1 Requirement

The existing Morning Digest weight-trend defect must be fixed as part of the v0.16 Goals & Today Intelligence implementation before the existing recovery/training intelligence is treated as reliable inside the unified Today experience.

This is an upstream data-quality defect in the Dose & Scale / Form → preston.ai daily-context calculation, not a presentation-only defect in preston.ai.

The implementation must fix the upstream shared numeric parser rather than adding a weight-only rendering patch.

### 1.2 Observed failure

The current intelligence can report an impossible result such as:

```text
Weight trend: gained 84.5 kg
Recent average: 84.5 kg
```

An observed production payload had approximately:

```text
recentAvg = 84.4857 kg
change = 84.4857 kg
count = 29
```

That implies the early comparison average was effectively 0 kg.

### 1.3 Root cause

In the Dose & Scale / Form daily-context implementation, the shared numeric conversion helper accepts a value when `Number(value)` is finite.

JavaScript converts missing-looking values in ways that are unsafe for this use case:

```text
Number(null) === 0
Number('') === 0
Number('   ') === 0
```

The weight-trend calculation filters observations using the shared numeric helper. Blank/null weight rows therefore become legitimate-looking `0 kg` observations.

The 28-day trend then calculates its early and recent averages from those polluted observations, allowing a blank early period to become an effective 0 kg baseline.

### 1.4 Required shared numeric-parser behaviour

The shared numeric parser must return `null` for:

- `null`;
- `undefined`;
- empty strings;
- whitespace-only strings;
- non-numeric strings/values that cannot be represented as a finite number.

It must preserve legitimate numeric values, including a real numeric zero where zero is meaningful.

Conceptually:

```text
null        → null
undefined   → null
''          → null
'   '       → null
'abc'       → null
'0'         → 0
0           → 0
'84.5'      → 84.5
84.5        → 84.5
```

The fix must be made at the shared helper used by daily-context metrics so missing values do not silently become zero in other fitness/recovery metrics.

### 1.5 Affected metrics

The implementation review must inspect every consumer of the shared numeric helper, including at least:

- weight;
- HRV;
- resting heart rate;
- stress;
- sleep-derived numeric values;
- workout duration;
- workout distance;
- any other Form/Dose & Scale context field using the same helper.

The goal is not to change legitimate zero semantics. The goal is to distinguish **missing** from **zero**.

### 1.6 Regression tests

v0.16 cannot pass its release gate without regression coverage for at least:

1. weight entries containing `null` weights;
2. weight entries containing `''`;
3. weight entries containing whitespace-only strings;
4. mixed valid and missing weight observations;
5. a 28-day trend where blank/null early entries are ignored rather than averaged as zero;
6. shared numeric-parser tests confirming legitimate numeric zero values remain valid where zero is meaningful;
7. existing recovery/training/context metrics confirming missing values become `null`, not zero;
8. the previously populated-weight case continuing to work correctly;
9. a user-facing preston.ai case confirming an invalid upstream weight trend is not rendered as valid intelligence.

Tests must be added in the owning repository for the shared numeric helper / daily context and, where appropriate, in preston.ai for defensive validation.

### 1.7 Defensive preston.ai sanity check

Even after fixing the upstream calculation, preston.ai must not blindly present physically implausible weight changes as trustworthy intelligence.

The v0.16 phase design must define a defensive validation rule for weight-trend intelligence before display.

The guard must:

- reject/suppress an obviously implausible trend rather than presenting it as fact;
- distinguish `invalid/insufficient_data` from a genuine `0 kg` change;
- preserve provenance so the source payload can be diagnosed;
- surface a data-quality/system-health signal when appropriate;
- avoid substituting a fabricated corrected value.

The exact threshold/validation formula is deferred to the v0.16 phase spec and tests.

### 1.8 Post-deployment repair sequence

The implementation/deployment plan must include the following production repair sequence after the upstream fix is live:

1. regenerate/refresh the Dose & Scale / Form daily context;
2. refresh preston.ai's `fitness_context_cache`;
3. force regeneration of the current day's unified Today / recovery intelligence so the existing bad result is replaced immediately;
4. verify the corrected production payload and rendered result;
5. verify downstream recovery/training metrics did not acquire unintended zero/null regressions.

The release is not considered complete merely because code is deployed; the stale bad cached intelligence must be replaced.

### 1.9 Cross-repository dependency

This defect belongs to the Dose & Scale / Form daily-context producer and is consumed by preston.ai.

The v0.16 plan must therefore model it as a cross-repository dependency rather than hiding the fix in the preston.ai renderer.

If the exact source path differs at implementation time, the owning shared numeric helper must still be fixed at source.

## 2. Drive reorganisation approval and execution

### 2.1 Clarification of approved behaviour

preston.ai may not only recommend Drive reorganisations; it may also **request approval to action a specific recommended reorganisation plan**.

The expected experience is:

```text
Drive analysis
    ↓
Recommended reorganisation plan
    ↓
Preview exact proposed mutations
    ↓
Request user approval
    ↓
Permission check
    ↓
Execute only approved mutations
    ↓
Audit + result + reconciliation
```

The user must be able to approve/reject the whole plan or individual operations where practical.

### 2.2 Permission model

The default Drive connection remains least-privilege:

- `drive.readonly` for whole-Drive discovery/backfill;
- `drive.file` for preston.ai-created or explicitly granted files.

Those scopes are sufficient to analyse the Drive and to mutate app-managed/explicitly granted files, but they are not sufficient for arbitrary broad reorganisation of all existing Drive content.

When an approved plan contains mutations outside current write authority, preston.ai must not pretend it can execute them.

Instead it should show a clear state such as:

```text
Approved — additional Drive permission required
```

### 2.3 Optional write-authority escalation

A user who wants preston.ai to action approved reorganisations across arbitrary existing My Drive files may enable a broader Drive write permission through a separate explicit Google re-authorization step.

The relevant broader scope and Google verification/security implications must be resolved in the v0.17 phase design before implementation.

Granting broad write authority does **not** grant autonomous reorganisation authority.

Even with broad write permission:

- preston.ai executes only operations included in an approved plan;
- approval is tied to a concrete version/hash of that plan;
- material plan changes require re-approval;
- no background "keep my Drive tidy" mutation loop is introduced by default.

### 2.4 Reorganisation plan model

The v0.17 phase should model a Drive reorganisation plan with enough state to support safe approval/execution.

Conceptual states:

- `proposed`;
- `partially_approved`;
- `approved`;
- `permission_required`;
- `executing`;
- `completed`;
- `partially_completed`;
- `failed`;
- `rejected`;
- `superseded`.

Each proposed operation should record, as applicable:

- operation type (`move`, `rename`, `create_folder`, `dedupe_review`, etc.);
- Drive file/folder ID;
- current name/parent;
- proposed name/parent;
- rationale;
- risk level;
- reversibility/rollback information;
- approval state;
- execution result.

### 2.5 Safety requirements

Initial reorganisation execution must remain conservative.

Required rules:

- no automatic deletion of files;
- duplicate detection produces a review decision, not silent deletion;
- moves/renames must use Drive file IDs rather than brittle paths;
- execution must revalidate that the source file/folder still matches the approved plan before mutation;
- stale plans must be stopped and regenerated rather than blindly applied;
- retries must be idempotent where possible;
- partial completion must be visible;
- every executed mutation is audited;
- a rollback/reversal path should be provided for reversible moves/renames where Drive APIs and current state permit it.

### 2.6 Relationship to Review Inbox and Agent

Drive Organisation Review is a v0.17 capability.

Approval requests for a recommended reorganisation may appear in the shared Review Inbox.

Execution should use the same registered-action principles as the v0.20 Agent architecture even if a narrow Drive reorganisation executor is introduced earlier:

- fixed operation registry;
- validated inputs;
- risk classification;
- explicit approval;
- deterministic execution;
- audit trail.

The later Agent may invoke the same executor, but it must not create a parallel Drive-mutation path.

### 2.7 Acceptance scenario

A required v0.17 acceptance scenario is:

1. crawl My Drive;
2. identify a coherent reorganisation opportunity;
3. generate a concrete move/rename plan;
4. present exact affected files/folders and rationale;
5. request user approval;
6. if write permission is insufficient, stop at `permission_required` and request explicit re-authorization rather than failing silently;
7. after appropriate permission and approval, execute only the approved operations;
8. show completed/partial results and audit entries;
9. rerun inventory and confirm the Drive model reconciles to the new structure.

## 3. Release-gate changes

### v0.16 — Goals & Today Intelligence

Add these release gates:

- shared numeric parser correctly distinguishes missing values from zero;
- weight-trend regression suite passes;
- other shared fitness/recovery numeric metrics have missing-value coverage;
- preston.ai defensive sanity handling for implausible weight trends is tested;
- production daily context and preston.ai cache are refreshed after deployment;
- the current day's bad weight intelligence is regenerated and verified corrected.

### v0.17 — Drive Intelligence & Documents

Add these release gates:

- Drive Organisation Review can produce concrete approval-ready reorganisation plans;
- preston.ai can request approval to action a plan;
- permission insufficiency is represented explicitly rather than as execution failure;
- broader Drive write scope, if implemented, is separately authorized and its Google verification/security requirements are satisfied;
- execution is limited to approved plan operations;
- stale-plan validation, partial-failure handling, audit and reconciliation tests pass;
- no file deletion occurs automatically.

## 4. Locked decisions added by this amendment

The following are now approved architectural constraints:

- Morning Digest/Today weight intelligence must fix the upstream shared numeric parser; a renderer-only patch is insufficient;
- missing numeric source values must not silently become zero;
- legitimate zero values remain valid where semantically meaningful;
- v0.16 includes a defensive preston.ai sanity layer for implausible weight intelligence;
- production caches/current-day intelligence are explicitly refreshed after the upstream fix;
- Drive reorganisation recommendations may request user approval for execution;
- approval of a reorganisation is separate from OAuth permission availability;
- preston.ai may request additional write authority explicitly when an approved plan requires it;
- broad Drive write permission, if enabled, still does not allow autonomous broad reorganisation;
- only approved plan operations may execute;
- no automatic Drive file deletion is introduced;
- Drive reorganisation execution uses registered, deterministic, auditable actions rather than arbitrary AI tool access.
