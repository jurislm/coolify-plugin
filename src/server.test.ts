import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { describe, expect, test } from "bun:test";
import type { CoolifyConfig } from "./config.js";
import { operations } from "./generated/operations.js";
import { createServer } from "./server.js";

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
    expect(result.tools).toHaveLength(operations.length + 10);
    expect(result.tools.every((tool) => tool.name.startsWith("coolify_"))).toBe(true);
    const deleteTool = result.tools.find((tool) => tool.name === "coolify_delete_application_by_uuid");
    expect(deleteTool?.annotations?.destructiveHint).toBe(true);
    expect(deleteTool?.annotations?.readOnlyHint).toBe(false);
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

  test("restores v3.6 composite capabilities as focused wrappers", async () => {
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

  test("returns the v3.6 plugin-version wrapper without a provider request", async () => {
    let calls = 0;
    const { server, client } = await connected(async () => { calls++; return json({}); });
    const result = await client.callTool({ name: "coolify_get_mcp_version", arguments: {} });
    expect(result.structuredContent).toMatchObject({ data: { name: "@jurislm/coolify-plugin", version: "0.1.0" } });
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

  test("diagnoses a server through detail, resources, domains, and validation requests", async () => {
    const calls: Array<{ path: string; method?: string }> = [];
    const { server, client } = await connected(async (url, init) => {
      const path = new URL(String(url)).pathname;
      calls.push({ path, method: init?.method });
      return json(path === "/api/v1/servers" ? [{ uuid: "server", name: "edge", ip: "10.0.0.1", is_reachable: true }] : path.endsWith("/resources") || path.endsWith("/domains") ? [] : { uuid: "server" });
    });
    await client.callTool({ name: "coolify_diagnose_server", arguments: { query: "edge" } });
    expect(calls).toEqual(expect.arrayContaining([
      { path: "/api/v1/servers", method: "GET" }, { path: "/api/v1/servers/server", method: "GET" }, { path: "/api/v1/servers/server/resources", method: "GET" }, { path: "/api/v1/servers/server/domains", method: "GET" }, { path: "/api/v1/servers/server/validate", method: "POST" },
    ]));
    await client.close();
    await server.close();
  });

  test("finds unhealthy resources through the v3.6 issue wrapper", async () => {
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
      return json(path.endsWith("/applications") ? [{ uuid: "app", project_uuid: "project" }] : { message: "ok" });
    });
    await client.callTool({ name: "coolify_restart_project_applications", arguments: { project_uuid: "project" } });
    expect(calls).toContainEqual({ path: "/api/v1/applications/app/restart", method: "POST" });
    await client.close();
    await server.close();
  });

  test("updates application envs with only generated-schema body fields", async () => {
    const calls: Array<{ path: string; method?: string; body?: string }> = [];
    const { server, client } = await connected(async (url, init) => {
      calls.push({ path: new URL(String(url)).pathname, method: init?.method, body: String(init?.body) });
      return json({ uuid: "env" });
    });
    const rejected = await client.callTool({ name: "coolify_bulk_update_application_env", arguments: { app_uuids: ["app"], key: "FOO", value: "BAR", is_build_time: true } });
    expect(rejected.isError).toBe(true);
    expect(calls).toHaveLength(0);
    await client.callTool({ name: "coolify_bulk_update_application_env", arguments: { app_uuids: ["app"], key: "FOO", value: "BAR" } });
    expect(calls).toContainEqual({ path: "/api/v1/applications/app/envs", method: "PATCH", body: JSON.stringify({ key: "FOO", value: "BAR" }) });
    await client.close();
    await server.close();
  });

  test("requires confirmation before stopping all applications", async () => {
    const calls: string[] = [];
    const { server, client } = await connected(async (url) => {
      const path = new URL(String(url)).pathname;
      calls.push(path);
      return json(path.endsWith("/applications") ? [{ uuid: "app", status: "running" }] : { message: "stopped" });
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
    let request = "";
    const { server, client } = await connected(async (url) => {
      request = String(url);
      return json(request.includes("/applications") ? [{ uuid: "app", project_uuid: "project" }] : { deployments: [] });
    });
    await client.callTool({ name: "coolify_redeploy_project_applications", arguments: { project_uuid: "project" } });
    expect(request).toBe("https://coolify.example/api/v1/deploy?uuid=app&force=true");
    await client.close();
    await server.close();
  });

  test("builds Docker network alias remediation from the fetched server", async () => {
    const { server, client } = await connected(async () => json({ ip: "10.0.0.1", user: "root", port: 22 }));
    const result = await client.callTool({ name: "coolify_docker_network_alias", arguments: { server_uuid: "server", db_uuid: "db", name: "database" } });
    expect(JSON.stringify(result.structuredContent)).toContain("docker network connect 'coolify' 'db' --alias 'database'");
    await client.close();
    await server.close();
  });
});
