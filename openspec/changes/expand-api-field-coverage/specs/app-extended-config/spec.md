## ADDED Requirements

### Requirement: UpdateApplicationRequest supports extended configuration fields

The `UpdateApplicationRequest` type SHALL include all optional fields accepted by the Coolify API's PATCH `/applications/{uuid}` endpoint, grouped by function:

**Domain & Routing:** `domains`, `redirect`, `is_force_https_enabled`, `autogenerate_domain`
**Static App:** `is_static`, `is_spa`, `static_image`
**Deployment:** `is_auto_deploy_enabled`, `use_build_server`, `is_preserve_repository_enabled`, `watch_paths`
**Docker Registry:** `docker_registry_image_name`, `docker_registry_image_tag`
**Container:** `custom_labels`, `custom_docker_run_options`, `custom_nginx_configuration`
**Pre/Post Commands:** `pre_deployment_command`, `pre_deployment_command_container`, `post_deployment_command`, `post_deployment_command_container`
**Webhooks:** `manual_webhook_secret_github`, `manual_webhook_secret_gitlab`, `manual_webhook_secret_bitbucket`, `manual_webhook_secret_gitea`

#### Scenario: Update application domains

- **WHEN** a caller updates an application with `domains: "https://app.example.com,https://www.app.example.com"`
- **THEN** the client includes `domains` in the PATCH request body

#### Scenario: Enable static app mode

- **WHEN** a caller updates an application with `is_static: true, is_spa: true, static_image: "nginx:alpine"`
- **THEN** all three fields are included in the PATCH request body

#### Scenario: Set deployment commands

- **WHEN** a caller updates with `pre_deployment_command: "php artisan migrate"` and `post_deployment_command: "php artisan cache:clear"`
- **THEN** both command fields are included in the PATCH request body

### Requirement: Generated application update operation exposes high-impact fields

The generated `coolify_update_application_by_uuid` operation SHALL expose Tier 1 and selected Tier 2 fields in its generated Zod schema: `domains`, `is_static`, `is_spa`, `static_image`, `is_auto_deploy_enabled`, `is_force_https_enabled`, `docker_registry_image_name`, `docker_registry_image_tag`, `redirect`, `custom_labels`, `custom_docker_run_options`, `pre_deployment_command`, `post_deployment_command`, `watch_paths`.

#### Scenario: MCP update application domains

- **WHEN** `coolify_update_application_by_uuid` is called with `uuid` and a body containing `domains: "https://app.example.com"`
- **THEN** the domains field is passed to `updateApplication` client method
