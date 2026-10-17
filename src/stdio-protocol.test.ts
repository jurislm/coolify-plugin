import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

test("serves the generated tool catalog over local stdio", async () => {
  expect(await Bun.file("dist/index.js").exists()).toBe(true);
  const env = Object.fromEntries(Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined));
  delete env.COOLIFY_BASE_URL;
  delete env.COOLIFY_ACCESS_TOKEN;
  delete env.COOLIFY_URL;
  delete env.COOLIFY_TOKEN;
  for (const name of ["COOLIFY_CLOUD_BASE_URL", "COOLIFY_CLOUD_ACCESS_TOKEN", "CURSOR_COOLIFY_BASE_URL", "CURSOR_COOLIFY_ACCESS_TOKEN"]) delete env[name];
  env.JURISLM_PLUGIN_ENV = "/nonexistent/jurislm/plugin.env";
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
  expect(call.content).toContainEqual(expect.objectContaining({ text: expect.stringContaining("COOLIFY_BASE_URL is required") }));
  await client.close();
});

test("fills unsubstituted Cursor placeholders from the JurisLM plugin env file", async () => {
  const requests: string[] = [];
  const api = Bun.serve({ port: 0, fetch(request) {
    requests.push(`${new URL(request.url).pathname} ${request.headers.get("authorization")}`);
    return Response.json([]);
  } });
  const directory = mkdtempSync(join(tmpdir(), "coolify-plugin-env-"));
  try {
    const envFile = join(directory, "plugin.env");
    writeFileSync(envFile, `export COOLIFY_BASE_URL=http://127.0.0.1:${api.port}\nexport COOLIFY_ACCESS_TOKEN=fixture-file-token\n`);
    const env = Object.fromEntries(Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined));
    for (const name of ["COOLIFY_CLOUD_BASE_URL", "COOLIFY_CLOUD_ACCESS_TOKEN", "COOLIFY_BASE_URL", "COOLIFY_ACCESS_TOKEN"]) delete env[name];
    Object.assign(env, { CURSOR_COOLIFY_BASE_URL: "${CURSOR_COOLIFY_BASE_URL}", CURSOR_COOLIFY_ACCESS_TOKEN: "${CURSOR_COOLIFY_ACCESS_TOKEN}", JURISLM_PLUGIN_ENV: envFile });
    const client = new Client({ name: "stdio-test", version: "0.0.0" });
    await client.connect(new StdioClientTransport({ command: "bun", args: ["dist/index.js"], env, stderr: "pipe" }));
    const call = await client.callTool({ name: "coolify_list_applications", arguments: {} });
    await client.close();
    expect(call.isError).not.toBe(true);
    expect(requests).toEqual(["/api/v1/applications Bearer fixture-file-token"]);
  } finally {
    await api.stop(true);
    rmSync(directory, { recursive: true, force: true });
  }
});
