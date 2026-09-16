import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { CoolifyClient, redactSensitive } from "./client.js";
import { operations } from "./generated/operations.js";

const outputSchema = z.object({ data: z.unknown(), status: z.number(), request: z.object({ method: z.string(), path: z.string() }) });
type RecordValue = Record<string, unknown>;

function rows(value: unknown): RecordValue[] { return Array.isArray(value) ? value.filter((item): item is RecordValue => !!item && typeof item === "object") : []; }
function status(value: RecordValue): string { return typeof value.status === "string" ? value.status : ""; }
function unhealthy(value: RecordValue): boolean { return /exited|unhealthy|error|stopped/iu.test(status(value)); }

export function registerV36Capabilities(server: McpServer, client: CoolifyClient): void {
  const call = async (name: string, input: RecordValue = {}): Promise<unknown> => {
    const operation = operations.find((item) => item.name === name);
    if (!operation) throw new Error(`Missing generated operation: ${name}`);
    return (await client.request(operation, operation.inputSchema.parse(input) as RecordValue)).data;
  };
  const result = (name: string, data: unknown) => {
    const structuredContent = redactSensitive({ data, status: 200, request: { method: "COMPOSITE", path: `/capabilities/${name}` } });
    return { structuredContent, content: [{ type: "text" as const, text: JSON.stringify(structuredContent) }] };
  };
  const register = (name: string, description: string, inputSchema: z.ZodType, annotations: { readOnlyHint: boolean; destructiveHint: boolean; idempotentHint: boolean; openWorldHint: boolean }, handler: (input: RecordValue) => Promise<unknown>) => {
    server.registerTool(name, { title: name, description, inputSchema, outputSchema, annotations }, async (input) => result(name, await handler(input as RecordValue)));
  };
  const overview = async () => {
    const names = ["servers", "projects", "applications", "databases", "services"] as const;
    const values = await Promise.all(names.map((name) => call(`coolify_list_${name}`)));
    const data = Object.fromEntries(names.map((name, index) => [name, rows(values[index])]));
    return { summary: Object.fromEntries(names.map((name) => [name, (data[name] as RecordValue[]).length])), ...data };
  };
  const batch = async (resources: RecordValue[], action: (resource: RecordValue) => Promise<unknown>) => {
    const settled = await Promise.allSettled(resources.map(action));
    const succeeded: RecordValue[] = [];
    const failed: RecordValue[] = [];
    settled.forEach((entry, index) => {
      const resource = resources[index];
      const item = { uuid: resource.uuid, name: resource.name ?? resource.uuid };
      if (entry.status === "fulfilled") succeeded.push(item);
      else failed.push({ ...item, error: entry.reason instanceof Error ? entry.reason.message : String(entry.reason) });
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

  register("coolify_get_mcp_version", "Get the local Coolify plugin version.", z.object({}), { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }, async () => ({ name: "@jurislm/coolify-plugin", version: "0.1.0" }));
  register("coolify_get_infrastructure_overview", "Summarize Coolify infrastructure.", z.object({}), { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }, overview);
  register("coolify_diagnose_application", "Diagnose an application by UUID, name, or domain.", z.object({ query: z.string() }), { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }, async ({ query }) => {
    const app = await application(String(query));
    if (!app?.uuid) return { application: null, health: { status: "unknown", issues: [`No application found matching ${query}`] }, logs: null, environment_variables: { count: 0, variables: [] }, recent_deployments: [] };
    const [details, logs, envs, deployments] = await Promise.allSettled([
      call("coolify_get_application_by_uuid", { uuid: app.uuid }), call("coolify_get_application_logs_by_uuid", { uuid: app.uuid, lines: 50 }), call("coolify_list_envs_by_application_uuid", { uuid: app.uuid }), call("coolify_list_deployments_by_app_uuid", { uuid: app.uuid }),
    ]);
    const appStatus = status(app);
    const recent = deployments.status === "fulfilled" ? rows(deployments.value).slice(0, 5) : [];
    const issues = [...(unhealthy(app) ? [`Status: ${appStatus}`] : []), ...(recent.some((item) => item.status === "failed") ? ["Failed recent deployment"] : [])];
    return { application: details.status === "fulfilled" ? details.value : app, health: { status: issues.length ? "unhealthy" : appStatus.includes("running") ? "healthy" : "unknown", issues }, logs: logs.status === "fulfilled" ? logs.value : null, environment_variables: { count: envs.status === "fulfilled" ? rows(envs.value).length : 0 }, recent_deployments: recent };
  });
  register("coolify_diagnose_server", "Diagnose a server by UUID, name, or IP.", z.object({ query: z.string() }), { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }, async ({ query }) => {
    const found = await serverByQuery(String(query));
    if (!found?.uuid) return { server: null, health: { status: "unknown", issues: [`No server found matching ${query}`] }, resources: [], domains: [], validation: null };
    const [details, resources, domains, validation] = await Promise.allSettled([
      call("coolify_get_server_by_uuid", { uuid: found.uuid }), call("coolify_get_resources_by_server_uuid", { uuid: found.uuid }), call("coolify_get_domains_by_server_uuid", { uuid: found.uuid }), call("coolify_validate_server_by_uuid", { uuid: found.uuid }),
    ]);
    const issues = found.is_reachable === false ? ["Server is not reachable"] : [];
    return { server: details.status === "fulfilled" ? details.value : found, health: { status: issues.length ? "unhealthy" : "healthy", issues }, resources: resources.status === "fulfilled" ? resources.value : [], domains: domains.status === "fulfilled" ? domains.value : [], validation: validation.status === "fulfilled" ? validation.value : null };
  });
  register("coolify_find_issues", "Find unhealthy Coolify infrastructure.", z.object({}), { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }, async () => {
    const data = await overview() as RecordValue;
    const issues = (["applications", "databases", "services"] as const).flatMap((type) => rows(data[type]).filter(unhealthy).map((item) => ({ type: type.slice(0, -1), uuid: item.uuid, name: item.name, status: status(item), issue: `${type.slice(0, -1)} status: ${status(item)}` }))).concat(rows(data.servers).filter((item) => item.is_reachable === false).map((item) => ({ type: "server", uuid: item.uuid, name: item.name, status: status(item) || "unreachable", issue: "Server is not reachable" })));
    return { summary: { total_issues: issues.length }, issues };
  });
  register("coolify_restart_project_applications", "Restart every application in a project.", z.object({ project_uuid: z.string() }), { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false }, async ({ project_uuid }) => batch(rows(await call("coolify_list_applications")).filter((app) => app.project_uuid === project_uuid), (app) => call("coolify_restart_application_by_uuid", { uuid: app.uuid })));
  register("coolify_bulk_update_application_env", "Update an environment variable across applications.", z.object({ app_uuids: z.array(z.string()), key: z.string(), value: z.string() }).strict(), { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false }, async ({ app_uuids, key, value }) => batch((app_uuids as string[]).map((uuid) => ({ uuid })), (app) => call("coolify_update_env_by_application_uuid", { uuid: app.uuid, body: { key, value } })));
  register("coolify_stop_all_applications", "Emergency stop every running application.", z.object({ confirm_stop_all_applications: z.literal(true) }), { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false }, async () => batch(rows(await call("coolify_list_applications")).filter((app) => /running|healthy/iu.test(status(app))), (app) => call("coolify_stop_application_by_uuid", { uuid: app.uuid })));
  register("coolify_redeploy_project_applications", "Redeploy every application in a project.", z.object({ project_uuid: z.string(), force: z.boolean().optional() }), { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false }, async ({ project_uuid, force }) => batch(rows(await call("coolify_list_applications")).filter((app) => app.project_uuid === project_uuid), (app) => call("coolify_deploy_by_tag_or_uuid", { uuid: app.uuid, force: force ?? true })));
  register("coolify_docker_network_alias", "Generate the v3.6 Docker network alias remediation commands.", z.object({ server_uuid: z.string().regex(/^[a-zA-Z0-9-]{1,64}$/u), db_uuid: z.string().regex(/^[a-zA-Z0-9-]{1,64}$/u), name: z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,62}$/u), network: z.string().optional() }), { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }, async ({ server_uuid, db_uuid, name, network = "coolify" }) => {
    const server = await call("coolify_get_server_by_uuid", { uuid: server_uuid }).catch(() => null) as RecordValue | null;
    const quote = (value: string) => `'${value.replace(/'/gu, "'\\''")}'`;
    return { bug: "Coolify database containers may require a friendly Docker network alias.", warning: "The alias is lost after a rebuild or redeploy.", ...(server ? { server: { ip: server.ip, user: server.user, port: server.port } } : { server_lookup_failed: "Could not retrieve server details" }), commands: { ssh_connect: server ? `ssh -p ${server.port} ${server.user}@${server.ip}` : "ssh -p <port> <user>@<server-ip>", add_alias: [`docker network disconnect ${quote(String(network))} ${quote(String(db_uuid))}`, `docker network connect ${quote(String(network))} ${quote(String(db_uuid))} --alias ${quote(String(name))} --alias ${quote(String(db_uuid))}`], verify: `docker exec <any-app-container> getent hosts ${quote(String(name))}` }, next_actions: [{ tool: "coolify_get_database_by_uuid", args: { uuid: db_uuid }, hint: "Check database status" }] };
  });
}
