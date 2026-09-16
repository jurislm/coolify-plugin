> Current contract: use the generated `coolify_*` operations in `src/generated/operations.ts` and explicit wrappers registered with `registerTool` in `src/server.ts`; older action-oriented examples in this artifact are superseded. Executable checks live in Bun tests.

## 1. Types — src/generated/coolify-api.ts

- [x] 1.1 Add ~25 optional fields to `UpdateApplicationRequest` (domains, static flags, deployment commands, Docker registry, webhooks, container config)
- [x] 1.2 Add `proxy_type`, `concurrent_builds`, `dynamic_timeout`, `deployment_queue_limit`, `server_disk_usage_notification_threshold`, `server_disk_usage_check_frequency` to `UpdateServerRequest`
- [x] 1.3 Add `public_port_timeout` to `CreateDatabaseBaseRequest` and `UpdateDatabaseRequest`
- [x] 1.4 Add `database_backup_retention_max_storage_locally`, `database_backup_retention_max_storage_s3`, `timeout` to `CreateDatabaseBackupRequest` and `UpdateDatabaseBackupRequest`
- [x] 1.5 Add `fs_path` to `CreateStorageRequest` (already existed)

## 2. Client — src/client.ts

- [x] 2.1 Update `deployByTagOrUuid` to accept and pass `docker_tag` as query param (pull_request_id already supported)

## 3. MCP Server — src/server.ts

- [x] 3.1 Verify Tier 1+2 application fields in the generated application create/update operation schemas and registerTool catalog
- [x] 3.2 Add server build/monitoring fields to `server` tool schema for update action and wire through handler
- [x] 3.3 Add `public_port_timeout` to `database` tool schema for create/update actions and wire through handler
- [x] 3.4 Add backup retention and timeout fields to `database_backups` tool schema and wire through handler
- [x] 3.5 Add `fs_path` to `storages` tool schema and wire through handler (already existed)
- [x] 3.6 Add `docker_tag` to `deploy` tool schema and wire through handler (PR already supported)

## 4. Tests — src/**tests**/

- [x] 4.1 Add client test: `updateApplication` with new fields (domains, is_static, deployment commands)
- [x] 4.2 Add client test: `updateServer` with new build/monitoring fields
- [x] 4.3 Add client test: `updateDatabase` with `public_port_timeout`
- [x] 4.4 Add client test: backup update with retention limits and timeout
- [x] 4.5 Add client test: `deployByTagOrUuid` with `docker_tag`
- [x] 4.6 Add client test: storage create with `fs_path` (already existed)
- [x] 4.7 Add MCP test: generated application operation update with new fields
- [x] 4.8 Add MCP test: `server` tool update with build fields
- [x] 4.9 Add MCP test: `database` tool with `public_port_timeout`
- [x] 4.10 Add MCP test: `deploy` tool with docker_tag

## 5. Validation

- [x] 5.1 Run `bun run build` — no TypeScript errors
- [x] 5.2 Run `bun run test` — all tests pass (376 tests, 100% coverage)
- [x] 5.3 Run `bun run check` — no lint errors
- [x] 5.4 Run `bun run check` — formatting OK
