import { expect, test } from "bun:test";
import { cpSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

type Json = Record<string, unknown>;
const files = ["plugin.json", ".codex-plugin/plugin.json", "plugins/cursor/.cursor-plugin/plugin.json", ".cursor-plugin/marketplace.json", "plugins/cursor/mcp.json", "mcp.json", ".mcp.json", ".mcp.json.example", ".app.json.example", "package.json"];
const variables = ["COOLIFY_CLOUD_BASE_URL", "COOLIFY_CLOUD_ACCESS_TOKEN", "CURSOR_COOLIFY_BASE_URL", "CURSOR_COOLIFY_ACCESS_TOKEN", "COOLIFY_BASE_URL", "COOLIFY_ACCESS_TOKEN"];

async function validate(change: (manifests: Record<string, Json>) => void) {
  const directory = mkdtempSync(join(tmpdir(), "coolify-manifests-"));
  try {
    const manifests = Object.fromEntries(await Promise.all(files.map(async (file) => [file, await Bun.file(file).json() as Json])));
    change(manifests);
    cpSync("plugins", join(directory, "plugins"), { recursive: true });
    cpSync("skills", join(directory, "skills"), { recursive: true });
    for (const file of files) {
      cpSync(file, join(directory, file), { recursive: true });
      writeFileSync(join(directory, file), JSON.stringify(manifests[file]));
    }
    cpSync("schemas", join(directory, "schemas"), { recursive: true });
    const result = Bun.spawnSync([process.execPath, resolve("scripts/validate-plugin-manifests.ts")], { cwd: directory, stdout: "pipe", stderr: "pipe" });
    return { code: result.exitCode, error: new TextDecoder().decode(result.stderr) };
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

function server(manifest: Json): Json { return (manifest.mcpServers as Record<string, Json>).coolify; }

test("native MCP forwards all supported settings independently of portable fields", async () => {
  const result = await validate((manifests) => { server(manifests[".mcp.json"]).env_vars = variables; });
  expect(result.code).toBe(0);
});

test("portable plugin metadata must satisfy its committed schema", async () => {
  const result = await validate((manifests) => { manifests["plugin.json"].keywords = "coolify"; });
  expect(result.code).not.toBe(0);
  expect(result.error).toContain("plugin.json:");
});

test.each(["env_vars", "env"])("portable MCP rejects %s credential settings", async (field) => {
  const result = await validate((manifests) => { server(manifests["mcp.json"])[field] = field === "env_vars" ? variables : { COOLIFY_ACCESS_TOKEN: "fixture-token" }; });
  expect(result.code).not.toBe(0);
  expect(result.error).toContain("mcp.json:");
});

test("native MCP must keep the portable server identity and launch target", async () => {
  const result = await validate((manifests) => {
    (manifests[".mcp.json"].mcpServers as Json).unrelated = server(manifests[".mcp.json"]);
  });
  expect(result.code).not.toBe(0);
  expect(result.error).toContain("registrations");
});
