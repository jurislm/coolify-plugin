import { mkdir, readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { jsonSchemaToZod } from "json-schema-to-zod";
import YAML from "yaml";

type JsonObject = Record<string, any>;
type OpenApiDocument = { paths?: Record<string, JsonObject>; components?: { schemas?: Record<string, JsonObject> } };
const inputPath = "openapi/coolify-openapi.json";
const outputDir = "src/generated";
const methods = new Set(["get", "put", "post", "delete", "patch", "head", "options", "trace"]);
const raw = await readFile(inputPath, "utf8");
const document = YAML.parse(raw) as OpenApiDocument;
const schemas = document.components?.schemas ?? {};
await mkdir(outputDir, { recursive: true });

const types = spawnSync("bunx", ["openapi-typescript", inputPath, "-o", `${outputDir}/coolify-api.ts`], { encoding: "utf8" });
if (types.status !== 0) throw new Error(`openapi-typescript failed:\n${types.stdout}\n${types.stderr}`);

function dereference(value: any, seen = new Set<string>()): any {
  if (Array.isArray(value)) return value.map((item) => dereference(item, seen));
  if (!value || typeof value !== "object") return value;
  if (typeof value.$ref === "string" && value.$ref.startsWith("#/components/schemas/")) {
    const name = value.$ref.slice("#/components/schemas/".length);
    return seen.has(name) ? {} : dereference(schemas[name] ?? {}, new Set([...seen, name]));
  }
  const result: JsonObject = {};
  for (const [key, child] of Object.entries(value)) if (key !== "$ref") result[key] = dereference(child, seen);
  if (result.format === "uuid") delete result.format;
  if (result.nullable === true) return { anyOf: [Object.fromEntries(Object.entries(result).filter(([key]) => key !== "nullable")), { type: "null" }] };
  return result;
}

function schemaText(schema: any, optional = false): string {
  if (!schema) return "z.unknown()";
  try {
    const result = jsonSchemaToZod(dereference(schema), { noImport: true }).trim();
    return optional && schema.default === undefined && !result.endsWith(".optional()") ? `${result}.optional()` : result;
  } catch {
    return "z.unknown()";
  }
}

function quote(value: string): string { return JSON.stringify(value); }
function toolName(operation: JsonObject, method: string, path: string, used: Set<string>): string {
  let name = `coolify_${String(operation.operationId ?? `${method}_${path}`)}`.replace(/[^a-zA-Z0-9]+/gu, "_").replace(/^_|_$/gu, "").toLowerCase();
  const base = name;
  for (let index = 2; used.has(name); index++) name = `${base}_${index}`;
  return name;
}
function responseInfo(operation: JsonObject): { schema: string; kind: string } {
  const response = Object.entries(operation.responses ?? {}).find(([status]) => /^2\d\d$/u.test(status))?.[1] as JsonObject | undefined;
  const content = response?.content ?? {};
  const contentType = Object.keys(content)[0];
  if (!contentType) return { schema: "z.null()", kind: "empty" };
  if (contentType.includes("json")) return { schema: schemaText(content[contentType]?.schema), kind: "json" };
  if (contentType.startsWith("text/") || contentType.includes("xml")) return { schema: "z.string()", kind: "text" };
  return { schema: "z.object({ encoding: z.literal(\"base64\"), contentType: z.string(), value: z.string() })", kind: "binary" };
}

const operations: string[] = [];
const usedNames = new Set<string>();
for (const [path, pathItem] of Object.entries(document.paths ?? {})) {
  for (const [method, value] of Object.entries(pathItem)) {
    if (!methods.has(method)) continue;
    const operation = value as JsonObject;
    const parameters = [...(pathItem.parameters ?? []), ...(operation.parameters ?? [])] as JsonObject[];
    const properties: string[] = [];
    const parameterMeta: string[] = [];
    for (const parameter of parameters) {
      if (parameter.in === "header") continue;
      properties.push(`${quote(String(parameter.name))}: ${schemaText(parameter.schema ?? { type: "string" }, !parameter.required)}`);
      parameterMeta.push(`{ location: ${quote(parameter.in)}, name: ${quote(String(parameter.name))} }`);
    }
    const requestBody = operation.requestBody as JsonObject | undefined;
    const bodyContent = requestBody?.content ?? {};
    const bodyType = Object.keys(bodyContent)[0];
    if (bodyType) {
      const bodySchema = bodyContent[bodyType]?.schema;
      let bodyText = schemaText(bodySchema, !requestBody.required);
      const requireAny = bodySchema?.["x-require-any"] as string[] | undefined;
      if (requireAny?.length) bodyText += `.refine((body) => ${requireAny.map((key) => `Boolean(body[${quote(key)}])`).join(" || ")}, { message: ${quote(`At least one of ${requireAny.join(", ")} is required`)} })`;
      properties.push(`body: ${bodyText}`);
    }
    const name = toolName(operation, method, path, usedNames);
    usedNames.add(name);
    const response = responseInfo(operation);
    const summary = String(operation.summary ?? operation.operationId ?? `${method.toUpperCase()} ${path}`);
    const destructive = method === "delete" || /delete|reset|revoke|remove|destroy/iu.test(summary);
    const idempotent = ["get", "head", "put", "delete", "options"].includes(method);
    operations.push(`  { name: ${quote(name)}, method: ${quote(method.toUpperCase())}, path: ${quote(path)}, description: ${quote(summary)}, inputSchema: z.object({ ${properties.join(", ")} }), responseSchema: ${response.schema}, responseKind: ${quote(response.kind)}, parameters: [${parameterMeta.join(", ")}], annotations: { readOnlyHint: ${method === "get" || method === "head"}, destructiveHint: ${destructive}, idempotentHint: ${idempotent}, openWorldHint: false } }`);
  }
}

await Bun.write(`${outputDir}/coolify-zod.ts`, ["// Generated by scripts/generate-openapi.ts.", 'import { z } from "zod";', "", "export const componentSchemas = {", ...Object.entries(schemas).map(([name, schema]) => `  ${quote(name)}: ${schemaText(schema)},`), "} as const;", ""].join("\n"));
await Bun.write(`${outputDir}/operations.ts`, ["// Generated by scripts/generate-openapi.ts.", 'import { z } from "zod";', "", "export type GeneratedOperation = { name: string; method: string; path: string; description: string; inputSchema: z.ZodType; responseSchema: z.ZodType; responseKind: string; parameters: Array<{ location: string; name: string }>; annotations: { readOnlyHint: boolean; destructiveHint: boolean; idempotentHint: boolean; openWorldHint: boolean } };", "", "export const operations: GeneratedOperation[] = [", operations.join(",\n"), "];", ""].join("\n"));
console.error(`Generated ${operations.length} Coolify operations`);
