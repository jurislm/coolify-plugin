import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { describe, expect, test } from "bun:test";
import type { CoolifyConfig } from "./config.js";
import { operations } from "./generated/operations.js";
import { createServer } from "./server.js";
import { pluginVersion } from "./version.js";

const config: CoolifyConfig = { baseUrl: "https://coolify.example/api/v1", token: "secret", timeoutMs: 30_000 };
const json = (value: unknown) => new Response(JSON.stringify(value), { headers: { "content-type": "application/json" } });

async function connected(fetchImpl: Parameters<typeof createServer>[1]) {
  const server = createServer(config, fetchImpl);
  const client = new Client({ name: "test", version: "0.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return { server, client };
}

describe("generated Coolify MCP server", () => {
  test("registers the authoritative generated contract with accurate metadata", async () => {
    const server = createServer(config, async () => new Response(JSON.stringify([]), { headers: { "content-type": "application/json" } }));
    const client = new Client({ name: "test", version: "0.0.0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    const result = await client.listTools();
    expect(result.tools).toHaveLength(operations.length + 11);
    expect(result.tools.every((tool) => tool.name.startsWith("coolify_"))).toBe(true);
    const deleteTool = result.tools.find((tool) => tool.name === "coolify_delete_application_by_uuid");
    expect(deleteTool?.annotations?.destructiveHint).toBe(true);
    expect(deleteTool?.annotations?.readOnlyHint).toBe(false);
    const validateTool = result.tools.find((tool) => tool.name === "coolify_validate_server_by_uuid");
    expect(validateTool).toBeDefined();
    expect(validateTool?.annotations?.destructiveHint).toBe(true);
    expect(validateTool?.annotations?.readOnlyHint).toBe(false);
    await client.close();
    await server.close();
  });

  test("returns ToolEnvelope structured content", async () => {
    const server = createServer(config, async () => new Response(JSON.stringify([{ uuid: "app" }]), { headers: { "content-type": "application/json" } }));
    const client = new Client({ name: "test", version: "0.0.0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    const result = await client.callTool({ name: "coolify_list_applications", arguments: {} });
    expect(result.isError).not.toBe(true);
    expect(result.structuredContent).toEqual({
      data: [{ uuid: "app" }], status: 200, request: { method: "GET", path: "/applications" },
    });
    await client.close();
    await server.close();
  });

  test("accepts application nulls and string private-key IDs in list and detail responses", async () => {
    const app = { uuid: "app", install_command: null, build_command: null, start_command: null, ports_exposes: null, publish_directory: null, private_key_id: "key-uuid", dockerfile_location: null };
    const { server, client } = await connected(async (url) => json(new URL(String(url)).pathname === "/api/v1/applications" ? [app] : app));
    const list = await client.callTool({ name: "coolify_list_applications", arguments: {} });
    const detail = await client.callTool({ name: "coolify_get_application_by_uuid", arguments: { uuid: "app" } });
    expect(list.isError).not.toBe(true);
    expect(detail.isError).not.toBe(true);
    expect(list.structuredContent).toMatchObject({ data: [{ install_command: null, ports_exposes: null, private_key_id: "[REDACTED]" }] });
    expect(detail.structuredContent).toMatchObject({ data: { install_command: null, ports_exposes: null, private_key_id: "[REDACTED]" } });
    await client.close();
    await server.close();
  });

  test("accepts nullable server settings and omitted server fields in list and detail responses", async () => {
    const serverData = { uuid: "server", validation_logs: null, swarm_cluster: null, settings: { logdrain_axiom_api_key: null, logdrain_axiom_dataset_name: null, logdrain_custom_config: null, logdrain_custom_config_parser: null, logdrain_highlight_project_id: null, logdrain_newrelic_base_uri: null, logdrain_newrelic_license_key: null, wildcard_domain: null } };
    const { server, client } = await connected(async (url) => json(new URL(String(url)).pathname === "/api/v1/servers" ? [serverData] : serverData));
    const list = await client.callTool({ name: "coolify_list_servers", arguments: {} });
    const detail = await client.callTool({ name: "coolify_get_server_by_uuid", arguments: { uuid: "server" } });
    expect(list.isError).not.toBe(true);
    expect(detail.isError).not.toBe(true);
    await client.close();
    await server.close();
  });

  test("accepts nullable service fields in list and detail responses", async () => {
    const service = { uuid: "service", service_type: null, deleted_at: null, config_hash: null };
    const { server, client } = await connected(async (url) => json(new URL(String(url)).pathname === "/api/v1/services" ? [service] : service));
    const list = await client.callTool({ name: "coolify_list_services", arguments: {} });
    const detail = await client.callTool({ name: "coolify_get_service_by_uuid", arguments: { uuid: "service" } });
    expect(list.isError).not.toBe(true);
    expect(detail.isError).not.toBe(true);
    expect(detail.structuredContent).toMatchObject({ data: { config_hash: null } });
    await client.close();
    await server.close();
  });

  test("registers the current composite capabilities", async () => {
    const server = createServer(config, async (url) => {
      const path = new URL(String(url)).pathname;
      const body = path.endsWith("/servers") ? [{ uuid: "server", status: "running" }]
        : path.endsWith("/projects") ? [{ uuid: "project" }]
        : path.endsWith("/applications") ? [{ uuid: "app", project_uuid: "project", status: "running" }]
        : path.endsWith("/databases") || path.endsWith("/services") ? [] : { uuid: "app" };
      return new Response(JSON.stringify(body), { headers: { "content-type": "application/json" } });
    });
    const client = new Client({ name: "test", version: "0.0.0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    const tools = await client.listTools();
    for (const name of [
      "coolify_get_mcp_version", "coolify_get_infrastructure_overview", "coolify_diagnose_application", "coolify_diagnose_server", "coolify_find_issues",
      "coolify_restart_project_applications", "coolify_bulk_update_application_env", "coolify_stop_all_applications",
      "coolify_redeploy_project_applications", "coolify_docker_network_alias",
    ]) expect(tools.tools.some((tool) => tool.name === name)).toBe(true);
    const overview = await client.callTool({ name: "coolify_get_infrastructure_overview", arguments: {} });
    expect(overview.structuredContent).toMatchObject({ data: { summary: { applications: 1, servers: 1 } } });
    await client.close();
    await server.close();
  });

  test("redacts successful tool output before structured and text content", async () => {
    const server = createServer(config, async () => new Response(JSON.stringify([{ key: "DB_URL", value: "postgres://secret", private_key: "pem" }]), { headers: { "content-type": "application/json" } }));
    const client = new Client({ name: "test", version: "0.0.0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
    const result = await client.callTool({ name: "coolify_list_envs_by_application_uuid", arguments: { uuid: "app" } });
    expect(JSON.stringify(result.structuredContent)).not.toContain("postgres://secret");
    expect(JSON.stringify(result.content)).not.toContain("postgres://secret");
    await client.close();
    await server.close();
  });

  test("accepts array responses from list_databases", async () => {
    const { server, client } = await connected(async () => json([{ uuid: "db" }]));
    const result = await client.callTool({ name: "coolify_list_databases", arguments: {} });
    expect(result.isError).not.toBe(true);
    expect(result.structuredContent).toMatchObject({ data: [{ uuid: "db" }] });
    await client.close();
    await server.close();
  });

  test("returns database create and update objects despite empty upstream responses", async () => {
    const { server, client } = await connected(async () => json({ uuid: "database" }));
    for (const name of [
      "coolify_create_database_postgresql", "coolify_create_database_mysql", "coolify_create_database_mariadb",
      "coolify_create_database_mongodb", "coolify_create_database_redis", "coolify_create_database_clickhouse",
      "coolify_create_database_dragonfly", "coolify_create_database_keydb",
    ]) {
      const result = await client.callTool({ name, arguments: { body: { server_uuid: "server", project_uuid: "project", environment_name: "test", environment_uuid: "environment" } } });
      expect(result.isError).not.toBe(true);
      expect(result.structuredContent).toMatchObject({ data: { uuid: "database" } });
    }
    const updated = await client.callTool({ name: "coolify_update_database_by_uuid", arguments: { uuid: "database", body: { description: "test" } } });
    expect(updated.isError).not.toBe(true);
    expect(updated.structuredContent).toMatchObject({ data: { uuid: "database" } });
    await client.close();
    await server.close();
  });

  test("returns database details and backup collections in their actual shapes", async () => {
    const { server, client } = await connected(async (url) => json(new URL(String(url)).pathname.endsWith("/backups") ? [{ uuid: "backup" }] : { uuid: "database" }));
    const detail = await client.callTool({ name: "coolify_get_database_by_uuid", arguments: { uuid: "database" } });
    const backups = await client.callTool({ name: "coolify_get_database_backups_by_uuid", arguments: { uuid: "database" } });
    expect(detail.isError).not.toBe(true);
    expect(detail.structuredContent).toMatchObject({ data: { uuid: "database" } });
    expect(backups.isError).not.toBe(true);
    expect(backups.structuredContent).toMatchObject({ data: [{ uuid: "backup" }] });
    await client.close();
    await server.close();
  });

  test("passes the canonical custom Docker options field through database updates", async () => {
    let requestBody: unknown;
    const { server, client } = await connected(async (_url, init) => {
      requestBody = JSON.parse(String(init?.body));
      return new Response(null, { status: 204 });
    });
    const result = await client.callTool({
      name: "coolify_update_database_by_uuid",
      arguments: { uuid: "db", body: { custom_docker_run_options: "--shm-size=4g" } },
    });
    expect(result.isError).not.toBe(true);
    expect(requestBody).toEqual({ custom_docker_run_options: "--shm-size=4g" });
    await client.close();
    await server.close();
  });

  test("accepts array responses from list_resources", async () => {
    const { server, client } = await connected(async () => json([{ uuid: "resource", type: "application" }]));
    const result = await client.callTool({ name: "coolify_list_resources", arguments: {} });
    expect(result.isError).not.toBe(true);
    expect(result.structuredContent).toMatchObject({ data: [{ uuid: "resource", type: "application" }] });
    await client.close();
    await server.close();
  });

  test("returns application deployment collections with null commit messages", async () => {
    const { server, client } = await connected(async () => json({ count: 1, deployments: [{ deployment_uuid: "deployment", status: "finished", git_type: null, commit_message: null }] }));
    const result = await client.callTool({ name: "coolify_list_deployments_by_app_uuid", arguments: { uuid: "app" } });
    expect(result.isError).not.toBe(true);
    expect(result.structuredContent).toMatchObject({ data: { count: 1, deployments: [{ deployment_uuid: "deployment", status: "finished", commit_message: null }] } });
    await client.close();
    await server.close();
  });

  test("rejects null and unknown collection responses at the generated boundary", async () => {
    const nullResult = await (async () => {
      const { server, client } = await connected(async () => json(null));
      const result = await client.callTool({ name: "coolify_list_databases", arguments: {} });
      await client.close();
      await server.close();
      return result;
    })();
    const unknownResult = await (async () => {
      const { server, client } = await connected(async () => json({ unknown: true }));
      const result = await client.callTool({ name: "coolify_list_resources", arguments: {} });
      await client.close();
      await server.close();
      return result;
    })();
    expect(nullResult.isError).toBe(true);
    expect(unknownResult.isError).toBe(true);
  });

  test("rejects a string deployment response instead of widening the generated schema", async () => {
    const { server, client } = await connected(async () => json("not-a-deployment-collection"));
    const result = await client.callTool({ name: "coolify_list_deployments_by_app_uuid", arguments: { uuid: "app" } });
    expect(result.isError).toBe(true);
    await client.close();
    await server.close();
  });

  test("returns the plugin version without a provider request", async () => {
    let calls = 0;
    const { server, client } = await connected(async () => { calls++; return json({}); });
    const result = await client.callTool({ name: "coolify_get_mcp_version", arguments: {} });
    expect(result.structuredContent).toMatchObject({ data: { name: "@jurislm/coolify-plugin", version: pluginVersion } });
    expect(calls).toBe(0);
    await client.close();
    await server.close();
  });

  test("diagnoses an application through generated detail, log, env, and deployment requests", async () => {
    const calls: string[] = [];
    const { server, client } = await connected(async (url) => {
      const path = new URL(String(url)).pathname;
      calls.push(path);
      return json(path === "/api/v1/applications" ? [{ uuid: "app", name: "api", status: "running" }]
        : path.endsWith("/logs") ? { logs: "ok" } : path.includes("/envs") || path.includes("/deployments") ? [] : { uuid: "app", status: "running" });
    });
    const result = await client.callTool({ name: "coolify_diagnose_application", arguments: { query: "api" } });
    expect(result.structuredContent).toMatchObject({ data: { health: { status: "healthy" } } });
    expect(calls).toEqual(expect.arrayContaining(["/api/v1/applications", "/api/v1/applications/app", "/api/v1/applications/app/logs", "/api/v1/applications/app/envs", "/api/v1/deployments/applications/app"]));
    await client.close();
    await server.close();
  });

  test("diagnoses a server through read-only detail, resource, and domain requests", async () => {
    const calls: Array<{ path: string; method?: string }> = [];
    const { server, client } = await connected(async (url, init) => {
      const path = new URL(String(url)).pathname;
      calls.push({ path, method: init?.method });
      return json(path === "/api/v1/servers" ? [{ uuid: "server", name: "edge", ip: "10.0.0.1", is_reachable: true }] : path.endsWith("/resources") || path.endsWith("/domains") ? [] : { uuid: "server" });
    });
    await client.callTool({ name: "coolify_diagnose_server", arguments: { query: "edge" } });
    expect(calls).toEqual(expect.arrayContaining([
      { path: "/api/v1/servers", method: "GET" }, { path: "/api/v1/servers/server", method: "GET" }, { path: "/api/v1/servers/server/resources", method: "GET" }, { path: "/api/v1/servers/server/domains", method: "GET" },
    ]));
    expect(calls.every((call) => call.method === "GET")).toBe(true);
    await client.close();
    await server.close();
  });

  test("finds unhealthy resources through the issue tool", async () => {
    const { server, client } = await connected(async (url) => {
      const path = new URL(String(url)).pathname;
      return json(path.endsWith("/servers") ? [{ uuid: "server", is_reachable: false }]
        : path.endsWith("/applications") ? [{ uuid: "app", status: "stopped" }]
        : path.endsWith("/databases") ? [{ uuid: "db", status: "error" }]
        : [{ uuid: "service", status: "unhealthy" }]);
    });
    const result = await client.callTool({ name: "coolify_find_issues", arguments: {} });
    expect(result.structuredContent).toMatchObject({ data: { summary: { total_issues: 4 } } });
    await client.close();
    await server.close();
  });

  test("restarts project applications through the generated restart endpoint", async () => {
    const calls: Array<{ path: string; method?: string }> = [];
    const { server, client } = await connected(async (url, init) => {
      const path = new URL(String(url)).pathname;
      calls.push({ path, method: init?.method });
      if (path === "/api/v1/applications") return json([{ uuid: "app", environment_id: 7 }, { uuid: "other", environment_id: 8 }]);
      if (path === "/api/v1/projects/project/environments") return json([{ id: 7 }]);
      return json({ message: "ok" });
    });
    await client.callTool({ name: "coolify_restart_project_applications", arguments: { project_uuid: "project" } });
    expect(calls).toContainEqual({ path: "/api/v1/applications/app/restart", method: "POST" });
    expect(calls).not.toContainEqual({ path: "/api/v1/applications/other/restart", method: "POST" });
    await client.close();
    await server.close();
  });

  test("updates existing application envs with only generated-schema body fields", async () => {
    const calls: Array<{ path: string; method?: string; body?: string }> = [];
    const { server, client } = await connected(async (url, init) => {
      const path = new URL(String(url)).pathname;
      calls.push({ path, method: init?.method, body: String(init?.body) });
      return json(path === "/api/v1/applications" ? [{ uuid: "app", name: "qa", ports_exposes: null }] : { uuid: "env" });
    });
    const rejected = await client.callTool({ name: "coolify_bulk_update_application_env", arguments: { app_uuids: ["app"], key: "FOO", value: "BAR", is_build_time: true } });
    expect(rejected.isError).toBe(true);
    expect(calls).toHaveLength(0);
    const updated = await client.callTool({ name: "coolify_bulk_update_application_env", arguments: { app_uuids: ["app"], key: "FOO", value: "BAR" } });
    expect(updated.structuredContent).toMatchObject({ data: { summary: { succeeded: 1, failed: 0 } } });
    expect(calls).toContainEqual({ path: "/api/v1/applications/app/envs", method: "PATCH", body: JSON.stringify({ key: "FOO", value: "BAR" }) });
    await client.close();
    await server.close();
  });

  test("requires confirmation before stopping all applications", async () => {
    const calls: string[] = [];
    const { server, client } = await connected(async (url) => {
      const path = new URL(String(url)).pathname;
      calls.push(path);
      return json(path.endsWith("/applications") ? [{ uuid: "app", status: "running:healthy" }, { uuid: "stopped", status: "exited:unhealthy" }] : { message: "stopped" });
    });
    const rejected = await client.callTool({ name: "coolify_stop_all_applications", arguments: { confirm_stop_all_applications: false } });
    expect(rejected.isError).toBe(true);
    expect(calls).toHaveLength(0);
    await client.callTool({ name: "coolify_stop_all_applications", arguments: { confirm_stop_all_applications: true } });
    expect(calls).toEqual(["/api/v1/applications", "/api/v1/applications/app/stop"]);
    await client.close();
    await server.close();
  });

  test("redeploys project applications through the generated deploy query", async () => {
    const requests: string[] = [];
    const { server, client } = await connected(async (url) => {
      const request = String(url);
      requests.push(request);
      const path = new URL(request).pathname;
      if (path === "/api/v1/applications") return json([{ uuid: "app", environment_id: 7 }, { uuid: "other", environment_id: 8 }]);
      if (path === "/api/v1/projects/project/environments") return json([{ id: 7 }]);
      return json({ deployments: [] });
    });
    await client.callTool({ name: "coolify_redeploy_project_applications", arguments: { project_uuid: "project" } });
    expect(requests).toContain("https://coolify.example/api/v1/deploy?uuid=app&force=true");
    expect(requests).not.toContain("https://coolify.example/api/v1/deploy?uuid=other&force=true");
    await client.close();
    await server.close();
  });

  test("builds Docker network alias remediation from the fetched server", async () => {
    const { server, client } = await connected(async () => json({ ip: "10.0.0.1", user: "root", port: 22 }));
    const result = await client.callTool({ name: "coolify_docker_network_alias", arguments: { server_uuid: "server", db_uuid: "db", name: "database" } });
    expect(JSON.stringify(result.structuredContent)).toContain("docker network connect 'coolify' 'db' --alias 'database'");
    expect(JSON.stringify(result.structuredContent)).toContain("coolify_get_database_by_uuid");
    await client.close();
    await server.close();
  });

  test("returns overview partial results and named errors", async () => {
    const { server, client } = await connected(async (url) => {
      const path = new URL(String(url)).pathname;
      if (path.endsWith("/projects")) throw new Error("projects unavailable");
      return json(path.endsWith("/servers") ? [{ uuid: "server" }] : path.endsWith("/applications") ? [{ uuid: "app" }] : []);
    });
    const result = await client.callTool({ name: "coolify_get_infrastructure_overview", arguments: {} });
    expect(result.structuredContent).toMatchObject({ data: { servers: [{ uuid: "server" }], projects: [], errors: ["projects: Coolify request failed for GET /projects: projects unavailable"] } });
    await client.close();
    await server.close();
  });

  test("skips application log requests when the container is stopped", async () => {
    const calls: string[] = [];
    const { server, client } = await connected(async (url) => {
      const path = new URL(String(url)).pathname;
      calls.push(path);
      if (path === "/api/v1/applications") return json([{ uuid: "app", name: "api", status: "exited:unhealthy" }]);
      if (path.endsWith("/logs")) throw new Error("stopped container logs unavailable");
      if (path.endsWith("/envs")) return json([]);
      if (path.includes("/deployments/")) return json({ count: 0, deployments: [] });
      return json({ uuid: "app", name: "api", status: "exited:unhealthy" });
    });
    const result = await client.callTool({ name: "coolify_diagnose_application", arguments: { query: "api" } });
    const data = result.structuredContent as { data: Record<string, any> };
    expect(calls.some((path) => path.endsWith("/logs"))).toBe(false);
    expect(data.data.logs).toBe(null);
    expect(data.data.errors).toBeUndefined();
    await client.close();
    await server.close();
  });

  test("returns partial application diagnostics with safe env summaries and bounded logs", async () => {
    const log = Array.from({ length: 201 }, (_, index) => `${index}-${"x".repeat(400)}`).join("\n");
    const { server, client } = await connected(async (url) => {
      const path = new URL(String(url)).pathname;
      if (path === "/api/v1/applications") return json([{ uuid: "app", name: "api", status: "running" }]);
      if (path === "/api/v1/applications/app") throw new Error("details unavailable");
      if (path.endsWith("/logs")) return json({ logs: log });
      if (path.endsWith("/envs")) return json([{ key: "DB_URL", is_buildtime: true, value: "secret" }, { key: "MODE", is_runtime: true, value: "prod" }]);
      return json({ count: 1, deployments: [{ deployment_uuid: "deployment", status: "failed" }] });
    });
    const result = await client.callTool({ name: "coolify_diagnose_application", arguments: { query: "api" } });
    const data = result.structuredContent as { data: Record<string, any> };
    expect(data.data.errors).toEqual(["application: Coolify request failed for GET /applications/app: details unavailable"]);
    expect(data.data.health.status).toBe("unhealthy");
    expect(data.data.recent_deployments).toMatchObject([{ uuid: "deployment", status: "failed" }]);
    expect(data.data.logs).toContain("...[truncated]...");
    expect(data.data.logs.length).toBeLessThanOrEqual(50_000);
    expect(data.data.environment_variables.variables).toEqual([{ key: "DB_URL", is_build_time: true }, { key: "MODE", is_build_time: false }]);
    expect(JSON.stringify(data.data)).not.toContain("secret");
    await client.close();
    await server.close();
  });

  test("returns partial server diagnostics with reachability and resource issues", async () => {
    const { server, client } = await connected(async (url) => {
      const path = new URL(String(url)).pathname;
      if (path === "/api/v1/servers") return json([{ uuid: "server", name: "edge", is_reachable: false, is_usable: false }]);
      if (path.endsWith("/resources")) return json([{ uuid: "resource", name: "api", status: "unhealthy", type: "application" }]);
      if (path.endsWith("/domains")) throw new Error("domains unavailable");
      return json({ uuid: "server", name: "edge", is_reachable: false, is_usable: false });
    });
    const result = await client.callTool({ name: "coolify_diagnose_server", arguments: { query: "edge" } });
    const data = result.structuredContent as { data: Record<string, any> };
    expect(data.data.health.status).toBe("unhealthy");
    expect(data.data.health.issues).toEqual(expect.arrayContaining(["Server is not reachable", "Server is not usable", "1 unhealthy resource(s)"]));
    expect(data.data.errors).toEqual(["domains: Coolify request failed for GET /servers/server/domains: domains unavailable"]);
    await client.close();
    await server.close();
  });

  test("returns find-issues partial results and provider errors", async () => {
    const { server, client } = await connected(async (url) => {
      const path = new URL(String(url)).pathname;
      if (path.endsWith("/servers")) return json([{ uuid: "server", is_reachable: false }]);
      if (path.endsWith("/applications")) return json([{ uuid: "app", status: "stopped" }]);
      if (path.endsWith("/databases")) return json([{ uuid: "db", status: "error" }]);
      throw new Error("services unavailable");
    });
    const result = await client.callTool({ name: "coolify_find_issues", arguments: {} });
    const data = result.structuredContent as { data: Record<string, any> };
    expect(data.data.summary.total_issues).toBe(3);
    expect(data.data.errors).toEqual(["services: Coolify request failed for GET /services: services unavailable"]);
    await client.close();
    await server.close();
  });

  test("gets an environment and cross-references database types and identity fields", async () => {
    const { server, client } = await connected(async (url) => {
      const path = new URL(String(url)).pathname;
      if (path === "/api/v1/projects/project/production") return json({ id: 7, uuid: "environment", name: "production", description: null });
      return json([{ uuid: "db", database_type: "dragonfly", environment_id: 7 }, { uuid: "other", database_type: "keydb", environment_id: 7 }, { uuid: "legacy", type: "clickhouse", environment_uuid: "environment" }]);
    });
    const result = await client.callTool({ name: "coolify_get_environment", arguments: { project_uuid: "project", environment_name_or_uuid: "production" } });
    expect(result.structuredContent).toMatchObject({ data: { id: 7, dragonflys: [{ uuid: "db" }], keydbs: [{ uuid: "other" }], missing_database_types: ["clickhouse"] } });
    await client.close();
    await server.close();
  });
});
