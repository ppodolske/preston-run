# Repository & Deployment Foundation — Baseline Capture

Date: 2026-09-15  
Checkpoint: A — Freeze and capture  
Production behavior changed: **No**

## Production anchor

Railway project: `Preston.run`  
Project ID: `52e3a022-86d8-4191-bf3b-e4250d484055`  
Environment: `production`  
Environment ID: `e7396e86-8acb-4f59-92c7-9a9e4554fecf`  
Hub service: `preston-run-hub`  
Hub service ID: `5d24e3e7-ade6-4ab8-8e44-36863f698078`

Latest successful hub deployment:

```text
deployment ID: 2378452d-99b9-4b85-9e23-7afeb1f5f5c7
status: SUCCESS
commit: bf55df6298b95b7523d2b004dfee4366f61e9080
branch: build/preston-ai-v0.11.0
commit message: docs: add weight-trend and Drive reorg action amendment
```

Observed runtime log:

```text
preston.ai v0.14.0 listening on 8080
```

Recent HTTP evidence on this deployment included successful `200` responses from `/` and `/api/status`.

## Recovery refs

The GitHub connector available during execution does not expose tag creation. Two fixed recovery branch refs were therefore created at the **exact Railway-deployed SHA** and must not be moved during this migration:

```text
production/pre-repository-foundation -> bf55df6298b95b7523d2b004dfee4366f61e9080
repository-foundation/pre-cutover-backup -> bf55df6298b95b7523d2b004dfee4366f61e9080
```

If a true Git tag is added later from a local Git client, it should point to the same SHA; the absence of a tag does not weaken the current rollback anchor because both recovery refs already identify the exact deployed commit.

## Hub source/config before migration

```text
repo: ppodolske/preston-run
branch: build/preston-ai-v0.11.0
checkSuites: false
custom domain: preston.run -> port 8080
builder: RAILPACK
build environment: V3
runtime: V2
region: sfo, 1 replica
startCommand: npm start
preDeployCommand:
  - npm run job:gmail:booking-enrichment -- --dry-run
```

No hub configuration was changed during Checkpoint A.

## preston-run branch state

Execution-time branch heads:

```text
main: 754d447bc5577b3d27cb275276e3e2b7ee6d5bed
build/preston-ai-v0.11.0: bf55df6298b95b7523d2b004dfee4366f61e9080
```

Comparison at capture time:

```text
status: ahead
ahead_by: 630
behind_by: 0
merge base: 754d447bc5577b3d27cb275276e3e2b7ee6d5bed
```

This still satisfies the approved ahead-only fast-forward assumption, subject to re-check immediately before promotion.

## Form / Dose & Scale branch state

Execution-time branch heads:

```text
main: 86ac6af8bca99cdd11ec27e6c53c0f32f7aad44f
build/preston-ai-v0.11.0-integration: a0fcf6b5bd5315e6fe6127c24203fe02fa598145
merge base: 2bad7e56ee1ab141afe52751116eb0590d8be268
```

Comparison of integration vs main:

```text
status: diverged
integration ahead_by: 17
integration behind_by: 4
```

Main-only post-divergence surface observed:

```text
package.json
server.js
test/runtime-injection.test.js
```

Integration line adds the Preston context/service/gateway contract and tests. This divergence must be reconciled deliberately before import.

## Permanent/current production scheduler set

All services below are currently in the Railway `production` environment. The newer scheduled services source `ppodolske/preston-run` / `build/preston-ai-v0.11.0` with `checkSuites: false`.

| Service | ID | Start command | Cron |
|---|---|---|---|
| `preston-gmail-0645` | `876037df-3989-4218-b76f-4169514db5c2` | `timeout --signal=TERM --kill-after=30s 900s npm run job:gmail:scheduled -- morning` | `45 19,20 * * *` |
| `preston-calendars-0655` | `4234f3da-f547-4a68-80db-55fd57e7751f` | `timeout --signal=TERM --kill-after=30s 600s npm run job:calendars:sync` | `55 19,20 * * *` |
| `preston-fitness-0700` | `f9cb1216-70cf-47c6-bcd1-43cce63e0b61` | `timeout --signal=TERM --kill-after=30s 300s npm run job:fitness:sync` | `0 20,21 * * *` |
| `preston-morning-0715` | `8e160a1f-3ff6-47d3-a2b3-6d6e6fa2af3e` | `timeout --signal=TERM --kill-after=30s 300s npm run job:reminders:morning` | `15 20,21 * * *` |
| `preston-gmail-1200` | `3f703886-0be2-4a14-b910-48883c4f77c2` | `timeout --signal=TERM --kill-after=30s 900s npm run job:gmail:scheduled -- noon` | `0 1,2 * * *` |
| `preston-gmail-1800` | `a0b9d99d-850e-4e86-b757-a95d164e292e` | `timeout --signal=TERM --kill-after=30s 900s npm run job:gmail:scheduled -- evening` | `0 7,8 * * *` |
| `preston-gmail-2100` | `c0acb412-4635-4241-9b49-3545f4051afd` | `timeout --signal=TERM --kill-after=30s 900s npm run job:gmail:scheduled -- night` | `0 10,11 * * *` |

The Railway environment also contains older service names such as `preston-reminders-noon`, `preston-reminders-morning`, `preston-reminders-evening`, `preston-calendars-sync`, and `preston-fitness-sync`. These are cleanup candidates only after cutover verification. Example: `preston-reminders-noon` currently runs a disabled placeholder command (`node -e "console.log('legacy noon schedule disabled')"`) rather than an active reminder schedule.

## UAT / smoke state before migration

`preston-run-uat` currently exists as a **service in the production environment**, not a separate Railway environment:

```text
service ID: b3097081-1863-4fe2-9bae-b383c1e16bad
repo: ppodolske/preston-run
branch: uat/ux-remediation
pinned commit: 0c5b5b5fabc8db42f4f52c28f727ff839e8e97f2
service domain: preston-run-uat-production.up.railway.app
```

It has UAT-specific auth variables and does not expose the production Supabase service-role variable in the captured variable-name set.

Two smoke-test services also exist in the production environment: `uat-smoke-tests` and `uat-smoke-test`. They are cleanup candidates after a real `uat` environment is operational.

## v0.14 one-shot service before migration

```text
service: v0140-enrichment-apply-once
service ID: d2b76b9b-764e-47ef-85b4-3207c6d89489
repo: ppodolske/preston-run
branch: ops/v0140-enrichment-apply-once
checkSuites: false
startCommand: node -e "console.log('v0.14.0 enrichment one-shot complete')"
restartPolicy: NEVER
```

This is explicitly **not deleted** in Checkpoint A.

## Freeze statement

No unrelated feature work should be started on the old Preston/Form repository lines until migration is complete. Checkpoint A made no Railway source, command, domain, schedule, variable, or deployment behavior changes. The only GitHub mutations were the approved plan/baseline documentation and two fixed rollback refs at the exact currently deployed production SHA.
