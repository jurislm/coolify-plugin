> Current contract: use the generated `coolify_*` operations in `src/generated/operations.ts` and explicit wrappers registered with `registerTool` in `src/server.ts`; older action-oriented examples in this artifact are superseded. Executable checks live in Bun tests.

## Why

coolify-plugin v3.2.1 covers all Coolify API endpoints but several request/response types are missing fields that Coolify v4.0.0-beta.471 now supports. This causes silent data loss (e.g., env var `comment` field dropped), incorrect field names (`is_build_time` vs `is_runtime`/`is_buildtime`), and missing parameters (`docker_cleanup` on stop, `force` on server delete). Aligning now prevents user confusion and ensures the MCP tools expose the full API surface.

## What Changes

- Add `comment` field to `CreateEnvVarRequest`, `UpdateEnvVarRequest`, and `BulkUpdateEnvVarsRequest` for all resource types (applications, databases, services)
- Add `is_runtime` and `is_buildtime` fields to env var request types (matching Coolify API naming)
- Expand `UpdateServiceRequest` to support `urls`, `force_domain_override`, `is_container_label_escape_enabled`, and `connect_to_docker_network`
- Expand `CreateServiceRequest` to support `urls`, `force_domain_override`, `is_container_label_escape_enabled`
- Add `docker_cleanup` parameter to `stopApplication()`, `stopDatabase()`, `stopService()` and the `control` MCP tool's stop action
- Add `force` parameter to `deleteServer()` and the `server` MCP tool's delete action

## Capabilities

### New Capabilities

- `env-var-comments`: Support for the `comment` field on environment variables across all resource types
- `stop-docker-cleanup`: Support for `docker_cleanup` parameter on stop actions for applications, databases, and services
- `server-force-delete`: Support for `force` query parameter when deleting servers with active resources

### Modified Capabilities

- `api-compatibility`: Env var field names updated (`is_runtime`/`is_buildtime`), `UpdateServiceRequest` and `CreateServiceRequest` expanded with new fields

## Impact

- **Types**: `src/generated/coolify-api.ts` — 6 interfaces modified
- **Client**: `src/client.ts` — 4 methods gain new parameters, service update/create payloads expanded
- **MCP Server**: `src/server.ts` — `env_vars`, `control`, `server`, `service` tool schemas updated
- **Tests**: `src/client.test.ts` and `src/server.test.ts` — new test cases for added fields/parameters
- **No breaking changes**: All new fields are optional; existing callers unaffected
