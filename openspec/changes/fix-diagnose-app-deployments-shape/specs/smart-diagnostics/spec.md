> Current contract: use the generated `coolify_*` operations in `src/generated/operations.ts` and explicit wrappers registered with `registerTool` in `src/server.ts`; older action-oriented examples in this artifact are superseded. Executable checks live in Bun tests.

## ADDED Requirements

### Requirement: listApplicationDeployments must tolerate non-array response shapes

The `listApplicationDeployments` client method SHALL accept any of the following Coolify response shapes for `GET /deployments/applications/{uuid}` and normalize them to a `Deployment[]` before returning to callers:

- A bare JSON array of deployment objects.
- An object containing a `data` array (Laravel-style pagination wrapper).
- An object containing a `deployments` array (named-array wrapper).
- Any other shape (object without expected keys, `null`, `undefined`, primitive) — MUST be normalized to an empty array `[]`.

The method SHALL NOT throw a `TypeError` (such as `deployments.slice is not a function`) regardless of the response shape received from Coolify. The public method signature `Promise<Deployment[]>` MUST remain unchanged.

#### Scenario: Coolify returns a bare array

- **WHEN** Coolify responds with `[ { uuid: "d1", status: "success" }, ... ]`
- **THEN** `listApplicationDeployments` returns the array unchanged

#### Scenario: Coolify returns a Laravel pagination wrapper

- **WHEN** Coolify responds with `{ data: [ ... ], total: 10, current_page: 1 }`
- **THEN** `listApplicationDeployments` returns the contents of the `data` field

#### Scenario: Coolify returns a named-array wrapper

- **WHEN** Coolify responds with `{ deployments: [ ... ] }`
- **THEN** `listApplicationDeployments` returns the contents of the `deployments` field

#### Scenario: Coolify returns null, undefined, or unrecognized object

- **WHEN** Coolify responds with `null`, `undefined`, or `{ foo: "bar" }`
- **THEN** `listApplicationDeployments` returns an empty array `[]` and does NOT throw
- **THEN** the method emits a `console.warn` describing the unrecognized shape (top-level type and keys) for diagnostic purposes

### Requirement: diagnoseApplication must complete diagnostics even when deployments shape is unrecognized

The `diagnoseApplication` aggregator SHALL produce a complete `ApplicationDiagnostic` response (with `application`, `health`, `logs`, `environment_variables` populated from their respective API calls) even when the deployments endpoint returns a shape that normalizes to an empty array. A failed deployments fetch MUST NOT cascade into a `TypeError` that aborts the whole diagnosis.

#### Scenario: Unrecognized deployments shape

- **WHEN** `listApplicationDeployments` returns an empty array because the upstream shape was unrecognized
- **THEN** `diagnoseApplication` returns `recent_deployments: []` and continues to compute `health.status` from `application.status` alone
- **THEN** the `errors` array does NOT include an entry blaming `deployments.slice`

#### Scenario: Recognized deployments shape with failed deployments

- **WHEN** the deployments response (in any of the three accepted shapes) contains at least one deployment with `status: "failed"` in the most recent five entries
- **THEN** `health.issues` records the failed-deployment count and `health.status` becomes `"unhealthy"` even if the application container status is healthy
- **THEN** `recent_deployments` contains the last 5 deployments after normalization
