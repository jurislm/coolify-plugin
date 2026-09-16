> Current contract: use the generated `coolify_*` operations in `src/generated/operations.ts` and explicit wrappers registered with `registerTool` in `src/server.ts`; older action-oriented examples in this artifact are superseded. Executable checks live in Bun tests.

# scheduled-tasks-coverage Specification

## Purpose

TBD - created by archiving change improve-test-coverage-100. Update Purpose after archive.

## Requirements

### Requirement: teams get action validates id and dispatches to getTeam

The `teams` tool `get` action SHALL require `id` and call `client.getTeam(id)` (lines 1478-1480).

#### Scenario: teams get without id returns validation error

- **WHEN** `teams` tool is called with `{ action: 'get' }` (id omitted)
- **THEN** the response content text contains `'Error: id required'`

#### Scenario: teams get with id dispatches to getTeam

- **WHEN** `teams` tool is called with `{ action: 'get', id: 1 }`
- **THEN** `client.getTeam` is called with `1`

### Requirement: teams members action validates id and dispatches to getTeamMembers

The `teams` tool `members` action SHALL require `id` and call `client.getTeamMembers(id)` (lines 1481-1483).

#### Scenario: teams members without id returns validation error

- **WHEN** `teams` tool is called with `{ action: 'members' }` (id omitted)
- **THEN** the response content text contains `'Error: id required'`

#### Scenario: teams members with id dispatches to getTeamMembers

- **WHEN** `teams` tool is called with `{ action: 'members', id: 2 }`
- **THEN** `client.getTeamMembers` is called with `2`

### Requirement: private_keys create action validates and dispatches to createPrivateKey

The `private_keys` tool `create` action SHALL require `private_key` and call `client.createPrivateKey` (lines 1511-1519).

#### Scenario: private_keys create dispatches correctly

- **WHEN** `private_keys` tool is called with `{ action: 'create', private_key: 'pk-content' }`
- **THEN** `client.createPrivateKey` is called with `{ private_key: 'pk-content', name: 'unnamed-key' }`

### Requirement: private_keys update action validates uuid and dispatches to updatePrivateKey

The `private_keys` tool `update` action SHALL require `uuid` and call `client.updatePrivateKey` (lines 1520-1525).

#### Scenario: private_keys update without uuid returns validation error

- **WHEN** `private_keys` tool is called with `{ action: 'update' }` (uuid omitted)
- **THEN** the response content text contains `'Error: uuid required'`

#### Scenario: private_keys update dispatches to updatePrivateKey

- **WHEN** `private_keys` tool is called with `{ action: 'update', uuid: 'key-uuid', name: 'new-name' }`
- **THEN** `client.updatePrivateKey` is called with `'key-uuid'`

### Requirement: private_keys delete action validates uuid and dispatches to deletePrivateKey

The `private_keys` tool `delete` action SHALL require `uuid` and call `client.deletePrivateKey` (lines 1526-1529).

#### Scenario: private_keys delete without uuid returns validation error

- **WHEN** `private_keys` tool is called with `{ action: 'delete' }` (uuid omitted)
- **THEN** the response content text contains `'Error: uuid required'`

#### Scenario: private_keys delete dispatches to deletePrivateKey

- **WHEN** `private_keys` tool is called with `{ action: 'delete', uuid: 'key-uuid' }`
- **THEN** `client.deletePrivateKey` is called with `'key-uuid'`
