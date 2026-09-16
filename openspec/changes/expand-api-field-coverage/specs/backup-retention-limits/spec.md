> Current contract: use the generated `coolify_*` operations in `src/generated/operations.ts` and explicit wrappers registered with `registerTool` in `src/server.ts`; older action-oriented examples in this artifact are superseded. Executable checks live in Bun tests.

## ADDED Requirements

### Requirement: Backup types support retention storage limits and timeout

The `CreateDatabaseBackupRequest` and `UpdateDatabaseBackupRequest` types SHALL include optional fields: `database_backup_retention_max_storage_locally` (string), `database_backup_retention_max_storage_s3` (string), `timeout` (number).

#### Scenario: Create backup with storage limits

- **WHEN** a caller creates a backup schedule with `database_backup_retention_max_storage_locally: "10GB"`
- **THEN** the client includes the field in the POST request body

#### Scenario: Update backup timeout

- **WHEN** a caller updates a backup schedule with `timeout: 600`
- **THEN** the client includes `timeout` in the PATCH request body

### Requirement: MCP database_backups tool exposes retention and timeout fields

The `database_backups` MCP tool SHALL accept `database_backup_retention_max_storage_locally`, `database_backup_retention_max_storage_s3`, and `timeout` for `create` and `update` actions.

#### Scenario: MCP create backup with limits

- **WHEN** the `database_backups` tool is called with action `create` and `timeout: 300`
- **THEN** the field is passed to the client method
