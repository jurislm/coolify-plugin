import { mkdir } from "node:fs/promises";

const sourceUrl = "https://raw.githubusercontent.com/coollabsio/coolify/v4.3.23/openapi.json";
const specPath = "openapi/coolify-openapi.json";
const manifestPath = "api/manifest.json";
const methods = new Set(["get", "put", "post", "delete", "patch", "head", "options", "trace"]);

const response = await fetch(sourceUrl);
if (!response.ok) throw new Error(`OpenAPI download failed: ${response.status} ${response.statusText}`);
const text = await response.text();
const upstream = text.endsWith("\n") ? text : `${text}\n`;
const spec = Bun.YAML.parse(upstream) as { openapi?: string; info?: { version?: string }; paths: Record<string, any>; components: { schemas: Record<string, any> } };
const paths = spec.paths;
const schemas = spec.components.schemas;
for (const path of ["/applications/public", "/applications/private-github-app", "/applications/private-deploy-key", "/applications/dockerfile", "/applications/dockerimage", "/databases/postgresql", "/databases/clickhouse", "/databases/dragonfly", "/databases/redis", "/databases/keydb", "/databases/mariadb", "/databases/mysql", "/databases/mongodb", "/services"]) {
  const body = paths[path].post.requestBody.content["application/json"].schema;
  body.required = body.required.filter((key: string) => key !== "environment_name" && key !== "environment_uuid");
  body["x-require-any"] = ["environment_name", "environment_uuid"];
}
const genericObject = { type: "object", additionalProperties: true };
const jsonResponseOperations: Array<[string, string, string]> = [
  ["/applications/{uuid}/migrate", "post", "200"], ["/applications/{uuid}/destinations", "post", "201"],
  ["/applications/{uuid}/destinations/{destination_uuid}", "delete", "200"], ["/cloud-init-scripts/{uuid}", "patch", "200"],
  ["/databases/{uuid}/migrate", "post", "200"], ["/notifications/email", "patch", "200"],
  ["/notifications/discord", "patch", "200"], ["/notifications/slack", "patch", "200"],
  ["/notifications/telegram", "patch", "200"], ["/notifications/pushover", "patch", "200"],
  ["/notifications/webhook", "patch", "200"], ["/applications/{uuid}/scheduled-tasks/{task_uuid}/execute", "post", "200"],
  ["/services/{uuid}/scheduled-tasks/{task_uuid}/execute", "post", "200"], ["/servers/{uuid}/cloudflare-tunnel", "patch", "200"],
  ["/servers/{uuid}/cloudflare-tunnel/enable", "post", "200"], ["/servers/{uuid}/cloudflare-tunnel/disable", "post", "200"],
  ["/servers/{uuid}/log-drains", "patch", "200"], ["/servers/{uuid}/sentinel", "patch", "200"],
  ["/servers/{uuid}/migrate", "post", "200"], ["/servers/{uuid}/export", "get", "200"],
  ["/servers/import", "post", "200"], ["/servers/import", "post", "201"], ["/servers/{uuid}/claim", "post", "200"],
  ["/servers/{uuid}/transfer/complete", "post", "200"], ["/servers/{uuid}/export/mailbox", "post", "200"],
  ["/services/{uuid}/migrate", "post", "200"], ["/applications/{uuid}/storages/{storage_uuid}/backups", "delete", "200"],
  ["/databases/{uuid}/storages/{storage_uuid}/backups", "delete", "200"], ["/services/{uuid}/storages/{storage_uuid}/backups", "delete", "200"],
  ["/applications/{uuid}/storages/{storage_uuid}/backups/run", "post", "200"],
  ["/databases/{uuid}/storages/{storage_uuid}/backups/run", "post", "200"],
  ["/services/{uuid}/storages/{storage_uuid}/backups/run", "post", "200"],
];
for (const [path, method, status] of jsonResponseOperations) {
  paths[path][method].responses[status].content = { "application/json": { schema: genericObject } };
}
paths["/servers/{uuid}/export"].get.responses["422"] = { $ref: "#/components/responses/422" };
for (const [path, method] of [
  ["/servers/{uuid}/migrate", "post"], ["/servers/{uuid}/export", "get"], ["/servers/import", "post"],
  ["/servers/{uuid}/claim", "post"], ["/servers/{uuid}/transfer/complete", "post"], ["/servers/{uuid}/export/mailbox", "post"],
]) {
  const operation = paths[path][method];
  operation.summary += " (APP_ENV=local only in v4.3.23)";
  operation.description += " This controller returns 404 unless APP_ENV is local.";
}
paths["/servers/{uuid}/validate"].post["x-destructive-hint"] = true;
const providerListPaths = [
  "/digitalocean/regions", "/digitalocean/sizes", "/digitalocean/images", "/digitalocean/ssh-keys",
  "/hetzner/locations", "/hetzner/server-types", "/hetzner/images", "/hetzner/ssh-keys", "/hetzner/firewalls", "/hetzner/networks",
  "/vultr/regions", "/vultr/plans", "/vultr/os", "/vultr/ssh-keys",
];
const validationResponse = { $ref: "#/components/responses/422" };
const providerFailureResponse = { description: "The cloud provider request failed.", content: { "application/json": { schema: { type: "object", required: ["message"], properties: { message: { type: "string" } }, additionalProperties: true } } } };
for (const path of providerListPaths) {
  const operation = paths[path].get;
  operation["x-require-any-query"] = ["cloud_provider_token_uuid", "cloud_provider_token_id"];
  for (const parameter of operation.parameters ?? []) {
    if (["cloud_provider_token_uuid", "cloud_provider_token_id"].includes(parameter.name)) Object.assign(parameter.schema, { minLength: 1, pattern: "\\S" });
  }
  operation.responses["200"].content = { "application/json": { schema: { type: "array", items: genericObject } } };
  operation.responses["422"] = validationResponse;
  operation.responses["500"] = providerFailureResponse;
  if (path.startsWith("/digitalocean/")) operation.responses["404"] = { $ref: "#/components/responses/404" };
}
const vultrTokenParameters = [
  { name: "cloud_provider_token_uuid", in: "query", required: false, description: "Cloud provider token UUID. Required if cloud_provider_token_id is not provided.", schema: { type: "string", minLength: 1, pattern: "\\S" } },
  { name: "cloud_provider_token_id", in: "query", required: false, deprecated: true, description: "Deprecated: Use cloud_provider_token_uuid instead. Cloud provider token UUID.", schema: { type: "string", minLength: 1, pattern: "\\S" } },
];
for (const path of ["/vultr/regions", "/vultr/plans", "/vultr/os", "/vultr/ssh-keys"]) {
  paths[path].get.parameters = vultrTokenParameters;
}
const providerTokenProperties = {
  cloud_provider_token_uuid: { type: "string", minLength: 1, pattern: "\\S", description: "Cloud provider token UUID. Required if cloud_provider_token_id is not provided." },
  cloud_provider_token_id: { type: "string", minLength: 1, pattern: "\\S", deprecated: true, description: "Deprecated: Use cloud_provider_token_uuid instead. Cloud provider token UUID." },
};
const hostname = { maxLength: 253, pattern: "^$|^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)*$" };
const digitalOceanServer = paths["/servers/digitalocean"].post;
digitalOceanServer.requestBody = { required: true, content: { "application/json": { schema: {
  type: "object",
  required: ["region", "size", "image", "private_key_uuid"],
  properties: {
    ...providerTokenProperties,
    region: { type: "string", minLength: 1 },
    size: { type: "string", minLength: 1 },
    image: { anyOf: [{ type: "string", minLength: 1 }, { type: "integer" }], description: "DigitalOcean image slug or ID." },
    name: { type: "string", nullable: true, ...hostname },
    private_key_uuid: { type: "string", minLength: 1 },
    enable_ipv6: { type: "boolean", nullable: true },
    monitoring: { type: "boolean", nullable: true },
    digitalocean_ssh_key_ids: { type: "array", items: { type: "integer" }, nullable: true },
    cloud_init_script: { type: "string", nullable: true, description: "Valid cloud-init YAML or a bash script beginning with #!." },
    instant_validate: { type: "boolean", nullable: true },
  },
  "x-require-any": ["cloud_provider_token_uuid", "cloud_provider_token_id"],
} } } };
const vultrServer = paths["/servers/vultr"].post;
vultrServer.requestBody = { required: true, content: { "application/json": { schema: {
  type: "object",
  required: ["region", "plan", "os_id", "private_key_uuid"],
  properties: {
    ...providerTokenProperties,
    region: { type: "string", minLength: 1 },
    plan: { type: "string", minLength: 1 },
    os_id: { type: "integer" },
    name: { type: "string", nullable: true, ...hostname },
    private_key_uuid: { type: "string", minLength: 1 },
    enable_ipv6: { type: "boolean", nullable: true },
    disable_public_ipv4: { type: "boolean", nullable: true },
    vultr_ssh_key_ids: { type: "array", items: { type: "string" }, nullable: true },
    cloud_init_script: { type: "string", nullable: true, description: "Valid cloud-init YAML or a bash script beginning with #!." },
    instant_validate: { type: "boolean", nullable: true },
  },
  "x-require-any": ["cloud_provider_token_uuid", "cloud_provider_token_id"],
  "x-invalid-combinations": [{ values: { disable_public_ipv4: true, enable_ipv6: false }, message: "Enable public IPv4 or IPv6." }],
} } } };
for (const path of ["/servers/digitalocean", "/servers/hetzner", "/servers/vultr"]) {
  const operation = paths[path].post;
  const bodySchema = operation.requestBody.content["application/json"].schema;
  bodySchema.properties.cloud_provider_token_uuid ??= providerTokenProperties.cloud_provider_token_uuid;
  bodySchema.properties.cloud_provider_token_id ??= providerTokenProperties.cloud_provider_token_id;
  for (const key of ["cloud_provider_token_uuid", "cloud_provider_token_id"]) Object.assign(bodySchema.properties[key], { minLength: 1, pattern: "\\S" });
  bodySchema["x-require-any"] = ["cloud_provider_token_uuid", "cloud_provider_token_id"];
  operation.responses["400"] ??= { $ref: "#/components/responses/400" };
  operation.responses["404"] ??= { $ref: "#/components/responses/404" };
  operation.responses["422"] = validationResponse;
  operation.responses["500"] = providerFailureResponse;
}
const hetznerBody = paths["/servers/hetzner"].post.requestBody.content["application/json"].schema;
for (const key of ["name", "enable_ipv4", "enable_ipv6", "enable_backups", "hetzner_ssh_key_ids", "hetzner_firewall_ids", "hetzner_network_ids", "cloud_init_script", "instant_validate"]) {
  hetznerBody.properties[key].nullable = true;
}
hetznerBody.properties.name = { ...hetznerBody.properties.name, ...hostname };
hetznerBody.properties.cloud_init_script.description = "Valid cloud-init YAML or a bash script beginning with #!.";
hetznerBody.properties.location.minLength = 1;
hetznerBody.properties.server_type.minLength = 1;
hetznerBody.properties.private_key_uuid.minLength = 1;
hetznerBody["x-invalid-combinations"] = [{ values: { enable_ipv4: false, enable_ipv6: false }, message: "Enable at least one public IP protocol." }];
const providerRateLimitResponse = {
  description: "The cloud provider rate limit was exceeded.",
  headers: { "Retry-After": { description: "Seconds to wait before retrying, when provided by the upstream provider.", required: false, schema: { type: "string" } } },
  content: { "application/json": { schema: { type: "object", required: ["message"], properties: { message: { type: "string" } }, additionalProperties: true } } },
};
for (const path of ["/servers/digitalocean", "/servers/hetzner", "/servers/vultr"]) paths[path].post.responses["429"] = providerRateLimitResponse;
digitalOceanServer.responses["201"].content = { "application/json": { schema: {
  type: "object", required: ["uuid", "digitalocean_droplet_id", "ip"], additionalProperties: true,
  properties: { uuid: { type: "string" }, digitalocean_droplet_id: { type: "integer" }, ip: { type: "string", nullable: true } },
} } };
vultrServer.responses["201"].content = { "application/json": { schema: {
  type: "object", required: ["uuid", "vultr_instance_id", "ip"], additionalProperties: true,
  properties: { uuid: { type: "string" }, vultr_instance_id: { type: "string" }, ip: { type: "string", nullable: true } },
} } };
Object.assign(paths["/servers/hetzner"].post.responses["201"].content["application/json"].schema, { required: ["uuid", "hetzner_server_id", "ip"] });
paths["/servers/hetzner"].post.responses["201"].content["application/json"].schema.properties.ip.nullable = true;
schemas.Application.properties.build_pack.enum.push("dockerimage");
paths["/cloud-init-scripts"].post.responses["201"].content = { "application/json": { schema: { type: "object", required: ["uuid"], properties: { uuid: { type: "string" }, name: { type: "string" }, script: { type: "string" } }, additionalProperties: true } } };
paths["/cloud-init-scripts/{uuid}"].get.responses["200"].content = paths["/cloud-init-scripts"].post.responses["201"].content;
paths["/cloud-init-scripts/{uuid}"].delete.responses["200"].content = { "application/json": { schema: { type: "object", required: ["message"], properties: { message: { type: "string" } } } } };
paths["/databases/{uuid}/clone"].post.responses["201"].content = { "application/json": { schema: { type: "object", required: ["uuid", "message"], properties: { uuid: { type: "string" }, message: { type: "string" } }, additionalProperties: true } } };
paths["/services/{uuid}/clone"].post.responses["201"].content = paths["/databases/{uuid}/clone"].post.responses["201"].content;
const messageResponse = { "application/json": { schema: { type: "object", required: ["message"], properties: { message: { type: "string" } } } } };
paths["/applications/{uuid}/tags/{tag_uuid}"].delete.responses["200"].content = messageResponse;
paths["/databases/{uuid}/tags/{tag_uuid}"].delete.responses["200"].content = messageResponse;
paths["/services/{uuid}/tags/{tag_uuid}"].delete.responses["200"].content = messageResponse;
paths["/databases/{uuid}/backups/{scheduled_backup_uuid}"].patch.responses["200"].content = messageResponse;
for (const path of ["/cloud-init-scripts", "/team/envs"]) paths[path].get.responses["200"].content = { "application/json": { schema: { type: "array", items: genericObject } } };
for (const path of ["/notifications/email", "/notifications/discord", "/notifications/slack", "/notifications/telegram", "/notifications/pushover", "/notifications/webhook"]) paths[path].get.responses["200"].content = { "application/json": { schema: genericObject } };
const githubAppFields = paths["/github-apps"].get.responses["200"].content["application/json"].schema.items.properties;
for (const key of ["app_id", "installation_id", "client_id"]) githubAppFields[key].nullable = true;
githubAppFields.private_key_id.type = "string";
schemas.PrivateKey.properties.description.nullable = true;
schemas.Team.properties.description.nullable = true;
for (const key of ["email_verified_at", "two_factor_confirmed_at"]) schemas.User.properties[key].nullable = true;
schemas.User.properties.force_password_reset.type = ["boolean", "string"];
paths["/databases"].get.responses["200"].content["application/json"].schema = { type: "array", items: { $ref: "#/components/schemas/DatabaseRecord" } };
paths["/resources"].get.responses["200"].content["application/json"].schema = { type: "array", items: { $ref: "#/components/schemas/ResourceRecord" } };
paths["/deployments/applications/{uuid}"].get.responses["200"].content["application/json"].schema = { $ref: "#/components/schemas/ApplicationDeploymentCollection" };
schemas.DatabaseRecord = { type: "object", required: ["uuid"], additionalProperties: true, properties: { uuid: { type: "string" }, name: { type: "string" }, database_type: { type: "string" }, environment_id: { type: "integer" }, status: { type: "string" } } };
schemas.ResourceRecord = { type: "object", required: ["uuid"], additionalProperties: true, properties: { uuid: { type: "string" }, name: { type: "string" }, type: { type: "string" }, status: { type: "string" } } };
schemas.ApplicationDeploymentCollection = { type: "object", required: ["count", "deployments"], properties: { count: { type: "integer" }, deployments: { type: "array", items: { $ref: "#/components/schemas/ApplicationDeploymentQueue" } } } };
for (const key of ["install_command", "build_command", "start_command", "publish_directory", "dockerfile_location"]) schemas.Application.properties[key].nullable = true;
schemas.Application.properties.private_key_id.type = "string";
for (const key of ["logdrain_axiom_api_key", "logdrain_axiom_dataset_name", "logdrain_custom_config", "logdrain_custom_config_parser", "logdrain_highlight_project_id", "logdrain_newrelic_base_uri", "logdrain_newrelic_license_key", "wildcard_domain"]) schemas.ServerSetting.properties[key].nullable = true;
for (const key of ["validation_logs", "swarm_cluster"]) schemas.Server.properties[key].nullable = true;
for (const key of ["service_type", "deleted_at"]) schemas.Service.properties[key].nullable = true;
schemas.Service.properties.config_hash.nullable = true;
schemas.ApplicationSetting.properties.use_build_secrets.type = ["boolean", "string"];
paths["/applications/dockerfile"].post.requestBody.content["application/json"].schema.properties.dockerfile.description = "Plain Dockerfile content; the plugin encodes it for Coolify.";
for (const key of ["logdrain_newrelic_license_key", "logdrain_axiom_api_key", "logdrain_custom_config", "logdrain_custom_config_parser"]) {
  paths["/servers/{uuid}/log-drains"].get.responses["200"].content["application/json"].schema.properties[key].type = ["string", "null"];
}
for (const path of ["/applications/{uuid}/destinations", "/projects/{uuid}/envs", "/projects/{uuid}/environments/{environment_name_or_uuid}/envs", "/servers/{uuid}/envs"]) {
  paths[path].get.responses["200"].content = { "application/json": { schema: { type: "array", items: { type: "object", additionalProperties: true } } } };
}
const sharedEnvCreate = paths["/team/envs"].post.requestBody;
const sharedEnvUpdate = { required: true, content: { "application/json": { schema: { type: "object", additionalProperties: false, properties: sharedEnvCreate.content["application/json"].schema.properties } } } };
for (const path of ["/team/envs", "/projects/{uuid}/envs", "/projects/{uuid}/environments/{environment_name_or_uuid}/envs", "/servers/{uuid}/envs"]) {
  paths[path].post.requestBody = sharedEnvCreate;
  paths[path].post.responses["201"].content = { "application/json": { schema: { type: "object", required: ["id"], properties: { id: { type: "integer" } } } } };
}
for (const path of ["/team/envs/{env_id}", "/projects/{uuid}/envs/{env_id}", "/projects/{uuid}/environments/{environment_name_or_uuid}/envs/{env_id}", "/servers/{uuid}/envs/{env_id}"]) {
  paths[path].patch.requestBody = sharedEnvUpdate;
  paths[path].patch.responses["200"].content = { "application/json": { schema: { type: "object", additionalProperties: true } } };
  paths[path].delete.responses["200"].content = { "application/json": { schema: { type: "object", required: ["message"], properties: { message: { type: "string" } } } } };
}
schemas.ApplicationDeploymentQueue.properties.application_id.type = "string";
schemas.ApplicationDeploymentQueue.properties.git_type.nullable = true;
schemas.Environment.properties.description.nullable = true;
Object.assign(schemas.ApplicationDeploymentQueue.properties, { build_server_id: { type: "integer", nullable: true }, horizon_job_id: { type: "string", nullable: true }, horizon_job_worker: { type: "string", nullable: true }, finished_at: { type: "string", nullable: true } });
const databaseUpdate = paths["/databases/{uuid}"].patch.requestBody.content["application/json"].schema.properties;
databaseUpdate.custom_docker_run_options = { type: "string", description: "Docker run options for the database container." };
for (const value of Object.values(databaseUpdate) as Array<Record<string, unknown>>) delete value.default;
const databaseResponse = { type: "object", additionalProperties: true };
const databaseWriteResponse = { anyOf: [databaseResponse, { type: "null" }] };
for (const type of ["postgresql", "mysql", "mariadb", "mongodb", "redis", "clickhouse", "dragonfly", "keydb"]) {
  paths[`/databases/${type}`].post.responses["200"].content = { "application/json": { schema: databaseWriteResponse } };
}
paths["/databases/{uuid}"].get.responses["200"].content["application/json"].schema = databaseResponse;
paths["/databases/{uuid}"].patch.responses["200"].content = { "application/json": { schema: databaseWriteResponse } };
paths["/databases/{uuid}/backups"].get.responses["200"].content["application/json"].schema = { type: "array", items: databaseResponse };
Object.assign(schemas.Server.properties, { is_reachable: { type: "boolean" }, is_usable: { type: "boolean" } });
schemas.Service.properties.status = { type: "string" };
const persisted = `${JSON.stringify(spec, null, 4)}\n`;
const hash = new Bun.CryptoHasher("sha256");
hash.update(persisted);
const upstreamHash = new Bun.CryptoHasher("sha256");
upstreamHash.update(upstream);
const operationCount = Object.values(spec.paths ?? {}).reduce(
  (count, pathItem) => count + Object.keys(pathItem as Record<string, unknown>).filter((method) => methods.has(method)).length,
  0,
);

