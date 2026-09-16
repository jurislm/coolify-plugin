---
title: GitHub Apps Specification
version: 1.0.0
date: 2026-05-02
---

> Status: superseded source-history record; the requirements and scenarios below are non-normative. The current contract is generated `coolify_*` operations in `src/generated/operations.ts` plus explicit wrappers registered with `registerTool` in `src/server.ts`. Executable checks live in Bun tests.


## Purpose

Define the MCP tool surface for managing GitHub App integrations registered in Coolify, including repository and branch enumeration for deployment source configuration.

## Requirements

### Requirement: The github_apps tool must support CRUD and discovery actions via a single action parameter

The `github_apps` MCP tool supports `list`, `get`, `create`, `update`, `delete`, `list_repos`, and `list_branches`. GitHub App resources use numeric integer IDs (not UUIDs) for path parameters, encoded as `String(id)` per API convention.

#### Scenario: List GitHub Apps

- **WHEN** a caller invokes `action: "list"`
- **THEN** the client calls `GET /api/v1/github-apps` and returns summary objects via `toGitHubAppSummary`

#### Scenario: Create a GitHub App

- **WHEN** a caller invokes `action: "create"` with a `CreateGitHubAppRequest` payload
- **THEN** the client calls `POST /api/v1/github-apps` and returns the created `GitHubApp`

#### Scenario: Update a GitHub App

- **WHEN** a caller invokes `action: "update"` with `id` and update fields
- **THEN** the client calls `PATCH /api/v1/github-apps/{id}` with `cleanRequestData(data)` applied to remove undefined fields, and returns a `GitHubAppUpdateResponse`

#### Scenario: Delete a GitHub App

- **WHEN** a caller invokes `action: "delete"` with `id`
- **THEN** the client calls `DELETE /api/v1/github-apps/{id}` and returns a `MessageResponse`

### Requirement: Repository and branch listing must unwrap nested response envelopes

The Coolify API wraps repository and branch lists in `{ repositories: [...] }` and `{ branches: [...] }` envelopes respectively. The client MUST unwrap these before returning.

#### Scenario: List repositories for a GitHub App

- **WHEN** a caller invokes `action: "list_repos"` with `id`
- **THEN** the client calls `GET /api/v1/github-apps/{id}/repositories`, unwraps `response.repositories`, maps each entry through `toGitHubRepoSummary`, and returns a `GitHubRepositorySummary` array

#### Scenario: List branches for a repository

- **WHEN** a caller invokes `action: "list_branches"` with `id`, `owner`, and `repo`
- **THEN** the client calls `GET /api/v1/github-apps/{id}/repositories/{owner}/{repo}/branches`, unwraps `response.branches`, and returns a `GitHubBranch` array
- **NOTE** `owner` and `repo` are `encodeURIComponent`-encoded in the path; `id` is stringified without encoding per numeric ID convention
