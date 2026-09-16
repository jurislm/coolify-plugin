---
title: Cloud Tokens Specification
version: 1.0.0
date: 2026-05-02
---

> Current contract: use the generated `coolify_*` operations in `src/generated/operations.ts` and explicit wrappers registered with `registerTool` in `src/server.ts`; older action-oriented examples in this artifact are superseded. Executable checks live in Bun tests.


## Purpose

Define the MCP tool surface for managing cloud provider API tokens (Hetzner, DigitalOcean) stored in Coolify, including validation of token connectivity.

## Requirements

### Requirement: The cloud_tokens tool must support list/get/create/update/delete/validate via a single action parameter

The `cloud_tokens` MCP tool MUST support six actions. The `provider` field accepts `"hetzner"` or `"digitalocean"`.

#### Scenario: List cloud tokens

- **WHEN** a caller invokes `action: "list"`
- **THEN** the client calls `GET /api/v1/cloud-tokens` and returns a `CloudToken` array

#### Scenario: Get a single cloud token

- **WHEN** a caller invokes `action: "get"` with `uuid`
- **THEN** the client calls `GET /api/v1/cloud-tokens/{uuid}` and returns the `CloudToken`
- **WHEN** `uuid` is omitted
- **THEN** the handler returns `"Error: uuid required"`

#### Scenario: Create a cloud token

- **WHEN** a caller invokes `action: "create"` with `provider`, `token`, and `name`
- **THEN** the client calls `POST /api/v1/cloud-tokens` with `{ provider, token, name }` and returns a `UuidResponse`
- **WHEN** any of `provider`, `token`, or `name` is missing
- **THEN** the handler returns `"Error: provider, token, name required"`

#### Scenario: Update a cloud token name

- **WHEN** a caller invokes `action: "update"` with `uuid` and `name`
- **THEN** the client calls `PATCH /api/v1/cloud-tokens/{uuid}` with `{ name }` and returns the updated `CloudToken`
- **NOTE** the `token` field is NOT updatable; to rotate a token, delete and recreate

#### Scenario: Delete a cloud token

- **WHEN** a caller invokes `action: "delete"` with `uuid`
- **THEN** the client calls `DELETE /api/v1/cloud-tokens/{uuid}` and returns a `MessageResponse`

### Requirement: Token validation must call the Coolify validate endpoint and return connectivity status

#### Scenario: Validate a cloud token

- **WHEN** a caller invokes `action: "validate"` with `uuid`
- **THEN** the client calls `POST /api/v1/cloud-tokens/{uuid}/validate` and returns a `CloudTokenValidation` response indicating whether the token can reach its cloud provider
