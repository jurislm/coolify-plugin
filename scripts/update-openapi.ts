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
schemas.ApplicationDeploymentQueue.properties.application_id.type = "string";
schemas.ApplicationDeploymentQueue.properties.git_type.nullable = true;
schemas.Environment.properties.description.nullable = true;
Object.assign(schemas.ApplicationDeploymentQueue.properties, { build_server_id: { type: "integer", nullable: true }, horizon_job_id: { type: "string", nullable: true }, horizon_job_worker: { type: "string", nullable: true }, finished_at: { type: "string", nullable: true } });
const databaseUpdate = paths["/databases/{uuid}"].patch.requestBody.content["application/json"].schema.properties;
databaseUpdate.custom_docker_run_options = { type: "string", description: "Docker run options for the database container." };
for (const value of Object.values(databaseUpdate) as Array<Record<string, unknown>>) delete value.default;
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
  ],
}, null, 2)}\n`);

console.error(`Fetched ${operationCount} Coolify OpenAPI operations`);
