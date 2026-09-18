type Json = Record<string, unknown>;
const files = ["plugin.json", ".codex-plugin/plugin.json", "mcp.json", ".mcp.json", ".mcp.json.example", ".app.json.example"];
const parsed = Object.fromEntries(await Promise.all(files.map(async (file) => [file, JSON.parse(await Bun.file(file).text()) as Json])));
const packageJson = JSON.parse(await Bun.file("package.json").text()) as Json;
const packageVersion = String(packageJson.version);
const portableInterface = (((parsed["plugin.json"].extensions as Json)["com.openai"] as Json).interface as Json);
const fallbackInterface = parsed[".codex-plugin/plugin.json"].interface as Json;
if (parsed["plugin.json"].$schema !== "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json") throw new Error("plugin.json must use the portable Agent Plugins schema");
if (portableInterface.displayName !== "Coolify") throw new Error("plugin.json must provide extensions.com.openai.interface");
for (const manifestInterface of [portableInterface, fallbackInterface]) {
  if (manifestInterface.category !== "Developer tools") throw new Error("Plugin interface category must match Woodpecker");
  if (JSON.stringify(manifestInterface.capabilities) !== JSON.stringify(["Read", "Write"])) throw new Error("Plugin capabilities must match Woodpecker");
  if (manifestInterface.composerIcon !== "./assets/coolify.png" || manifestInterface.logo !== "./assets/coolify.png") throw new Error("Plugin icons must use the shipped Coolify PNG");
  if (manifestInterface.websiteURL !== "https://github.com/jurislm/coolify-plugin") throw new Error("Plugin websiteURL must point to the public repository");
}
if (parsed["plugin.json"].homepage !== "https://github.com/jurislm/coolify-plugin" || parsed["plugin.json"].repository !== "https://github.com/jurislm/coolify-plugin") throw new Error("Portable manifest repository metadata must match Woodpecker");
if ((parsed[".codex-plugin/plugin.json"].repository as string) !== "https://github.com/jurislm/coolify-plugin") throw new Error("Fallback manifest repository metadata must match Woodpecker");
if (parsed["mcp.json"].$schema !== "https://agent-plugins.org/schemas/1.0.0/mcp.schema.json") throw new Error("mcp.json must use the portable Agent Plugins schema");
for (const file of ["plugin.json", ".codex-plugin/plugin.json"]) {
  const manifest = parsed[file];
  if (manifest.name !== "coolify-plugin" || manifest.version !== packageVersion) throw new Error(`${file} is not the portable Coolify manifest for ${packageVersion}`);
}
if (parsed[".codex-plugin/plugin.json"].mcpServers !== "./.mcp.json" || "apps" in parsed[".codex-plugin/plugin.json"]) throw new Error("fallback manifest must reference ./.mcp.json and omit apps");
const server = (parsed[".mcp.json"].mcpServers as Json).coolify as Json;
if (server.type !== "stdio" || server.command !== "bunx" || "cwd" in server || "url" in server || "serverUrl" in server || !(server.args as string[]).includes("@jurislm/coolify-plugin@latest")) throw new Error(".mcp.json must match the Woodpecker bunx stdio registration");
if (JSON.stringify(parsed[".mcp.json"].mcpServers) !== JSON.stringify(parsed["mcp.json"].mcpServers)) throw new Error("Codex and portable MCP registrations must agree");
const exampleServer = (parsed[".mcp.json.example"].mcpServers as Json).coolify as Json;
if (exampleServer.command !== "bunx" || !(exampleServer.args as string[]).includes("@jurislm/coolify-plugin@latest")) throw new Error(".mcp.json.example must match the Woodpecker bunx registration");
const text = JSON.stringify(parsed);
if (text.includes("COOLIFY_BASE_URL") || text.includes("COOLIFY_ACCESS_TOKEN")) throw new Error("legacy Coolify credentials are forbidden");
const dependencies = packageJson.dependencies as Json;
for (const [name, version] of Object.entries({ "@modelcontextprotocol/sdk": "1.30.0", zod: "4.6.5" })) {
  if (dependencies[name] !== version) throw new Error(`${name} must be pinned to ${version}`);
}
if (packageJson.private === true || (packageJson.engines as Json).bun !== ">=1.1.0") throw new Error("package must be publishable and require Bun >=1.1.0");
console.error("Plugin manifests valid");
