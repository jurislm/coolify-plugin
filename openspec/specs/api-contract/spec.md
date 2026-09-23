---
title: Coolify API Contract
version: 1.0.0
date: 2026-09-23
---

## Purpose

Define the single Coolify API contract used by the current local stdio plugin.

## Requirements

### Requirement: One generated contract is authoritative

`openapi/coolify-openapi.json` SHALL define the input and output schemas for every generated tool. It SHALL start from the pinned Coolify v4.3.23 release and contain the current endpoint corrections recorded in `api/manifest.json`. Runtime handlers SHALL validate against those schemas without alternate field names, response formats, or version branches.

### Requirement: Collection responses have one shape each

`GET /databases` and `GET /resources` SHALL return arrays. `GET /deployments/applications/{uuid}` SHALL return an object with `count` and `deployments`. The client SHALL pass provider JSON through unchanged; generated tools and composite capabilities SHALL use these declared shapes.

### Requirement: Database updates send only requested fields

`PATCH /databases/{uuid}` SHALL accept `custom_docker_run_options` and SHALL NOT inject health-check defaults when those fields are omitted.

### Requirement: Request safety is preserved

Path parameters SHALL be URI encoded, undefined query values SHALL be omitted, explicit false values SHALL remain, mutation requests SHALL NOT retry, and provider errors SHALL NOT include tokens.

### Requirement: Environment identity uses current fields

`coolify_get_environment` SHALL match `Environment.id` to `DatabaseRecord.environment_id` and read `DatabaseRecord.database_type` for database type resolution.
