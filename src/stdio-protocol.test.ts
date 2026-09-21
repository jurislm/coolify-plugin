import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { expect, test } from "bun:test";

test("serves the generated tool catalog over local stdio", async () => {
  expect(await Bun.file("dist/index.js").exists()).toBe(true);
  const env = Object.fromEntries(Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined));
  delete env.COOLIFY_URL;
  delete env.COOLIFY_TOKEN;
  const transport = new StdioClientTransport({
    command: "bun",
    args: ["dist/index.js"],
    env,
    stderr: "pipe",
  });
  const client = new Client({ name: "stdio-test", version: "0.0.0" });
  await client.connect(transport);
  const result = await client.listTools();
  expect(result.tools.some((tool) => tool.name === "coolify_list_applications")).toBe(true);
  const call = await client.callTool({ name: "coolify_list_applications", arguments: {} });
  expect(call.isError).toBe(true);
  expect(call.content).toContainEqual(expect.objectContaining({ text: expect.stringContaining("COOLIFY_URL is required") }));
  await client.close();
});
