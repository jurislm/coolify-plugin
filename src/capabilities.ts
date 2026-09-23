import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { CoolifyClient, redactSensitive } from "./client.js";
import { operations } from "./generated/operations.js";
import { pluginVersion } from "./version.js";

const outputSchema = z.object({ data: z.unknown(), status: z.number(), request: z.object({ method: z.string(), path: z.string() }) });
const databaseTypes = ["dragonfly", "keydb", "clickhouse"] as const;
const truncationPrefix = "...[truncated]...\n";
type RecordValue = Record<string, unknown>;

function rows(value: unknown): RecordValue[] {
  if (Array.isArray(value)) return value.filter((item): item is RecordValue => !!item && typeof item === "object");
  return [];
}

function status(value: RecordValue): string { return typeof value.status === "string" ? value.status : ""; }
function running(value: RecordValue): boolean { return /(^|:)running($|:)/iu.test(status(value)); }
function unhealthy(value: RecordValue): boolean { return /exited|unhealthy|error|stopped/iu.test(status(value)); }
function errorMessage(value: unknown): string { return value instanceof Error ? value.message : String(value); }
function truncateLogs(logs: string, lineLimit = 200, charLimit = 50_000): string {
  if (logs.split("\n").length <= lineLimit && logs.length <= charLimit) return logs;
  let result = logs.split("\n").slice(-lineLimit).join("\n");
  if (result.length > charLimit) result = truncationPrefix + result.slice(-(charLimit - truncationPrefix.length));
  else result = truncationPrefix + result;
  return result;
}
function environmentSummary(value: unknown): RecordValue[] {
  return rows(value).map((item) => ({ key: item.key, is_build_time: item.is_buildtime === true }));
}

