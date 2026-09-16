---
title: Smart Diagnostics Specification
version: 2.0.0
date: 2026-09-16
---

## Purpose

Define the explicit wrapper behavior in `src/capabilities.ts` for application/server diagnostics and infrastructure issue scans.

## Requirements

### Requirement: Application diagnosis preserves partial results

`coolify_diagnose_application` SHALL resolve a UUID, name, or FQDN through the generated application list operation, then use `Promise.allSettled` for application details, logs, environment variables, and application deployments. Each rejected call SHALL add a named error while successful calls remain in the response.

#### Scenario: Partial application diagnosis

- **WHEN** details fail but logs, envs, or deployments succeed
- **THEN** the response includes the successful values and `errors` contains the details failure

#### Scenario: Safe application details

- **WHEN** environment variables are returned
- **THEN** only `key` and a boolean build-time indicator are returned; variable values are absent
- **WHEN** logs are returned
- **THEN** they are bounded to the last 200 lines and 50,000 characters with a truncation marker when needed

### Requirement: Server diagnosis uses reachability and resource health

`coolify_diagnose_server` SHALL resolve through the generated server-list operation and use `Promise.allSettled` for details, resources, domains, and validation. `is_reachable: false`, `is_usable: false`, and unhealthy resource statuses SHALL produce explicit health issues while unrelated successful results remain available.

### Requirement: Infrastructure issue scans preserve partial results

`coolify_find_issues` SHALL scan servers, applications, databases, and services concurrently. It SHALL report unreachable/unusable servers and `exited`, `unhealthy`, `error`, or `stopped` resources, include per-source errors, and always return summary counts plus an issues array.

### Requirement: Deployment shapes are normalized at the client boundary

The generated deployment operation SHALL accept arrays and known collection wrappers such as `{ count, deployments }`, `{ data: [...] }`, `{ items: [...] }`, and `{ results: [...] }` without disabling schemas globally. The client SHALL normalize those collections before wrapper processing.
