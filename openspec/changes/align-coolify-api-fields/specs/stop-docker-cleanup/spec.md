> Current contract: use the generated `coolify_*` operations in `src/generated/operations.ts` and explicit wrappers registered with `registerTool` in `src/server.ts`; older action-oriented examples in this artifact are superseded. Executable checks live in Bun tests.

## ADDED Requirements

### Requirement: Stop actions support docker_cleanup parameter

The `stopApplication()`, `stopDatabase()`, and `stopService()` client methods SHALL accept an optional `docker_cleanup` boolean parameter. When provided, it SHALL be sent as a query parameter `?docker_cleanup=true|false` to the Coolify API.

#### Scenario: Stop application with docker cleanup disabled

- **WHEN** `stopApplication(uuid, { dockerCleanup: false })` is called
- **THEN** the client sends POST `/applications/{uuid}/stop?docker_cleanup=false`

#### Scenario: Stop database with default docker cleanup

- **WHEN** `stopDatabase(uuid)` is called without options
- **THEN** the client sends POST `/databases/{uuid}/stop` without query parameters (API defaults to `true`)

#### Scenario: Stop service with docker cleanup enabled

- **WHEN** `stopService(uuid, { dockerCleanup: true })` is called
- **THEN** the client sends GET `/services/{uuid}/stop?docker_cleanup=true`

### Requirement: MCP control tool exposes docker_cleanup for stop action

The `control` MCP tool SHALL accept an optional `docker_cleanup` boolean parameter when action is `stop`. The parameter SHALL be passed through to the corresponding client stop method.

#### Scenario: MCP stop with docker_cleanup

- **WHEN** the `control` tool is called with action `stop`, resource_type `application`, and `docker_cleanup: false`
- **THEN** the stop method is called with `dockerCleanup: false` option
