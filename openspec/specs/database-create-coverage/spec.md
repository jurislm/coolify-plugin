> Current contract: use the generated `coolify_*` operations in `src/generated/operations.ts` and explicit wrappers registered with `registerTool` in `src/server.ts`; older action-oriented examples in this artifact are superseded. Executable checks live in Bun tests.

# database-create-coverage Specification

## Purpose

TBD - created by archiving change improve-test-coverage-100. Update Purpose after archive.

## Requirements

### Requirement: database create dispatches to correct client method for each engine

The `database` tool `create` action SHALL dispatch to the correct `CoolifyClient` method for each engine type (lines 969-1034).

#### Scenario: create mysql dispatches to createMysql

- **WHEN** `database` tool is called with `{ action: 'create', type: 'mysql', project_uuid: 'p', server_uuid: 's', environment_name: 'production' }`
- **THEN** `client.createMysql` is called with the base fields

#### Scenario: create mariadb dispatches to createMariadb

- **WHEN** `database` tool is called with `{ action: 'create', type: 'mariadb', project_uuid: 'p', server_uuid: 's', environment_name: 'production' }`
- **THEN** `client.createMariadb` is called with the base fields

#### Scenario: create mongodb dispatches to createMongodb

- **WHEN** `database` tool is called with `{ action: 'create', type: 'mongodb', project_uuid: 'p', server_uuid: 's', environment_name: 'production' }`
- **THEN** `client.createMongodb` is called with the base fields

#### Scenario: create redis dispatches to createRedis

- **WHEN** `database` tool is called with `{ action: 'create', type: 'redis', project_uuid: 'p', server_uuid: 's', environment_name: 'production' }`
- **THEN** `client.createRedis` is called with the base fields

#### Scenario: create keydb dispatches to createKeydb

- **WHEN** `database` tool is called with `{ action: 'create', type: 'keydb', project_uuid: 'p', server_uuid: 's', environment_name: 'production' }`
- **THEN** `client.createKeydb` is called with the base fields

#### Scenario: create clickhouse dispatches to createClickhouse

- **WHEN** `database` tool is called with `{ action: 'create', type: 'clickhouse', project_uuid: 'p', server_uuid: 's', environment_name: 'production' }`
- **THEN** `client.createClickhouse` is called with the base fields

#### Scenario: create dragonfly dispatches to createDragonfly

- **WHEN** `database` tool is called with `{ action: 'create', type: 'dragonfly', project_uuid: 'p', server_uuid: 's', environment_name: 'production' }`
- **THEN** `client.createDragonfly` is called with the base fields
