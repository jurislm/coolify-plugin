import { access, readFile } from "node:fs/promises";

type Manifest = {
  sha256: string;
  openapiVersion: string;
  infoVersion: string;
  pathCount: number;
  operationCount: number;
};
type Document = { openapi?: string; info?: { version?: string }; paths?: Record<string, Record<string, unknown>> };
const methods = new Set(["get", "put", "post", "delete", "patch", "head", "options", "trace"]);

export function verifySnapshot(snapshot: string, manifest: Manifest): void {
  const hash = new Bun.CryptoHasher("sha256");
  hash.update(snapshot);
  if (hash.digest("hex") !== manifest.sha256) throw new Error("OpenAPI snapshot sha256 mismatch");
  const document = Bun.YAML.parse(snapshot) as Document;
  const paths = document.paths ?? {};
  const operationCount = Object.values(paths).reduce((count, pathItem) => count + Object.keys(pathItem).filter((method) => methods.has(method)).length, 0);
  if (document.openapi !== manifest.openapiVersion) throw new Error("OpenAPI document version mismatch");
  if (document.info?.version !== manifest.infoVersion) throw new Error("OpenAPI info.version mismatch");
  if (Object.keys(paths).length !== manifest.pathCount) throw new Error("OpenAPI path count mismatch");
  if (operationCount !== manifest.operationCount) throw new Error("OpenAPI operation count mismatch");
}

if (import.meta.main) {
  try { await access("openapi/manifest.json"); throw new Error("Conflicting openapi/manifest.json must be removed"); } catch (error) { if (error instanceof Error && !error.message.includes("ENOENT")) throw error; }
  const snapshot = await readFile("openapi/coolify-openapi.json", "utf8");
  const manifest = JSON.parse(await readFile("api/manifest.json", "utf8")) as Manifest;
  verifySnapshot(snapshot, manifest);
  console.error("OpenAPI snapshot verified offline");
}