export function registerCapabilities(server: McpServer, client: CoolifyClient): void {
  const call = async (name: string, input: RecordValue = {}): Promise<unknown> => {
    const operation = operations.find((item) => item.name === name);
    if (!operation) throw new Error(`Missing generated operation: ${name}`);
    const data = (await client.request(operation, operation.inputSchema.parse(input) as RecordValue)).data;
    return operation.responseSchema.parse(data);
  };
  const result = (name: string, data: unknown) => {
    const structuredContent = redactSensitive({ data, status: 200, request: { method: "COMPOSITE", path: `/capabilities/${name}` } });
    return { structuredContent, content: [{ type: "text" as const, text: JSON.stringify(structuredContent) }] };
  };
  const register = (name: string, description: string, inputSchema: z.ZodType, annotations: { readOnlyHint: boolean; destructiveHint: boolean; idempotentHint: boolean; openWorldHint: boolean }, handler: (input: RecordValue) => Promise<unknown>) => {
    server.registerTool(name, { title: name, description, inputSchema, outputSchema, annotations }, async (input) => result(name, await handler(input as RecordValue)));
  };
  const settledRows = async (names: string[]): Promise<{ values: RecordValue[][]; errors: string[] }> => {
    const settled = await Promise.allSettled(names.map((name) => call(`coolify_list_${name}`)));
    const values: RecordValue[][] = [];
    const errors: string[] = [];
    settled.forEach((entry, index) => {
      if (entry.status === "fulfilled") values[index] = rows(entry.value);
      else { values[index] = []; errors.push(`${names[index]}: ${errorMessage(entry.reason)}`); }
    });
    return { values, errors };
  };
  const overview = async () => {
    const names = ["servers", "projects", "applications", "databases", "services"];
    const { values, errors } = await settledRows(names);
    const data = Object.fromEntries(names.map((name, index) => [name, values[index]]));
    return { summary: Object.fromEntries(names.map((name, index) => [name, values[index].length])), ...data, ...(errors.length ? { errors } : {}) };
  };
  const batch = async (resources: RecordValue[], action: (resource: RecordValue) => Promise<unknown>) => {
    const settled = await Promise.allSettled(resources.map(action));
    const succeeded: RecordValue[] = [];
    const failed: RecordValue[] = [];
    settled.forEach((entry, index) => {
      const resource = resources[index];
      const item = { uuid: resource.uuid, name: resource.name ?? resource.uuid };
      if (entry.status === "fulfilled") succeeded.push(item);
      else failed.push({ ...item, error: errorMessage(entry.reason) });
    });
    return { summary: { total: resources.length, succeeded: succeeded.length, failed: failed.length }, succeeded, failed };
  };
  const application = async (query: string) => {
    const apps = rows(await call("coolify_list_applications"));
    return apps.find((app) => [app.uuid, app.name, app.fqdn].some((value) => typeof value === "string" && value.toLowerCase().includes(query.toLowerCase())));
  };
  const serverByQuery = async (query: string) => {
    const servers = rows(await call("coolify_list_servers"));
    return servers.find((item) => [item.uuid, item.name, item.ip].some((value) => typeof value === "string" && value.toLowerCase().includes(query.toLowerCase())));
  };
  const projectApplications = async (projectUuid: string) => {
    const [apps, environments] = await Promise.all([
      call("coolify_list_applications"),
      call("coolify_get_environments", { uuid: projectUuid }),
    ]);
    const environmentIds = new Set(rows(environments).map((environment) => environment.id));
    return rows(apps).filter((app) => environmentIds.has(app.environment_id));
  };

  register("coolify_get_mcp_version", "Get the local Coolify plugin version.", z.object({}), { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }, async () => ({ name: "@jurislm/coolify-plugin", version: pluginVersion }));
  register("coolify_get_infrastructure_overview", "Summarize Coolify infrastructure.", z.object({}), { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }, overview);
  register("coolify_diagnose_application", "Diagnose an application by UUID, name, or domain.", z.object({ query: z.string() }), { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }, async ({ query }) => {
    let app: RecordValue | undefined;
    try { app = await application(String(query)); } catch (error) { return { application: null, health: { status: "unknown", issues: [] }, logs: null, environment_variables: { count: 0, variables: [] }, recent_deployments: [], errors: [errorMessage(error)] }; }
    if (!app?.uuid) return { application: null, health: { status: "unknown", issues: [] }, logs: null, environment_variables: { count: 0, variables: [] }, recent_deployments: [], errors: [`No application found matching ${query}`] };
    const names = ["application", "logs", "environment_variables", "deployments"];
    const settled = await Promise.allSettled([
      call("coolify_get_application_by_uuid", { uuid: app.uuid }), running(app) ? call("coolify_get_application_logs_by_uuid", { uuid: app.uuid, lines: 50 }) : Promise.resolve(null), call("coolify_list_envs_by_application_uuid", { uuid: app.uuid }), call("coolify_list_deployments_by_app_uuid", { uuid: app.uuid }),
    ]);
    const errors: string[] = [];
    const value = (index: number): unknown => { const entry = settled[index]; if (entry.status === "fulfilled") return entry.value; errors.push(`${names[index]}: ${errorMessage(entry.reason)}`); return null; };
    const details = value(0) as RecordValue | null;
    const rawLogs = value(1);
    const envVars = environmentSummary(value(2));
    const deploymentCollection = value(3) as RecordValue | null;
    const deployments = rows(deploymentCollection?.deployments);
    const appInfo = details ?? app;
    const appStatus = status(appInfo);
    const issues: string[] = [];
    let health = "unknown";
    if (/exited|unhealthy|error/iu.test(appStatus)) { health = "unhealthy"; issues.push(`Status: ${appStatus}`); }
    else if (/running/iu.test(appStatus)) health = "healthy";
    const failed = deployments.slice(0, 5).filter((item) => item.status === "failed").length;
    if (failed) { health = "unhealthy"; issues.push(`${failed} failed deployment(s) in last 5`); }
    const logs = rawLogs && typeof rawLogs === "object" && typeof (rawLogs as RecordValue).logs === "string" ? (rawLogs as RecordValue).logs as string : null;
    return { application: { uuid: appInfo.uuid, name: appInfo.name, status: appStatus || "unknown", fqdn: appInfo.fqdn ?? null, git_repository: appInfo.git_repository ?? null, git_branch: appInfo.git_branch ?? null }, health: { status: health, issues }, logs: logs === null ? null : truncateLogs(logs), environment_variables: { count: envVars.length, variables: envVars }, recent_deployments: deployments.slice(0, 5).map((item) => ({ uuid: item.deployment_uuid, status: item.status, created_at: item.created_at })), ...(errors.length ? { errors } : {}) };
  });
  register("coolify_diagnose_server", "Diagnose a server by UUID, name, or IP.", z.object({ query: z.string() }), { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }, async ({ query }) => {
    let found: RecordValue | undefined;
    try { found = await serverByQuery(String(query)); } catch (error) { return { server: null, health: { status: "unknown", issues: [] }, resources: [], domains: [], errors: [errorMessage(error)] }; }
    if (!found?.uuid) return { server: null, health: { status: "unknown", issues: [] }, resources: [], domains: [], errors: [`No server found matching ${query}`] };
    const names = ["server", "resources", "domains"];
    const settled = await Promise.allSettled([
      call("coolify_get_server_by_uuid", { uuid: found.uuid }), call("coolify_get_resources_by_server_uuid", { uuid: found.uuid }), call("coolify_get_domains_by_server_uuid", { uuid: found.uuid }),
    ]);
    const errors: string[] = [];
    const value = (index: number): unknown => { const entry = settled[index]; if (entry.status === "fulfilled") return entry.value; errors.push(`${names[index]}: ${errorMessage(entry.reason)}`); return null; };
    const details = (value(0) as RecordValue | null) ?? found;
    const resources = rows(value(1));
    const issues: string[] = [];
    if (details.is_reachable === false) issues.push("Server is not reachable");
    if (details.is_usable === false) issues.push("Server is not usable");
    const unhealthyResources = resources.filter(unhealthy).length;
    if (unhealthyResources) issues.push(`${unhealthyResources} unhealthy resource(s)`);
    return { server: { uuid: details.uuid, name: details.name, ip: details.ip, status: details.status ?? null, is_reachable: details.is_reachable ?? null }, health: { status: issues.length ? "unhealthy" : details.is_reachable === true ? "healthy" : "unknown", issues }, resources: resources.map((item) => ({ uuid: item.uuid, name: item.name, type: item.type, status: item.status })), domains: rows(value(2)), ...(errors.length ? { errors } : {}) };
  });
  register("coolify_find_issues", "Find unhealthy Coolify infrastructure.", z.object({}), { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }, async () => {
    const names = ["servers", "applications", "databases", "services"];
    const { values, errors } = await settledRows(names);
    const issues: RecordValue[] = [];
    values[0].forEach((item) => { if (item.is_reachable === false || item.is_usable === false) issues.push({ type: "server", uuid: item.uuid, name: item.name, issue: item.is_reachable === false ? "Server is not reachable" : "Server is not usable", status: status(item) || "unreachable" }); });
    values.slice(1).forEach((items, index) => items.filter(unhealthy).forEach((item) => issues.push({ type: names[index + 1].slice(0, -1), uuid: item.uuid, name: item.name, issue: `${names[index + 1].slice(0, -1)} status: ${status(item)}`, status: status(item) })));
    return { summary: { total_issues: issues.length, unhealthy_applications: issues.filter((item) => item.type === "application").length, unhealthy_databases: issues.filter((item) => item.type === "database").length, unhealthy_services: issues.filter((item) => item.type === "service").length, unreachable_servers: issues.filter((item) => item.type === "server").length }, issues, ...(errors.length ? { errors } : {}) };
  });
  register("coolify_restart_project_applications", "Restart every application in a project.", z.object({ project_uuid: z.string() }), { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false }, async ({ project_uuid }) => batch(await projectApplications(String(project_uuid)), (app) => call("coolify_restart_application_by_uuid", { uuid: app.uuid })));
  register("coolify_bulk_update_application_env", "Update an environment variable across applications.", z.object({ app_uuids: z.array(z.string()), key: z.string(), value: z.string() }).strict(), { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false }, async ({ app_uuids, key, value }) => {
    if (!(app_uuids as string[]).length) return batch([], async () => undefined);
    const names = rows(await call("coolify_list_applications"));
    const labels = new Map(names.map((item) => [item.uuid, item.name ?? item.uuid]));
    return batch((app_uuids as string[]).map((uuid) => ({ uuid, name: labels.get(uuid) ?? uuid })), (app) => call("coolify_update_env_by_application_uuid", { uuid: app.uuid, body: { key, value } }));
  });
  register("coolify_stop_all_applications", "Emergency stop every running application.", z.object({ confirm_stop_all_applications: z.literal(true) }), { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false }, async () => batch(rows(await call("coolify_list_applications")).filter(running), (app) => call("coolify_stop_application_by_uuid", { uuid: app.uuid })));
  register("coolify_redeploy_project_applications", "Redeploy every application in a project.", z.object({ project_uuid: z.string(), force: z.boolean().optional() }), { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false }, async ({ project_uuid, force }) => batch(await projectApplications(String(project_uuid)), (app) => call("coolify_deploy_by_tag_or_uuid", { uuid: app.uuid, force: force ?? true })));
  register("coolify_get_environment", "Get an environment and its relevant database types.", z.object({ project_uuid: z.string(), environment_name_or_uuid: z.string() }), { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }, async ({ project_uuid, environment_name_or_uuid }) => {
    const settled = await Promise.allSettled([call("coolify_get_environment_by_name_or_uuid", { uuid: project_uuid, environment_name_or_uuid }), call("coolify_list_databases")]);
    const errors: string[] = [];
    const environment = settled[0].status === "fulfilled" ? settled[0].value as RecordValue : (errors.push(`environment: ${errorMessage(settled[0].reason)}`), null);
    const databases = settled[1].status === "fulfilled" ? rows(settled[1].value) : (errors.push(`databases: ${errorMessage(settled[1].reason)}`), []);
    if (!environment) return { environment: null, missing_database_types: [...databaseTypes], ...(errors.length ? { errors } : {}) };
    const matching = databases.filter((database) => environment.id !== undefined && database.environment_id === environment.id);
    const byType = new Map<string, RecordValue[]>();
    matching.forEach((database) => { const type = String(database.database_type ?? "").toLowerCase(); for (const expected of databaseTypes) if (type.includes(expected)) byType.set(expected, [...(byType.get(expected) ?? []), database]); });
    const missing = databaseTypes.filter((type) => !byType.has(type));
    return { ...environment, ...Object.fromEntries(databaseTypes.filter((type) => byType.has(type)).map((type) => [`${type}s`, byType.get(type)])), missing_database_types: missing, ...(errors.length ? { errors } : {}) };
  });
  register("coolify_docker_network_alias", "Generate Docker network alias remediation commands.", z.object({ server_uuid: z.string().regex(/^[a-zA-Z0-9-]{1,64}$/u), db_uuid: z.string().regex(/^[a-zA-Z0-9-]{1,64}$/u), name: z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,62}$/u), network: z.string().optional() }), { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }, async ({ server_uuid, db_uuid, name, network = "coolify" }) => {
    const server = await call("coolify_get_server_by_uuid", { uuid: server_uuid }).catch(() => null) as RecordValue | null;
    const quote = (value: string) => `'${value.replace(/'/gu, "'\\''")}'`;
    return { bug: "Coolify database containers may require a friendly Docker network alias.", warning: "The alias is lost after a rebuild or redeploy.", ...(server ? { server: { ip: server.ip, user: server.user, port: server.port } } : { server_lookup_failed: "Could not retrieve server details" }), commands: { ssh_connect: server ? `ssh -p ${server.port} ${server.user}@${server.ip}` : "ssh -p <port> <user>@<server-ip>", add_alias: [`docker network disconnect ${quote(String(network))} ${quote(String(db_uuid))}`, `docker network connect ${quote(String(network))} ${quote(String(db_uuid))} --alias ${quote(String(name))} --alias ${quote(String(db_uuid))}`], verify: `docker exec <any-app-container> getent hosts ${quote(String(name))}` }, next_actions: [{ tool: "coolify_get_database_by_uuid", args: { uuid: db_uuid }, hint: "Check database status" }] };
  });
}
