> Current contract: use the generated `coolify_*` operations in `src/generated/operations.ts` and explicit wrappers registered with `registerTool` in `src/server.ts`; older action-oriented examples in this artifact are superseded. Executable checks live in Bun tests.

## Why

coolify-plugin v3.2.1 covers all Coolify API endpoints but many request types have incomplete field coverage. Application update/create types are missing ~30 fields (domains, static app flags, deployment commands, Docker registry fields). Server update is missing 6 configuration fields. Database operations lack `public_port_timeout`. Backup types miss retention storage limits and timeout. Deploy endpoint lacks `pull_request_id` and `docker_tag` parameters. This limits what AI assistants can configure through MCP tools.

## What Changes

### Application Types

- Add Tier 1 fields to `UpdateApplicationRequest`: `domains`, `is_static`, `is_spa`, `is_auto_deploy_enabled`, `is_force_https_enabled`, `docker_registry_image_name`, `docker_registry_image_tag`, `redirect`, `autogenerate_domain`, `static_image`
- Add Tier 2 fields: `custom_labels`, `custom_docker_run_options`, `pre_deployment_command`, `pre_deployment_command_container`, `post_deployment_command`, `post_deployment_command_container`, `watch_paths`, `use_build_server`, `is_preserve_repository_enabled`
- Add Tier 3 fields: `manual_webhook_secret_github`, `manual_webhook_secret_gitlab`, `manual_webhook_secret_bitbucket`, `manual_webhook_secret_gitea`, `custom_nginx_configuration`

### Server Types

- Add to `UpdateServerRequest`: `proxy_type`, `concurrent_builds`, `dynamic_timeout`, `deployment_queue_limit`, `server_disk_usage_notification_threshold`, `server_disk_usage_check_frequency`

### Database Types

- Add `public_port_timeout` to `UpdateDatabaseRequest` and `CreateDatabaseBaseRequest`

### Backup Types

- Add `database_backup_retention_max_storage_locally`, `database_backup_retention_max_storage_s3`, `timeout` to backup request types

### Storage Types

- Add `fs_path` to `CreateStorageRequest`

### Deployment

- Add `docker_tag` parameter to deploy method and MCP tool (`pr` already supported)

## Capabilities

### New Capabilities

- `app-extended-config`: Extended application configuration fields (domains, static flags, deployment commands, Docker registry, webhooks)
- `server-extended-config`: Server build/deployment configuration fields
- `db-port-timeout`: Database public port timeout configuration
- `backup-retention-limits`: Backup retention storage limits and timeout
- `deploy-preview-tags`: Deploy with PR preview and Docker tag support

### Modified Capabilities

- `api-compatibility`: Storage create gains `fs_path` field

## Impact

- **Types**: `src/generated/coolify-api.ts` — ~10 interfaces modified
- **Client**: `src/client.ts` — `deployByTagOrUuid` gains new params
- **MCP Server**: `src/server.ts` — `application`, `server`, `database`, `database_backups`, `storages`, `deploy` tool schemas updated
- **Tests**: New test cases for added fields/parameters
- **No breaking changes**: All additions are optional fields
