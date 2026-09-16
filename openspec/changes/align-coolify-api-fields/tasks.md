> Current contract: use the generated `coolify_*` operations in `src/generated/operations.ts` and explicit wrappers registered with `registerTool` in `src/server.ts`; older action-oriented examples in this artifact are superseded. Executable checks live in Bun tests.

## 1. Types — src/generated/coolify-api.ts

- [x] 1.1 Add `comment?: string` to `CreateEnvVarRequest`, `UpdateEnvVarRequest`
- [x] 1.2 Add `is_runtime?: boolean` and `is_buildtime?: boolean` to `CreateEnvVarRequest`, `UpdateEnvVarRequest`
- [x] 1.3 Add `comment?: string` to the item type in `BulkUpdateEnvVarsRequest`
- [x] 1.4 Add `urls?: Array<{name: string, url: string}>`, `force_domain_override?: boolean`, `is_container_label_escape_enabled?: boolean` to `CreateServiceRequest`
- [x] 1.5 Expand `UpdateServiceRequest` with `urls`, `force_domain_override`, `is_container_label_escape_enabled`, `connect_to_docker_network`; remove deprecated `fqdn?: never`
- [x] 1.6 Add `StopOptions` interface with `dockerCleanup?: boolean`

## 2. Client — src/client.ts

- [x] 2.1 Update `stopApplication(uuid, options?: StopOptions)` to pass `docker_cleanup` as query param
- [x] 2.2 Update `stopDatabase(uuid, options?: StopOptions)` to pass `docker_cleanup` as query param
- [x] 2.3 Update `stopService(uuid, options?: StopOptions)` to pass `docker_cleanup` as query param
- [x] 2.4 Update `deleteServer(uuid, options?: { force?: boolean })` to pass `force` as query param
- [x] 2.5 Update `updateService()` to include new fields in the payload allowlist
- [x] 2.6 Update `createService()` to include new fields in the payload

## 3. MCP Server — src/server.ts

- [x] 3.1 Add `comment` parameter to `env_vars` tool schema for create/update/bulk_create actions
- [x] 3.2 Add `is_runtime` and `is_buildtime` parameters to `env_vars` tool schema
- [x] 3.3 Add `docker_cleanup` parameter to `control` tool schema for stop action
- [x] 3.4 Add `force` parameter to `server` tool schema for delete action
- [x] 3.5 Add new service fields to `service` tool schema for create/update actions

## 4. Tests — src/**tests**/

- [x] 4.1 Add client test: env var create/update with `comment`, `is_runtime`, `is_buildtime`
- [x] 4.2 Add client test: `stopApplication` with `dockerCleanup` option
- [x] 4.3 Add client test: `stopDatabase` with `dockerCleanup` option
- [x] 4.4 Add client test: `stopService` with `dockerCleanup` option
- [x] 4.5 Add client test: `deleteServer` with `force` option
- [x] 4.6 Add client test: `createService` and `updateService` with new fields
- [x] 4.7 Add MCP server test: `env_vars` tool with comment field
- [x] 4.8 Add MCP server test: `control` tool stop with docker_cleanup
- [x] 4.9 Add MCP server test: `server` tool delete with force

## 5. Validation

- [x] 5.1 Run `bun run build` — no TypeScript errors
- [x] 5.2 Run `bun run test` — all tests pass (366 tests, 100% coverage)
- [x] 5.3 Run `bun run check` — no lint errors
- [x] 5.4 Run `bun run check` — formatting OK
