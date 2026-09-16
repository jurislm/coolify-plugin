> Current contract: use the generated `coolify_*` operations in `src/generated/operations.ts` and explicit wrappers registered with `registerTool` in `src/server.ts`; older action-oriented examples in this artifact are superseded. Executable checks live in Bun tests.

## ADDED Requirements

### Requirement: Server delete supports force parameter

The `deleteServer()` client method SHALL accept an optional `force` boolean parameter. When `true`, it SHALL be sent as query parameter `?force=true` to the Coolify API, which force-deletes the server and all its resources.

#### Scenario: Force delete server with resources

- **WHEN** `deleteServer(uuid, { force: true })` is called
- **THEN** the client sends DELETE `/servers/{uuid}?force=true`

#### Scenario: Normal delete server without force

- **WHEN** `deleteServer(uuid)` is called without options
- **THEN** the client sends DELETE `/servers/{uuid}` without query parameters

#### Scenario: Delete server with resources without force fails

- **WHEN** `deleteServer(uuid)` is called for a server that has active resources
- **THEN** the Coolify API returns 400 with message about using `?force=true`

### Requirement: MCP server tool exposes force parameter for delete action

The `server` MCP tool SHALL accept an optional `force` boolean parameter when action is `delete`.

#### Scenario: MCP server delete with force

- **WHEN** the `server` tool is called with action `delete` and `force: true`
- **THEN** the delete method is called with `{ force: true }` option
