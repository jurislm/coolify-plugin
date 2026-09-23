import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { CoolifyApiError, CoolifyClient, redactSensitive } from "./client.js";
import { registerCapabilities } from "./capabilities.js";
import type { FetchLike } from "./client.js";
import type { CoolifyConfig } from "./config.js";
import { operations } from "./generated/operations.js";
import { pluginVersion } from "./version.js";

const outputRequestSchema = z.object({ method: z.string(), path: z.string() });

export function createServer(config: CoolifyConfig, fetchImpl?: FetchLike): McpServer {
  const client = new CoolifyClient(config, fetchImpl);
  const server = new McpServer(
    { name: "coolify-plugin", version: pluginVersion },
    { instructions: "Use read tools to identify exact Coolify resources before mutations. Never expose tokens or secret values." },
  );
  for (const operation of operations) {
    server.registerTool(operation.name, {
      title: operation.name,
      description: operation.description,
      inputSchema: operation.inputSchema,
      outputSchema: z.object({ data: operation.responseSchema, status: z.number(), request: outputRequestSchema }),
      annotations: operation.annotations,
    }, async (input) => {
      try {
        const envelope = await client.request(operation, input as Record<string, unknown>);
        const data = operation.responseSchema.parse(envelope.data);
        const structuredContent = redactSensitive({ data, status: envelope.status, request: envelope.request });
        return { structuredContent, content: [{ type: "text" as const, text: JSON.stringify(structuredContent) }] };
      } catch (error) {
        const details = error instanceof CoolifyApiError
          ? { code: "COOLIFY_API_ERROR", status: error.status, method: error.method, path: error.path, message: error.message }
          : { code: "COOLIFY_TOOL_ERROR", message: error instanceof Error ? error.message : String(error) };
        return { isError: true, content: [{ type: "text" as const, text: JSON.stringify({ error: details }) }] };
      }
    });
  }
  registerCapabilities(server, client);
  return server;
}
