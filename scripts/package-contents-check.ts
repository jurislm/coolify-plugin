const result = Bun.spawnSync(["npm", "pack", "--dry-run", "--json"], { cwd: process.cwd(), stdout: "pipe", stderr: "pipe" });
if (result.exitCode !== 0) throw new Error(new TextDecoder().decode(result.stderr));
const packed = JSON.parse(new TextDecoder().decode(result.stdout)) as Array<{ files: Array<{ path: string }> }>;
const paths = new Set(packed[0]?.files.map((file) => file.path));
for (const path of ["dist/index.js", "plugin.json", "mcp.json", ".mcp.json", ".mcp.json.example", ".app.json.example", ".codex-plugin/plugin.json", "skills/coolify/SKILL.md", "README.md", "LICENSE"]) {
  if (!paths.has(path)) throw new Error(`package is missing ${path}`);
}
console.error("Package contents valid");
