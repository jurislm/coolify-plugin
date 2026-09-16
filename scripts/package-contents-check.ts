export function parsePackedPaths(output: string): string[] {
  return [...output.matchAll(/^packed\s+\S+\s+(.+)$/gimu)].map((match) => match[1].trim());
}

if (import.meta.main) {
  const output = await new Response(Bun.stdin.stream()).text();
  const paths = parsePackedPaths(output);
  for (const path of ["dist/index.js", "api/manifest.json", "openapi/coolify-openapi.json", "plugin.json", "mcp.json", ".mcp.json", ".mcp.json.example", ".app.json.example", ".codex-plugin/plugin.json", "skills/coolify/SKILL.md", "README.md", "LICENSE"]) {
    if (!paths.includes(path)) throw new Error(`package is missing ${path}`);
  }
  if (paths.filter((path) => path === "api/manifest.json").length !== 1) throw new Error("package must contain exactly one api/manifest.json");
  console.error("Package contents valid");
}
