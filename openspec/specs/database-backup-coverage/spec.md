> Status: superseded source-history record; the requirements and scenarios below are non-normative. The current contract is generated `coolify_*` operations in `src/generated/operations.ts` plus explicit wrappers registered with `registerTool` in `src/server.ts`. Executable checks live in Bun tests.

# database-backup-coverage Specification

## Purpose

TBD - created by archiving change improve-test-coverage-100. Update Purpose after archive.

## Requirements

### Requirement: database_backups get_execution dispatches to getBackupExecution

The `database_backups` tool `get_execution` action SHALL require `backup_uuid` and `execution_uuid` and call `client.getBackupExecution` (line 1735).

#### Scenario: get_execution dispatches correctly

- **WHEN** `database_backups` tool is called with `{ action: 'get_execution', database_uuid: 'd', backup_uuid: 'b', execution_uuid: 'e' }`
- **THEN** `client.getBackupExecution` is called with `'d'`, `'b'`, `'e'`

### Requirement: database_backups create dispatches to createDatabaseBackup

The `database_backups` tool `create` action SHALL require `frequency` and call `client.createDatabaseBackup` (lines 1756-1790).

#### Scenario: create without frequency returns validation error

- **WHEN** `database_backups` tool is called with `{ action: 'create', database_uuid: 'd' }` (frequency omitted)
- **THEN** the response content text contains `'Error: frequency required'`

#### Scenario: create with frequency dispatches to createDatabaseBackup

- **WHEN** `database_backups` tool is called with `{ action: 'create', database_uuid: 'd', frequency: '@daily' }`
- **THEN** `client.createDatabaseBackup` is called with `'d'` and `{ frequency: '@daily' }`

### Requirement: database_backups update dispatches to updateDatabaseBackup

The `database_backups` tool `update` action SHALL require `backup_uuid` and call `client.updateDatabaseBackup` (lines 1796-1830).

#### Scenario: update without backup_uuid returns validation error

- **WHEN** `database_backups` tool is called with `{ action: 'update', database_uuid: 'd' }` (backup_uuid omitted)
- **THEN** the response content text contains `'Error: backup_uuid required'`

#### Scenario: update with backup_uuid dispatches to updateDatabaseBackup

- **WHEN** `database_backups` tool is called with `{ action: 'update', database_uuid: 'd', backup_uuid: 'b', enabled: false }`
- **THEN** `client.updateDatabaseBackup` is called with `'d'`, `'b'`

### Requirement: storages tool list dispatches to correct client method per resource_type

The `storages` tool `list` action SHALL dispatch to the correct list method for application, database, and service (lines 1898-1902).

#### Scenario: storages list for application dispatches to listApplicationStorages

- **WHEN** `storages` tool is called with `{ action: 'list', resource_type: 'application', uuid: 'app-uuid' }`
- **THEN** `client.listApplicationStorages` is called with `'app-uuid'`

#### Scenario: storages list for database dispatches to listDatabaseStorages

- **WHEN** `storages` tool is called with `{ action: 'list', resource_type: 'database', uuid: 'db-uuid' }`
- **THEN** `client.listDatabaseStorages` is called with `'db-uuid'`

#### Scenario: storages list for service dispatches to listServiceStorages

- **WHEN** `storages` tool is called with `{ action: 'list', resource_type: 'service', uuid: 'svc-uuid' }`
- **THEN** `client.listServiceStorages` is called with `'svc-uuid'`

### Requirement: storages create for application dispatches to createApplicationStorage

The `storages` tool `create` action with `resource_type='application'` SHALL call `client.createApplicationStorage` (lines 1948-1952 area).

#### Scenario: storages create for application dispatches correctly

- **WHEN** `storages` tool is called with `{ action: 'create', resource_type: 'application', uuid: 'app-uuid', type: 'persistent', mount_path: '/data' }`
- **THEN** `client.createApplicationStorage` is called with `'app-uuid'`

### Requirement: storages update for application dispatches to updateApplicationStorage

The `storages` tool `update` action with `resource_type='application'` SHALL call `client.updateApplicationStorage` (lines 1975-1979 area).

#### Scenario: storages update for application dispatches correctly

- **WHEN** `storages` tool is called with `{ action: 'update', resource_type: 'application', uuid: 'app-uuid', type: 'persistent', storage_uuid: 'st-uuid' }`
- **THEN** `client.updateApplicationStorage` is called with `'app-uuid'`

### Requirement: storages delete for application dispatches to deleteApplicationStorage

The `storages` tool `delete` action with `resource_type='application'` SHALL call `client.deleteApplicationStorage` (lines 1989-1990 area).

#### Scenario: storages delete for application dispatches correctly

- **WHEN** `storages` tool is called with `{ action: 'delete', resource_type: 'application', uuid: 'app-uuid', storage_uuid: 'st-uuid' }`
- **THEN** `client.deleteApplicationStorage` is called with `'app-uuid'`, `'st-uuid'`
