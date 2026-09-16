> Current contract: use the generated `coolify_*` operations in `src/generated/operations.ts` and explicit wrappers registered with `registerTool` in `src/server.ts`; older action-oriented examples in this artifact are superseded. Executable checks live in Bun tests.

## ADDED Requirements

### Requirement: Deploy supports pull request ID and Docker tag

The `deployByTagOrUuid` client method SHALL accept optional `pr` (number) and `docker_tag` (string) parameters. These SHALL be sent as query parameters to the Coolify deploy endpoint.

#### Scenario: Deploy a pull request preview

- **WHEN** `deployByTagOrUuid` is called with `uuid: "app-uuid"` and `pr: 42`
- **THEN** the client sends GET `/deploy?uuid=app-uuid&pr=42`

#### Scenario: Deploy a specific Docker tag

- **WHEN** `deployByTagOrUuid` is called with `uuid: "app-uuid"` and `docker_tag: "v2.0.0"`
- **THEN** the client sends GET `/deploy?uuid=app-uuid&docker_tag=v2.0.0`

### Requirement: MCP deploy tool exposes PR and Docker tag params

The `deploy` MCP tool SHALL accept optional `pr` (number) and `docker_tag` (string) parameters.

#### Scenario: MCP deploy PR preview

- **WHEN** the `deploy` tool is called with `uuid: "app-uuid"` and `pr: 42`
- **THEN** the parameters are passed to `deployByTagOrUuid`
