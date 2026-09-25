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
delete paths["/servers/{uuid}/validate"];
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
    "Unsupported server validation operation removed",
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
