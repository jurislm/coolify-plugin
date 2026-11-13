export const requiredPackedPaths = [
  "dist/index.js",
  "launchers/coolify-desktop.zsh",
  "launchers/validate-coolify-runtime.mjs",
  "api/manifest.json",
  "openapi/coolify-openapi.json",
  "plugin.json",
  "mcp.json",
  ".mcp.json",
  ".mcp.json.example",
  ".app.json.example",
  ".codex-plugin/plugin.json",
  "skills/coolify/SKILL.md",
  "README.md",
  "LICENSE",
] as const;

export const gitOnlyPackedPathPrefixes = ["plugins/cursor/", ".cursor-plugin/", ".agents/"] as const;

export function parsePackedPaths(output: string): string[] {
  return [...output.matchAll(/^packed\s+\S+\s+(.+)$/gimu)].map((match) => match[1].trim());
}

export function assertPackedDistribution(paths: string[]): void {
  for (const path of requiredPackedPaths) {
    if (!paths.includes(path)) throw new Error(`package is missing ${path}`);
  }
  if (paths.filter((path) => path === "api/manifest.json").length !== 1) {
    throw new Error("package must contain exactly one api/manifest.json");
  }
  for (const packed of paths) {
    for (const prefix of gitOnlyPackedPathPrefixes) {
      if (packed === prefix.slice(0, -1) || packed.startsWith(prefix)) {
        throw new Error(`package must not include Git marketplace path ${packed}`);
      }
    }
  }
}

if (import.meta.main) {
  const output = await new Response(Bun.stdin.stream()).text();
  assertPackedDistribution(parsePackedPaths(output));
  console.error("Package contents valid");
}
