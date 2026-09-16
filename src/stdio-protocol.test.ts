import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { expect, test } from "bun:test";

test("serves the generated tool catalog over local stdio", async () => {
  const env = Object.fromEntries(Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined));
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ["src/index.ts"],
    cwd: process.cwd(),
    env: { ...env, COOLIFY_URL: "https://coolify.example", COOLIFY_TOKEN: "test-token" },
    stderr: "pipe",
  });
  const client = new Client({ name: "stdio-test", version: "0.0.0" });
  await client.connect(transport);
  const result = await client.listTools();
  expect(result.tools.some((tool) => tool.name === "coolify_list_applications")).toBe(true);
  await client.close();
});
