> Status: superseded source-history record; the requirements and scenarios below are non-normative. The current contract is generated `coolify_*` operations in `src/generated/operations.ts` plus explicit wrappers registered with `registerTool` in `src/server.ts`. Executable checks live in Bun tests.

# env-vars-coverage Specification

## Purpose

TBD - created by archiving change improve-test-coverage-100. Update Purpose after archive.

## Requirements

### Requirement: application bulk_create dispatches to bulkUpdateApplicationEnvVars

The `env_vars` tool with `resource='application'` and `action='bulk_create'` SHALL call `client.bulkUpdateApplicationEnvVars` (line 1300).

#### Scenario: application bulk_create dispatches correctly

- **WHEN** `env_vars` tool is called with `{ resource: 'application', action: 'bulk_create', uuid: 'app-uuid', bulk_data: [{ key: 'K', value: 'V' }] }`
- **THEN** `client.bulkUpdateApplicationEnvVars` is called with `'app-uuid'` and `{ data: [...] }`

### Requirement: database env_vars create dispatches to createDatabaseEnvVar

The `env_vars` tool with `resource='database'` and `action='create'` SHALL call `client.createDatabaseEnvVar` (lines 1311-1317).

#### Scenario: database create dispatches correctly

- **WHEN** `env_vars` tool is called with `{ resource: 'database', action: 'create', uuid: 'db-uuid', key: 'K', value: 'V' }`
- **THEN** `client.createDatabaseEnvVar` is called with `'db-uuid'`

### Requirement: database env_vars update dispatches to updateDatabaseEnvVar

The `env_vars` tool with `resource='database'` and `action='update'` SHALL call `client.updateDatabaseEnvVar` (lines 1323-1329).

#### Scenario: database update dispatches correctly

- **WHEN** `env_vars` tool is called with `{ resource: 'database', action: 'update', uuid: 'db-uuid', key: 'K', value: 'V2' }`
- **THEN** `client.updateDatabaseEnvVar` is called with `'db-uuid'`

### Requirement: service env_vars create dispatches to createServiceEnvVar

The `env_vars` tool with `resource='service'` and `action='create'` SHALL call `client.createServiceEnvVar` (lines 1350-1356).

#### Scenario: service create dispatches correctly

- **WHEN** `env_vars` tool is called with `{ resource: 'service', action: 'create', uuid: 'svc-uuid', key: 'K', value: 'V' }`
- **THEN** `client.createServiceEnvVar` is called with `'svc-uuid'`

### Requirement: service env_vars bulk_create dispatches to bulkUpdateServiceEnvVars

The `env_vars` tool with `resource='service'` and `action='bulk_create'` SHALL call `client.bulkUpdateServiceEnvVars` (lines 1369-1374 area, captured in 1350-1356 range).

#### Scenario: service bulk_create dispatches correctly

- **WHEN** `env_vars` tool is called with `{ resource: 'service', action: 'bulk_create', uuid: 'svc-uuid', bulk_data: [{ key: 'K', value: 'V' }] }`
- **THEN** `client.bulkUpdateServiceEnvVars` is called with `'svc-uuid'`

### Requirement: list_deployments includes HATEOAS pagination

The `list_deployments` tool SHALL call `wrapWithActions` and include a `_pagination` section in the response (lines 1390-1394).

#### Scenario: list_deployments returns pagination actions

- **WHEN** `list_deployments` tool is called
- **THEN** the response content text contains `_pagination`
