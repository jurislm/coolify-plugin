import { expect, test } from "bun:test";
import { operations } from "./generated/operations.js";

test("generated operations match the pinned Coolify manifest", async () => {
  const manifest = JSON.parse(await Bun.file("api/manifest.json").text()) as { operationCount: number; openapiVersion: string; infoVersion: string };
  expect(operations).toHaveLength(manifest.operationCount);
  expect(operations.every((operation) => operation.name.startsWith("coolify_") && operation.path.startsWith("/"))).toBe(true);
  expect(manifest.openapiVersion).toBe("3.1.0");
  expect(manifest.infoVersion).toBe("0.1");
  const fallback = JSON.parse(await Bun.file(".codex-plugin/plugin.json").text()) as { mcpServers?: string; apps?: string };
  expect(fallback.mcpServers).toBe("./.mcp.json");
  expect(fallback.apps).toBeUndefined();
});
