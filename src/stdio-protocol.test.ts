import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { expect, test } from "bun:test";

test("serves the generated tool catalog over local stdio", async () => {
  const configured = JSON.parse(await Bun.file("mcp.json").text()) as { mcpServers: { coolify: { command: string; args: string[]; cwd?: string } } };
  const server = configured.mcpServers.coolify;
  expect(server.cwd).toBe("./");
  expect(await Bun.file(server.args[0]!).exists()).toBe(true);
  const env = Object.fromEntries(Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined));
  const transport = new StdioClientTransport({
    command: server.command,
    args: server.args,
    cwd: server.cwd ? new URL(server.cwd, `file://${process.cwd()}/`).pathname : process.cwd(),
    env: { ...env, COOLIFY_URL: "https://coolify.example", COOLIFY_TOKEN: "test-token" },
    stderr: "pipe",
  });
  const client = new Client({ name: "stdio-test", version: "0.0.0" });
  await client.connect(transport);
  const result = await client.listTools();
  expect(result.tools.some((tool) => tool.name === "coolify_list_applications")).toBe(true);
  await client.close();
});
