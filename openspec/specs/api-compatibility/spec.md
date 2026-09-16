---
title: API Compatibility Specification
version: 2.0.0
date: 2026-09-16
---

## Purpose

Define the boundaries between the official generated Coolify contract and the local client/wrapper compatibility layer.

## Requirements

### Requirement: Generated request schemas are authoritative

The client and explicit wrappers SHALL parse generated operation inputs before fetch. Unsupported compatibility fields SHALL be rejected at the MCP boundary rather than forwarded or silently remapped.

### Requirement: Provider collection responses are normalized narrowly

The client SHALL preserve generated schemas globally while allowing collection-shaped runtime responses for the known `/databases`, `/resources`, and application-deployments operations. Known array wrappers SHALL normalize to arrays before wrapper logic.

### Requirement: Request safety is preserved

Path parameters SHALL be URI encoded, undefined query values SHALL be omitted, explicit false values SHALL remain, mutation requests SHALL not retry, and provider errors SHALL not include tokens.

### Requirement: Environment identity fields have explicit fallbacks

`coolify_get_environment` SHALL match databases using `environment_id`/`id`, `environment_uuid`/`uuid`, and `environment_name`/`name`; database type resolution SHALL use `database_type` then `type`.
