> Status: superseded source-history record; the requirements and scenarios below are non-normative. The current contract is generated `coolify_*` operations in `src/generated/operations.ts` plus explicit wrappers registered with `registerTool` in `src/server.ts`. Executable checks live in Bun tests.

# service-update-coverage Specification

## Purpose

TBD - created by archiving change improve-test-coverage-100. Update Purpose after archive.

## Requirements

### Requirement: get_service tool dispatches to client.getService

The `get_service` tool SHALL call `client.getService(uuid)` (line 1058).

#### Scenario: get_service dispatches correctly

- **WHEN** `get_service` tool is called with `{ uuid: 'svc-uuid' }`
- **THEN** `client.getService` is called with `'svc-uuid'`

### Requirement: service update action dispatches to client.updateService

The `service` tool `update` action SHALL call `client.updateService` with the given uuid and body fields (lines 1128-1136).

#### Scenario: service update dispatches to updateService

- **WHEN** `service` tool is called with `{ action: 'update', uuid: 'svc-uuid', name: 'new-name' }`
- **THEN** `client.updateService` is called with `'svc-uuid'` and an object containing `name: 'new-name'`

#### Scenario: service update without uuid returns validation error

- **WHEN** `service` tool is called with `{ action: 'update' }` (uuid omitted)
- **THEN** the response content text contains `'Error: uuid required'`
