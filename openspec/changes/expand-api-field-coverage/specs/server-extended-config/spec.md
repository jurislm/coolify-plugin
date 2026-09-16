> Current contract: use the generated `coolify_*` operations in `src/generated/operations.ts` and explicit wrappers registered with `registerTool` in `src/server.ts`; older action-oriented examples in this artifact are superseded. Executable checks live in Bun tests.

## ADDED Requirements

### Requirement: Server update supports build and monitoring configuration

The `UpdateServerRequest` type SHALL include optional fields: `proxy_type` (string), `concurrent_builds` (number), `dynamic_timeout` (number), `deployment_queue_limit` (number), `server_disk_usage_notification_threshold` (number), `server_disk_usage_check_frequency` (number).

#### Scenario: Update server concurrent builds

- **WHEN** a caller updates a server with `concurrent_builds: 4`
- **THEN** the client includes `concurrent_builds` in the PATCH request body

#### Scenario: Set disk usage monitoring

- **WHEN** a caller updates a server with `server_disk_usage_notification_threshold: 80, server_disk_usage_check_frequency: 300`
- **THEN** both fields are included in the PATCH request body

### Requirement: MCP server tool exposes build and monitoring fields

The `server` MCP tool SHALL accept `proxy_type`, `concurrent_builds`, `dynamic_timeout`, `deployment_queue_limit` for the `update` action.

#### Scenario: MCP update server build settings

- **WHEN** the `server` tool is called with action `update` and `concurrent_builds: 2`
- **THEN** the field is passed to `updateServer` client method
