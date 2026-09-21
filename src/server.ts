import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { CoolifyApiError, CoolifyClient, redactSensitive } from "./client.js";
import { registerV36Capabilities } from "./capabilities.js";
import type { FetchLike } from "./client.js";
import type { CoolifyConfig } from "./config.js";
import { operations } from "./generated/operations.js";
import type { GeneratedOperation } from "./generated/operations.js";
import { pluginVersion } from "./version.js";

const outputRequestSchema = z.object({ method: z.string(), path: z.string() });

function withDatabaseDockerOptions(operation: GeneratedOperation): GeneratedOperation {
  if (operation.name !== "coolify_update_database_by_uuid") return operation;
  const inputSchema = operation.inputSchema as z.ZodObject<any>;
  const bodySchema = inputSchema.shape.body as z.ZodObject<any>;
  const partialBodyShape = Object.fromEntries(
    Object.entries(bodySchema.shape).map(([name, schema]) => [
      name,
      schema instanceof z.ZodDefault
        ? (schema.removeDefault() as z.ZodTypeAny).optional()
        : schema,
    ]),
  );
  return {
    ...operation,
    inputSchema: inputSchema.extend({
      body: z.object({
        ...partialBodyShape,
        custom_docker_run_options: z.string().optional().describe("Supported Docker run options for the database container, such as --shm-size=4g."),
      }),
    }),
    responseSchema: z.union([operation.responseSchema, z.record(z.string(), z.any())]),
  };
}

export function createServer(config: CoolifyConfig, fetchImpl?: FetchLike): McpServer {
  const client = new CoolifyClient(config, fetchImpl);
  const server = new McpServer(
    { name: "coolify-plugin", version: pluginVersion },
    { instructions: "Use read tools to identify exact Coolify resources before mutations. Never expose tokens or secret values." },
  );
  for (const operation of operations.map(withDatabaseDockerOptions)) {
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
  registerV36Capabilities(server, client);
  return server;
}
