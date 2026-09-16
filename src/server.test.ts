import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { describe, expect, test } from "bun:test";
import type { CoolifyConfig } from "./config.js";
import { operations } from "./generated/operations.js";
import { createServer } from "./server.js";

const config: CoolifyConfig = { baseUrl: "https://coolify.example/api/v1", token: "secret", timeoutMs: 30_000 };

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
});
