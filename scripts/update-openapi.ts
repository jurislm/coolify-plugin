import { mkdir } from "node:fs/promises";

const sourceUrl = "https://raw.githubusercontent.com/coollabsio/coolify/main/openapi.json";
const specPath = "openapi/coolify-openapi.json";
const manifestPath = "api/manifest.json";
const methods = new Set(["get", "put", "post", "delete", "patch", "head", "options", "trace"]);

const response = await fetch(sourceUrl);
if (!response.ok) throw new Error(`OpenAPI download failed: ${response.status} ${response.statusText}`);
const text = await response.text();
const persisted = text.endsWith("\n") ? text : `${text}\n`;
const spec = Bun.YAML.parse(persisted) as { openapi?: string; info?: { version?: string }; paths?: Record<string, Record<string, unknown>> };
const hash = new Bun.CryptoHasher("sha256");
hash.update(persisted);
const operationCount = Object.values(spec.paths ?? {}).reduce(
  (count, pathItem) => count + Object.keys(pathItem).filter((method) => methods.has(method)).length,
  0,
);

await mkdir("openapi", { recursive: true });
await mkdir("api", { recursive: true });
await Bun.write(specPath, persisted);
await Bun.write(manifestPath, `${JSON.stringify({
  sourceUrl,
  fetchedAt: new Date().toISOString(),
  sha256: hash.digest("hex"),
  openapiVersion: spec.openapi ?? "unknown",
  infoVersion: spec.info?.version ?? "unknown",
  pathCount: Object.keys(spec.paths ?? {}).length,
  operationCount,
}, null, 2)}\n`);

console.error(`Fetched ${operationCount} Coolify OpenAPI operations`);
