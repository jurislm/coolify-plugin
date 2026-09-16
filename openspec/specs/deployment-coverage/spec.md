---
title: Deployment Coverage Specification
version: 2.0.0
date: 2026-09-16
---

## Purpose

Specify deployment operations generated from the official Coolify OpenAPI document and registered with MCP `registerTool`.

## Requirements

### Requirement: Focused deployment operations are exposed

The catalog SHALL include `coolify_list_deployments`, `coolify_get_deployment_by_uuid`, `coolify_cancel_deployment_by_uuid`, `coolify_deploy_by_tag_or_uuid`, and `coolify_list_deployments_by_app_uuid` with generated schemas and method/path metadata.

### Requirement: Deployment collection wrappers are accepted

`coolify_list_deployments_by_app_uuid` SHALL normalize arrays and known `{ count, deployments }`, `{ data: [...] }`, `{ items: [...] }`, and `{ results: [...] }` responses before returning its `ToolEnvelope`.

#### Scenario: List deployments for an application

- **WHEN** the provider returns `{ count: 1, deployments: [{ uuid: "dep-uuid" }] }`
- **THEN** `callTool` succeeds and structured data contains an array with `dep-uuid`

### Requirement: Destructive annotations are accurate

Cancel and delete operations SHALL be marked non-read-only and destructive where the generated HTTP operation deletes or cancels a resource; list/get operations SHALL be read-only.
