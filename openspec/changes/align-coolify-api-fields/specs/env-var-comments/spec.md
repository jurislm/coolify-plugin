> Current contract: use the generated `coolify_*` operations in `src/generated/operations.ts` and explicit wrappers registered with `registerTool` in `src/server.ts`; older action-oriented examples in this artifact are superseded. Executable checks live in Bun tests.

## ADDED Requirements

### Requirement: Environment variable requests support comment field

The `CreateEnvVarRequest`, `UpdateEnvVarRequest`, and `BulkUpdateEnvVarsRequest` types SHALL include an optional `comment` field of type `string`. The field SHALL be passed through to the Coolify API for applications, databases, and services.

#### Scenario: Creating an env var with a comment

- **WHEN** a caller creates an environment variable with `comment: "Database connection for production"`
- **THEN** the client includes `comment` in the POST request body to `/applications/{uuid}/envs`

#### Scenario: Updating an env var with a comment

- **WHEN** a caller updates an environment variable and provides a `comment` field
- **THEN** the client includes `comment` in the PATCH request body

#### Scenario: Bulk creating env vars with comments

- **WHEN** a caller bulk-creates environment variables where some items include `comment`
- **THEN** each item's `comment` field is preserved in the bulk request payload

#### Scenario: Comment field omitted

- **WHEN** a caller creates or updates an env var without providing `comment`
- **THEN** the `comment` field is not included in the request body (existing behavior preserved)

### Requirement: MCP env_vars tool exposes comment field

The `env_vars` MCP tool SHALL accept an optional `comment` parameter for `create`, `update`, and `bulk_create` actions across all resource types (application, database, service).

#### Scenario: MCP tool creates env var with comment

- **WHEN** the `env_vars` tool is called with action `create` and `comment` is provided
- **THEN** the comment is passed to the client method and included in the API request
