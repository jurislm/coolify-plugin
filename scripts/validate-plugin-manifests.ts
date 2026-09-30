import { Ajv2020 } from "ajv/dist/2020.js";
import { isDeepStrictEqual } from "node:util";

type Json = Record<string, unknown>;
const files = ["plugin.json", ".codex-plugin/plugin.json", "plugins/cursor/.cursor-plugin/plugin.json", ".cursor-plugin/marketplace.json", "plugins/cursor/mcp.json", "mcp.json", ".mcp.json", ".mcp.json.example", ".app.json.example"];
const parsed = Object.fromEntries(await Promise.all(files.map(async (file) => [file, JSON.parse(await Bun.file(file).text()) as Json])));
const ajv = new Ajv2020({ allErrors: true, strict: false });
for (const [file, schemaFile] of [["plugin.json", "plugin.schema.json"], ["mcp.json", "mcp.schema.json"]]) {
  const validate = ajv.compile(await Bun.file(`schemas/${schemaFile}`).json() as Json);
  if (!validate(parsed[file])) throw new Error(`${file}: ${ajv.errorsText(validate.errors)}`);
}
const packageJson = JSON.parse(await Bun.file("package.json").text()) as Json;
const packageVersion = String(packageJson.version);
const officialWebsite = "https://jurislm.github.io/coolify-plugin/";
const repositoryUrl = "https://github.com/jurislm/coolify-plugin";
const portableKeys = ["$schema", "name", "version", "description", "author", "homepage", "repository", "license", "keywords", "extensions"];
const unexpectedPortableKeys = Object.keys(parsed["plugin.json"]).filter((key) => !portableKeys.includes(key));
if (unexpectedPortableKeys.length > 0) throw new Error(`plugin.json contains non-portable fields: ${unexpectedPortableKeys.join(", ")}`);
const portableInterface = (((parsed["plugin.json"].extensions as Json)["com.openai"] as Json).interface as Json);
const fallbackInterface = parsed[".codex-plugin/plugin.json"].interface as Json;
if (parsed["plugin.json"].$schema !== "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json") throw new Error("plugin.json must use the portable Agent Plugins schema");
if (portableInterface.displayName !== "Coolify Plugin") throw new Error("plugin.json must provide extensions.com.openai.interface");
if (JSON.stringify(portableInterface.defaultPrompt) !== JSON.stringify(["List my Coolify resources."])) throw new Error("plugin.json must provide the portable Coolify starter prompt");
for (const manifestInterface of [portableInterface, fallbackInterface]) {
  if (manifestInterface.category !== "Developer Tools") throw new Error("Plugin interface category must be Developer Tools");
  if (manifestInterface.shortDescription !== "Manage Coolify locally.") throw new Error("Plugin short description must describe local Coolify access");
  if (JSON.stringify(manifestInterface.capabilities) !== JSON.stringify(["Read", "Write"])) throw new Error("Plugin capabilities must match Woodpecker");
  if (manifestInterface.composerIcon !== "./assets/coolify.png" || manifestInterface.logo !== "./assets/coolify.png") throw new Error("Plugin icons must use the shipped Coolify PNG");
  if (manifestInterface.websiteURL !== officialWebsite) throw new Error("Plugin websiteURL must point to the official website");
}
if (parsed["plugin.json"].homepage !== officialWebsite || parsed["plugin.json"].repository !== repositoryUrl) throw new Error("Portable manifest must link to the official website and repository");
if ((parsed[".codex-plugin/plugin.json"].repository as string) !== repositoryUrl) throw new Error("Fallback manifest repository metadata must point to the public repository");
if (parsed["mcp.json"].$schema !== "https://agent-plugins.org/schemas/1.0.0/mcp.schema.json") throw new Error("mcp.json must use the portable Agent Plugins schema");
for (const file of ["plugin.json", ".codex-plugin/plugin.json"]) {
  const manifest = parsed[file];
  if (manifest.name !== "coolify-plugin" || manifest.version !== packageVersion) throw new Error(`${file} is not the portable Coolify manifest for ${packageVersion}`);
}
if (parsed[".codex-plugin/plugin.json"].mcpServers !== "./.mcp.json" || "apps" in parsed[".codex-plugin/plugin.json"]) throw new Error("fallback manifest must reference ./.mcp.json and omit apps");
const server = (parsed[".mcp.json"].mcpServers as Json).coolify as Json;
if (server.type !== "stdio" || server.command !== "bunx" || "cwd" in server || "url" in server || "serverUrl" in server || !(server.args as string[]).includes("@jurislm/coolify-plugin@latest")) throw new Error(".mcp.json must match the Woodpecker bunx stdio registration");
if (!isDeepStrictEqual(server.env_vars, ["COOLIFY_CLOUD_BASE_URL", "COOLIFY_CLOUD_ACCESS_TOKEN", "CURSOR_COOLIFY_BASE_URL", "CURSOR_COOLIFY_ACCESS_TOKEN", "COOLIFY_BASE_URL", "COOLIFY_ACCESS_TOKEN"])) throw new Error("Codex MCP must forward the six supported Coolify connection variables");
const portableServers = parsed["mcp.json"].mcpServers as Record<string, Json>;
for (const portableServer of Object.values(portableServers)) {
  if ("env" in portableServer || /\$\{(?!PLUGIN_ROOT\}|PLUGIN_DATA\})[^}]+\}/u.test(JSON.stringify(portableServer))) throw new Error("mcp.json: credentials must come from the host environment");
}
const nativeServers = Object.fromEntries(Object.entries(parsed[".mcp.json"].mcpServers as Record<string, Json>).map(([name, nativeServer]) => [name, Object.fromEntries(Object.entries(nativeServer).filter(([key]) => key !== "env_vars"))]));
if (!isDeepStrictEqual(nativeServers, portableServers)) throw new Error("Codex and portable MCP registrations must agree on server identity, transport and launch target");
const exampleServer = (parsed[".mcp.json.example"].mcpServers as Json).coolify as Json;
if (exampleServer.command !== "bunx" || !(exampleServer.args as string[]).includes("@jurislm/coolify-plugin@latest")) throw new Error(".mcp.json.example must match the Woodpecker bunx registration");
const exampleEnv = exampleServer.env as Json;
if (!("COOLIFY_BASE_URL" in exampleEnv) || !("COOLIFY_ACCESS_TOKEN" in exampleEnv) || "COOLIFY_URL" in exampleEnv || "COOLIFY_TOKEN" in exampleEnv) throw new Error(".mcp.json.example must use the global Coolify environment variable names");
const cursorPlugin = parsed["plugins/cursor/.cursor-plugin/plugin.json"];
const cursorMarketplace = parsed[".cursor-plugin/marketplace.json"];
const cursorMarketplacePlugins = cursorMarketplace.plugins as unknown[];
const cursorVariables = cursorPlugin.variables as Json;
const cursorVariableProperties = cursorVariables.properties as Json;
const cursorMcpServer = ((parsed["plugins/cursor/mcp.json"].mcpServers as Json).coolify as Json);
const cursorMcpEnv = cursorMcpServer.env as Json;
const portableMcpServer = ((parsed["mcp.json"].mcpServers as Json).coolify as Json);
if (cursorPlugin.name !== "coolify-plugin" || cursorPlugin.skills !== "./skills/" || cursorPlugin.mcpServers !== "./mcp.json" || cursorPlugin.logo !== "assets/coolify.png" || cursorPlugin.homepage !== officialWebsite) throw new Error("Cursor plugin manifest must reference the official website and shipped components");
if (await Bun.file("plugins/cursor/skills/coolify/SKILL.md").text() !== await Bun.file("skills/coolify/SKILL.md").text()) throw new Error("Cursor skill must match the root Coolify skill");
if (!(await Bun.file("plugins/cursor/assets/coolify.png").exists())) throw new Error("Cursor plugin logo is missing");
if (cursorVariables.type !== "object" || JSON.stringify(cursorVariables.required) !== "[]" || !("CURSOR_COOLIFY_BASE_URL" in cursorVariableProperties) || !("CURSOR_COOLIFY_ACCESS_TOKEN" in cursorVariableProperties) || "COOLIFY_BASE_URL" in cursorVariableProperties || "COOLIFY_ACCESS_TOKEN" in cursorVariableProperties) throw new Error("Cursor plugin must declare only optional Configure aliases");
for (const name of ["CURSOR_COOLIFY_BASE_URL", "CURSOR_COOLIFY_ACCESS_TOKEN"]) {
  if ((cursorVariableProperties[name] as Json).default !== "") throw new Error(`${name} must default to an empty string`);
}
if (cursorMcpEnv.CURSOR_COOLIFY_BASE_URL !== "${CURSOR_COOLIFY_BASE_URL}" || cursorMcpEnv.CURSOR_COOLIFY_ACCESS_TOKEN !== "${CURSOR_COOLIFY_ACCESS_TOKEN}" || "COOLIFY_BASE_URL" in cursorMcpEnv || "COOLIFY_ACCESS_TOKEN" in cursorMcpEnv) throw new Error("Cursor MCP must not override inherited Coolify connection variables");
if (cursorMcpServer.command !== portableMcpServer.command || JSON.stringify(cursorMcpServer.args) !== JSON.stringify(portableMcpServer.args)) throw new Error("Cursor MCP configuration must launch the portable Coolify package");
if (cursorMarketplace.name !== "coolify-plugin" || (cursorMarketplace.owner as Json).name !== "JurisLM" || !Array.isArray(cursorMarketplacePlugins) || cursorMarketplacePlugins.length !== 1) throw new Error("Cursor marketplace must list the Coolify plugin");
const cursorMarketplacePlugin = cursorMarketplacePlugins[0] as Json;
if (cursorMarketplacePlugin.name !== cursorPlugin.name || cursorMarketplacePlugin.source !== "plugins/cursor") throw new Error("Cursor marketplace source must resolve to the Cursor-only plugin");
const dependencies = packageJson.dependencies as Json;
for (const [name, version] of Object.entries({ "@modelcontextprotocol/sdk": "1.30.0", zod: "4.6.5" })) {
  if (dependencies[name] !== version) throw new Error(`${name} must be pinned to ${version}`);
}
if (packageJson.private === true || (packageJson.engines as Json).bun !== ">=1.1.0") throw new Error("package must be publishable and require Bun >=1.1.0");
console.error("Plugin manifests valid");
