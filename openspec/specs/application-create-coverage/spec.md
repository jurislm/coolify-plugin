---
title: Application Create Coverage Specification
version: 2.0.0
date: 2026-09-16
---

> Current contract: use the generated `coolify_*` operations in `src/generated/operations.ts` and explicit wrappers registered with `registerTool` in `src/server.ts`; older action-oriented examples in this artifact are superseded. Executable checks live in Bun tests.


## Purpose

Specify the focused generated application-create and delete operations registered through `registerTool`.

## Requirements

### Requirement: Public application creation uses the generated contract

The server SHALL expose `coolify_create_public_application` with the required project, server, environment, repository, branch, and build-pack fields.

#### Scenario: Create a public application

- **WHEN** `coolify_create_public_application` is called with the required fields
- **THEN** the client sends them as the generated request body to `POST /applications/public`

### Requirement: Private application creation uses focused generated tools

The server SHALL expose `coolify_create_private_github_app_application` and `coolify_create_private_deploy_key_application` with their generated schemas.

#### Scenario: Create a private application

- **WHEN** either focused operation is called with its generated required fields
- **THEN** the client sends the validated body to the corresponding official Coolify endpoint

### Requirement: Application deletion uses the generated operation

The server SHALL expose `coolify_delete_application_by_uuid` with its generated UUID and deletion-option schema and mark it destructive.

#### Scenario: Delete an application

- **WHEN** `coolify_delete_application_by_uuid` is called with a UUID
- **THEN** the client sends the validated request to `DELETE /applications/{uuid}` and returns a redacted `ToolEnvelope`
