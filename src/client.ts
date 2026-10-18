import type { GeneratedOperation } from "./generated/operations.js";
import type { CoolifyConfig } from "./config.js";
import { CoolifyApiError, redactErrorText } from "./errors.js";

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
type Scalar = string | number | boolean | null | undefined;
type Operation = Pick<GeneratedOperation, "method" | "path" | "parameters">;
const sensitiveKey = /(^value$|real_?value|private_?key|api_?key|user_?key|webhook_?url|token|secret|password|authorization|cookie)/iu;
const composeKey = /^(docker_compose(_pr)?(_raw)?|configuration)$/u;
const composeSecretName = /(password|passwd|secret|token|private|credential|api_?key|access_?key)/iu;
const composeSecretSegment = /(^|[_.-])(key|pass|pwd)($|[_.-])/iu;
const interpolation = /^\$\{?[A-Za-z_][A-Za-z0-9_]*\}?$/u;
const urlCredential = /([a-z][a-z0-9+.-]*:\/\/[^\s:/@]*):([^\s/@]+)@/giu;
const listAssignment = /^(\s*-\s+)(["']?)([\w.-]+)=(.*?)\2\s*$/u;
const mapAssignment = /^(\s*(?:-\s+)?)(["']?)([\w.-]+)\2:\s+(.+?)\s*$/u;
const blockScalar = /^[|>][-+0-9]*(\s+#.*)?$/u;
const base64Text = /^[A-Za-z0-9+/]+={0,2}$/u;

function indentOf(line: string): number { return line.length - line.trimStart().length; }

function isComposeSecret(name: string, value: string): boolean {
  const bare = value.replace(/^(["'])(.*)\1$/u, "$2");
  return (composeSecretName.test(name) || composeSecretSegment.test(name)) && bare.trim() !== "" && !interpolation.test(bare);
}

function redactUrlCredentials(text: string): string {
  return text.replace(urlCredential, (match: string, prefix: string, password: string) => interpolation.test(password) ? match : `${prefix}:[REDACTED]@`);
}

function redactComposeYaml(text: string): string {
  const output: string[] = [];
  let blockIndent: number | undefined;
  for (const line of text.split("\n")) {
    if (blockIndent !== undefined) {
      if (line.trim() === "") { output.push(line); continue; }
      if (indentOf(line) > blockIndent) continue;
      blockIndent = undefined;
    }
    const list = listAssignment.exec(line);
    if (list && isComposeSecret(list[3], list[4])) {
      output.push(`${list[1]}${list[2]}${list[3]}=[REDACTED]${list[2]}`);
      continue;
    }
    const map = mapAssignment.exec(line);
    if (map && isComposeSecret(map[3], map[4])) {
      if (blockScalar.test(map[4])) blockIndent = indentOf(line);
      output.push(`${map[1]}${map[2]}${map[3]}${map[2]}: [REDACTED]`);
      continue;
    }
    output.push(redactUrlCredentials(line));
  }
  return output.join("\n");
}

function decodeBase64Text(text: string): string | undefined {
  if (text.length % 4 !== 0 || !base64Text.test(text)) return undefined;
  const bytes = Buffer.from(text, "base64");
  if (bytes.toString("base64") !== text) return undefined;
  try {
    const decoded = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return /[\n:]/u.test(decoded) ? decoded : undefined;
  } catch {
    return undefined;
  }
}

function redactComposeText(text: string): string {
  const decoded = decodeBase64Text(text);
  return decoded === undefined ? redactComposeYaml(text) : Buffer.from(redactComposeYaml(decoded), "utf8").toString("base64");
}

export function redactSensitive<T>(value: T): T {
  if (typeof value === "string") return redactUrlCredentials(value) as T;
  if (Array.isArray(value)) return value.map(redactSensitive) as T;
  if (!value || typeof value !== "object") return value;
  const binary = (value as Partial<BinaryEnvelope>).encoding === "base64" && typeof (value as Partial<BinaryEnvelope>).contentType === "string" && typeof (value as Partial<BinaryEnvelope>).value === "string";
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, child]) => [
    key,
    sensitiveKey.test(key) && !(binary && key === "value") ? "[REDACTED]" : composeKey.test(key) && typeof child === "string" ? redactComposeText(child) : redactSensitive(child),
  ])) as T;
}

function pathValue(value: unknown, name: string): string {
  if (value === undefined || value === null) throw new Error(`Missing required path parameter: ${name}`);
  return encodeURIComponent(stringifyScalar(value as Scalar));
}

function stringifyScalar(value: Scalar): string { return String(value); }

function appendQuery(url: URL, name: string, value: unknown): void {
  if (value === undefined || value === null) return;
  if (Array.isArray(value)) for (const item of value) url.searchParams.append(name, stringifyScalar(item as Scalar));
  else url.searchParams.set(name, typeof value === "object" ? JSON.stringify(value) : stringifyScalar(value as Scalar));
}

function base64(bytes: ArrayBuffer): string {
  let text = "";
  for (const byte of new Uint8Array(bytes)) text += String.fromCharCode(byte);
  return btoa(text);
}

export class CoolifyClient {
  constructor(private readonly config: CoolifyConfig, private readonly fetchImpl: FetchLike = fetch) {}

  async request<T>(operation: Operation, input: Record<string, unknown>): Promise<ToolEnvelope<T | null | string | BinaryEnvelope>> {
    const baseUrl = this.config.baseUrl;
    if (!baseUrl) throw new CoolifyApiError(0, operation.method, operation.path, "COOLIFY_BASE_URL is required");
    const token = this.config.token;
    if (!token && !(operation.method === "GET" && operation.path === "/health")) throw new CoolifyApiError(0, operation.method, operation.path, "COOLIFY_ACCESS_TOKEN is required");
    let path = operation.path;
    for (const parameter of operation.parameters) if (parameter.location === "path") {
      path = path.replace(`{${parameter.name}}`, pathValue(input[parameter.name], parameter.name));
    }
    if (path.includes("{")) throw new Error(`Unresolved path parameter in ${operation.path}`);
    const url = new URL(baseUrl + path);
    for (const parameter of operation.parameters) if (parameter.location === "query") appendQuery(url, parameter.name, input[parameter.name]);
    const headers = new Headers({ accept: "application/json, text/plain, */*" });
    if (token) headers.set("authorization", `Bearer ${token}`);
    const init: RequestInit = { method: operation.method, headers, signal: AbortSignal.timeout(this.config.timeoutMs) };
    if (input.body !== undefined && !["GET", "HEAD"].includes(operation.method)) {
      headers.set("content-type", "application/json");
      const body = input.body as Record<string, unknown>;
      init.body = JSON.stringify(operation.path === "/applications/dockerfile" && typeof body.dockerfile === "string"
        ? { ...body, dockerfile: Buffer.from(body.dockerfile, "utf8").toString("base64") }
        : body);
    }

    let response: Response;
    try {
      response = await this.fetchImpl(url, init);
    } catch (error) {
      const cause = error instanceof Error ? error.message : "request error";
      throw new CoolifyApiError(0, operation.method, path, `Coolify request failed for ${operation.method} ${path}: ${redactErrorText(cause, [token])}`);
    }
    if (!response.ok) {
      let fields = "";
      if (response.status === 422) {
        try {
          const body = await response.json() as Record<string, unknown>;
          const errors = body?.errors;
          if (errors && typeof errors === "object" && !Array.isArray(errors)) {
            fields = Object.keys(errors).filter((key) => /^[a-z][a-z0-9_.-]{0,63}$/iu.test(key)).slice(0, 8).map((key) => token ? key.replaceAll(token, "[REDACTED]") : key).join(", ");
          }
        } catch { fields = ""; }
      }
      throw new CoolifyApiError(response.status, operation.method, path, `Coolify API returned ${response.status} for ${operation.method} ${path}${fields ? `; fields: ${fields}` : ""}`);
    }

    let data: T | null | string | BinaryEnvelope = null;
    try {
      if (response.status !== 204) {
        const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
        if (contentType.includes("json")) data = await response.json() as T;
        else if (contentType.startsWith("text/") || contentType.includes("xml")) data = await response.text();
        else data = { encoding: "base64", contentType: contentType || "application/octet-stream", value: base64(await response.arrayBuffer()) };
      }
    } catch {
      throw new Error("Coolify API returned an unreadable response body");
    }
    return redactSensitive({ data, status: response.status, request: { method: operation.method, path } });
  }
}

export { CoolifyApiError };
