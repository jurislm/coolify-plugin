import type { GeneratedOperation } from "./generated/operations.js";
import type { CoolifyConfig } from "./config.js";
import { CoolifyApiError } from "./errors.js";

export interface ToolEnvelope<T> {
  data: T;
  status: number;
  request: { method: string; path: string };
}

export interface BinaryEnvelope {
  encoding: "base64";
  contentType: string;
  value: string;
}

export type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
type Operation = Pick<GeneratedOperation, "method" | "path" | "parameters">;
const sensitiveKey = /(^value$|real_?value|private_?key|token|secret|password|authorization|cookie)/iu;

export function redactSensitive<T>(value: T): T {
  if (Array.isArray(value)) return value.map(redactSensitive) as T;
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, child]) => [
    key,
    sensitiveKey.test(key) ? "[REDACTED]" : redactSensitive(child),
  ])) as T;
}

function pathValue(value: unknown, name: string): string {
  if (value === undefined || value === null) throw new Error(`Missing required path parameter: ${name}`);
  return encodeURIComponent(String(value));
}

function appendQuery(url: URL, name: string, value: unknown): void {
  if (value === undefined || value === null) return;
  if (Array.isArray(value)) for (const item of value) url.searchParams.append(name, String(item));
  else url.searchParams.set(name, typeof value === "object" ? JSON.stringify(value) : String(value));
}

function base64(bytes: ArrayBuffer): string {
  let text = "";
  for (const byte of new Uint8Array(bytes)) text += String.fromCharCode(byte);
  return btoa(text);
}

function normalizeKnownCollection(path: string, value: unknown): unknown {
  const collectionPaths = new Set(["/databases", "/resources", "/deployments", "/deployments/applications/{uuid}"]);
  if (!collectionPaths.has(path)) return value;
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== "object") throw new Error(`Coolify collection response for ${path} must be an array or named array wrapper`);
  for (const key of ["data", "items", "results", "databases", "resources", "deployments"]) {
    const nested = (value as Record<string, unknown>)[key];
    if (Array.isArray(nested)) return nested;
  }
  throw new Error(`Coolify collection response for ${path} must be an array or named array wrapper`);
}

export class CoolifyClient {
  constructor(private readonly config: CoolifyConfig, private readonly fetchImpl: FetchLike = fetch) {}

  async request<T>(operation: Operation, input: Record<string, unknown>): Promise<ToolEnvelope<T | null | string | BinaryEnvelope>> {
    const baseUrl = this.config.baseUrl;
    if (!baseUrl) throw new CoolifyApiError(0, operation.method, operation.path, "COOLIFY_URL is required");
    const token = this.config.token;
    if (!token) throw new CoolifyApiError(0, operation.method, operation.path, "COOLIFY_TOKEN is required");
    let path = operation.path;
    for (const parameter of operation.parameters) if (parameter.location === "path") {
      path = path.replace(`{${parameter.name}}`, pathValue(input[parameter.name], parameter.name));
    }
    if (path.includes("{")) throw new Error(`Unresolved path parameter in ${operation.path}`);
    const url = new URL(baseUrl + path);
    for (const parameter of operation.parameters) if (parameter.location === "query") appendQuery(url, parameter.name, input[parameter.name]);
    const headers = new Headers({ accept: "application/json, text/plain, */*", authorization: `Bearer ${token}` });
    const init: RequestInit = { method: operation.method, headers, signal: AbortSignal.timeout(this.config.timeoutMs) };
    if (input.body !== undefined && !["GET", "HEAD"].includes(operation.method)) {
      headers.set("content-type", "application/json");
      init.body = JSON.stringify(input.body);
    }

    let response: Response;
    try {
      response = await this.fetchImpl(url, init);
    } catch (error) {
      throw new CoolifyApiError(0, operation.method, path, `Coolify request failed for ${operation.method} ${path}: ${error instanceof Error ? error.message.replaceAll(token, "[REDACTED]") : "request error"}`);
    }
    if (!response.ok) throw new CoolifyApiError(response.status, operation.method, path, `Coolify API returned ${response.status} for ${operation.method} ${path}`);

    let data: T | null | string | BinaryEnvelope = null;
    if (response.status !== 204) {
      const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
      if (contentType.includes("json")) data = normalizeKnownCollection(operation.path, await response.json()) as T;
      else if (contentType.startsWith("text/") || contentType.includes("xml")) data = await response.text();
      else data = { encoding: "base64", contentType: contentType || "application/octet-stream", value: base64(await response.arrayBuffer()) };
    }
    return redactSensitive({ data, status: response.status, request: { method: operation.method, path } });
  }
}

export { CoolifyApiError };
