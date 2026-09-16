---
title: Hetzner Integration Specification
version: 1.0.0
date: 2026-05-02
---

> Current contract: use the generated `coolify_*` operations in `src/generated/operations.ts` and explicit wrappers registered with `registerTool` in `src/server.ts`; older action-oriented examples in this artifact are superseded. Executable checks live in Bun tests.


## Purpose

Define the MCP tool surface and client behavior for Hetzner Cloud resource provisioning through the Coolify API.

## Requirements

### Requirement: The hetzner tool must expose discovery and creation actions via a unified action parameter

The `hetzner` MCP tool MUST support five actions: `locations`, `server_types`, `images`, `ssh_keys`, and `create_server`. All discovery actions accept an optional `cloud_provider_token_uuid` parameter; if omitted the Coolify instance uses its default configured token.

#### Scenario: List available Hetzner locations

- **WHEN** a caller invokes the `hetzner` tool with `action: "locations"`
- **THEN** the client calls `GET /api/v1/hetzner/locations` (with optional `?cloud_provider_token_uuid=`) and returns an array of `HetznerLocation` objects

#### Scenario: List available server types

- **WHEN** a caller invokes the `hetzner` tool with `action: "server_types"`
- **THEN** the client calls `GET /api/v1/hetzner/server-types` and returns an array of `HetznerServerType` objects

#### Scenario: List available images

- **WHEN** a caller invokes the `hetzner` tool with `action: "images"`
- **THEN** the client calls `GET /api/v1/hetzner/images` and returns an array of `HetznerImage` objects

#### Scenario: List SSH keys registered in Hetzner

- **WHEN** a caller invokes the `hetzner` tool with `action: "ssh_keys"`
- **THEN** the client calls `GET /api/v1/hetzner/ssh-keys` and returns an array of `HetznerSSHKey` objects

### Requirement: Server creation requires four mandatory fields and uses POST /servers/hetzner

The `create_server` action MUST validate that `location`, `server_type`, `image` (integer ID), and `private_key_uuid` are all provided before sending the request. Missing any of these four returns an explicit error message without calling the API.

#### Scenario: Valid create_server request

- **WHEN** a caller provides `action: "create_server"` with all four required fields and optional fields (`name`, `enable_ipv4`, `enable_ipv6`, `hetzner_ssh_key_ids`, `cloud_init_script`, `instant_validate`)
- **THEN** the client calls `POST /api/v1/servers/hetzner` with the full payload and returns a `CreateHetznerServerResponse`

#### Scenario: Incomplete create_server request

- **WHEN** a caller omits one or more of `location`, `server_type`, `image`, or `private_key_uuid`
- **THEN** the handler returns an error response `"Error: location, server_type, image, private_key_uuid required"` without making an API call
