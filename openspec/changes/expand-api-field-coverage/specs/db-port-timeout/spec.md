> Current contract: use the generated `coolify_*` operations in `src/generated/operations.ts` and explicit wrappers registered with `registerTool` in `src/server.ts`; older action-oriented examples in this artifact are superseded. Executable checks live in Bun tests.

## ADDED Requirements

### Requirement: Database types support public_port_timeout

The `CreateDatabaseBaseRequest` and `UpdateDatabaseRequest` types SHALL include optional field `public_port_timeout` (number). This field sets the timeout in seconds for the database's public port (default: 3600).

#### Scenario: Create database with port timeout

- **WHEN** a caller creates a PostgreSQL database with `public_port_timeout: 7200`
- **THEN** the client includes `public_port_timeout` in the POST request body

#### Scenario: Update database port timeout

- **WHEN** a caller updates a database with `public_port_timeout: 1800`
- **THEN** the client includes `public_port_timeout` in the PATCH request body

### Requirement: MCP database tool exposes public_port_timeout

The `database` MCP tool SHALL accept `public_port_timeout` for both `create` and `update` actions.

#### Scenario: MCP create database with timeout

- **WHEN** the `database` tool is called with action `create` and `public_port_timeout: 3600`
- **THEN** the field is passed to the appropriate create method