await mkdir("openapi", { recursive: true });
await mkdir("api", { recursive: true });
await Bun.write(specPath, persisted);
await Bun.write(manifestPath, `${JSON.stringify({
  sourceUrl,
  fetchedAt: new Date().toISOString(),
  sha256: hash.digest("hex"),
  upstreamSha256: upstreamHash.digest("hex"),
  openapiVersion: spec.openapi ?? "unknown",
  infoVersion: spec.info?.version ?? "unknown",
  pathCount: Object.keys(spec.paths ?? {}).length,
  operationCount,
  contractCorrections: [
    "List database and resource responses are arrays",
    "Application deployment history is a count plus deployments collection",
    "Resource field nullability and identifiers match the active API",
    "Database updates expose custom Docker run options",
    "Cloud provider list and create requests require a token and provider response shapes match the v4.3.23 controllers",
    "DigitalOcean and Vultr server creation contracts are restored from the v4.3.23 controllers where OpenAPI omits them",
    "Provider create inputs include non-empty identifiers, hostname constraints, nullable Hetzner defaults, and IP cross-field rules",
    "Provider server creation documents JSON rate-limit messages and optional Retry-After headers",
    "Successful JSON response bodies omitted by upstream OpenAPI match v4.3.23 controller behavior",
    "Server transfer endpoints expose their APP_ENV=local gate and transfer bundle JSON response",
    "Database PATCH omits unspecified health-check defaults",
    "Server reachability and service status are response fields",
    "Server metadata, deployment git type, and environment descriptions can be null",
    "Database responses and nullable service hash match live Coolify payloads",
    "Application settings, destination lists, shared environment variables, and log drain nulls match live responses",
    "Shared environment variable writes accept bodies and return live response shapes",
    "Plain Dockerfile input is encoded for the API",
    "Cloud-init, notifications, GitHub apps, private keys, and team metadata match live response shapes",
    "Resource creation accepts either environment name or UUID as documented",
    "Docker image build packs and cloud-init/resource clone responses match live Coolify payloads",
    "Application tag removal and database backup updates match live message responses",
  ],
}, null, 2)}\n`);

console.error(`Fetched ${operationCount} Coolify OpenAPI operations`);
