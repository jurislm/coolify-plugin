type Json = Record<string, unknown>;
const files = ["plugin.json", ".codex-plugin/plugin.json", "mcp.json", ".mcp.json", ".mcp.json.example", ".app.json.example"];
const parsed = Object.fromEntries(await Promise.all(files.map(async (file) => [file, JSON.parse(await Bun.file(file).text()) as Json])));
const packageJson = JSON.parse(await Bun.file("package.json").text()) as Json;
if (parsed["plugin.json"].mcpServers !== "./.mcp.json") throw new Error("plugin.json must use the local stdio companion");
for (const file of ["plugin.json", ".codex-plugin/plugin.json"]) {
  const manifest = parsed[file];
  if (manifest.name !== "coolify-plugin" || manifest.version !== "0.1.0") throw new Error(`${file} is not the portable Coolify manifest`);
}
const server = (parsed[".mcp.json"].mcpServers as Json).coolify as Json;
if (server.type !== "stdio" || server.command !== "bun" || "url" in server || "serverUrl" in server) throw new Error(".mcp.json must define local stdio only");
if (JSON.stringify(parsed[".mcp.json"]) !== JSON.stringify(parsed["mcp.json"])) throw new Error("Codex and portable MCP registrations must agree");
const text = JSON.stringify(parsed);
if (text.includes("COOLIFY_BASE_URL") || text.includes("COOLIFY_ACCESS_TOKEN")) throw new Error("legacy Coolify credentials are forbidden");
const dependencies = packageJson.dependencies as Json;
for (const [name, version] of Object.entries({ "@modelcontextprotocol/sdk": "1.30.0", zod: "4.6.5" })) {
  if (dependencies[name] !== version) throw new Error(`${name} must be pinned to ${version}`);
}
if (packageJson.private !== true || (packageJson.engines as Json).bun !== ">=1.1.0") throw new Error("package must remain private and require Bun >=1.1.0");
console.error("Plugin manifests valid");
