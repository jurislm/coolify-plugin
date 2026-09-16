> Current contract: use the generated `coolify_*` operations in `src/generated/operations.ts` and explicit wrappers registered with `registerTool` in `src/server.ts`; older action-oriented examples in this artifact are superseded. Executable checks live in Bun tests.

## MODIFIED Requirements

### Requirement: API client must normalize known Coolify field-compatibility differences

The client MUST transform caller-facing inputs into the field names and payload formats expected by Coolify API variants where known compatibility gaps exist.

#### Scenario: Domain field compatibility

- **WHEN** a caller provides application domain data using fqdn
- **THEN** the client maps input to Coolify-compatible domains payload fields before sending the request

#### Scenario: Docker compose payload compatibility

- **WHEN** a caller provides docker_compose_raw as plain text content
- **THEN** the client encodes content to base64 prior to API submission

#### Scenario: Env var runtime/buildtime field compatibility

- **WHEN** a caller provides `is_runtime` or `is_buildtime` fields on environment variable requests
- **THEN** the client passes these fields directly to the Coolify API (Coolify uses `is_runtime`/`is_buildtime` naming)

## ADDED Requirements

### Requirement: CreateServiceRequest supports URL and label configuration

The `CreateServiceRequest` type SHALL include optional fields: `urls` (array of `{name: string, url: string}`), `force_domain_override` (boolean), and `is_container_label_escape_enabled` (boolean).

#### Scenario: Create service with URLs

- **WHEN** a caller creates a service with `urls: [{name: "web", url: "https://example.com"}]`
- **THEN** the client includes the `urls` array in the POST request body

#### Scenario: Create service with label escape disabled

- **WHEN** a caller creates a service with `is_container_label_escape_enabled: false`
- **THEN** the client includes the field in the POST request body

### Requirement: UpdateServiceRequest supports expanded fields

The `UpdateServiceRequest` type SHALL include optional fields: `urls`, `force_domain_override`, `is_container_label_escape_enabled`, and `connect_to_docker_network`, in addition to existing `name`, `description`, and `docker_compose_raw`.

#### Scenario: Update service URLs

- **WHEN** a caller updates a service with `urls: [{name: "api", url: "https://api.example.com"}]`
- **THEN** the client includes `urls` in the PATCH request body

#### Scenario: Update service docker network connection

- **WHEN** a caller updates a service with `connect_to_docker_network: true`
- **THEN** the client includes the field in the PATCH request body

#### Scenario: Update service force domain override

- **WHEN** a caller updates a service with `force_domain_override: true`
- **THEN** the client includes the field in the PATCH request body
