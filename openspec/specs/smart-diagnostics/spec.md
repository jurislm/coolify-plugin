---
title: Smart Diagnostics Specification
version: 2.2.0
date: 2026-09-23
---

> Current contract: use the generated `coolify_*` operations in `src/generated/operations.ts` and explicit wrappers registered with `registerTool` in `src/server.ts`; older action-oriented examples in this artifact are superseded. Executable checks live in Bun tests.


## Purpose

Define the explicit wrapper behavior in `src/capabilities.ts` for application/server diagnostics and infrastructure issue scans.

## Requirements

### Requirement: Application diagnosis preserves partial results

`coolify_diagnose_application` SHALL resolve a UUID, name, or FQDN through the generated application list operation, then use `Promise.allSettled` for application details, logs, environment variables, and application deployments. Each rejected call SHALL add a named error while successful calls remain in the response.

It SHALL request logs only when the resolved application status identifies a running container. For stopped containers, logs SHALL be `null` without an expected logs-endpoint error.

#### Scenario: Partial application diagnosis

- **WHEN** details fail but logs, envs, or deployments succeed
- **THEN** the response includes the successful values and `errors` contains the details failure

#### Scenario: Safe application details

- **WHEN** environment variables are returned
- **THEN** only `key` and a boolean build-time indicator are returned; variable values are absent
- **WHEN** logs are returned
- **THEN** they are bounded to the last 200 lines and 50,000 characters with a truncation marker when needed

### Requirement: Server diagnosis uses reachability and resource health

`coolify_diagnose_server` SHALL resolve through the generated server-list operation and use `Promise.allSettled` for details, resources, and domains. It SHALL remain read-only and SHALL NOT invoke the server validation POST operation. `is_reachable: false`, `is_usable: false`, and unhealthy resource statuses SHALL produce explicit health issues while unrelated successful results remain available.

### Requirement: Infrastructure issue scans preserve partial results

`coolify_find_issues` SHALL scan servers, applications, databases, and services concurrently. It SHALL report unreachable/unusable servers and `exited`, `unhealthy`, `error`, or `stopped` resources, include per-source errors, and always return summary counts plus an issues array.

### Requirement: Application deployments use the declared collection

`GET /deployments/applications/{uuid}` SHALL return `{ count, deployments }`. Application diagnosis SHALL read the `deployments` array and report each deployment's `deployment_uuid`, status, and creation time.
