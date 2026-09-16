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
    expect(result.tools).toHaveLength(operations.length);
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
});
