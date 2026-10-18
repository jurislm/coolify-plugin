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
const envValueKey = /^(value|real_value)$/u;
const envPath = /\/envs(\/|$)/u;
const renderedComposeKey = "docker_compose";
const interpolation = /^\$\{?[A-Za-z_][A-Za-z0-9_]*\}?$/u;
const urlCredential = /([a-z][a-z0-9+.-]{0,31}:\/\/[^\s:/@]{0,256}):([^\s/?#]{1,256})@/giu;
const queryParameter = /([?&])([^=&#?\s"']{1,64})=([^&#\s"']+)/gu;
const querySecretSegments = new Set(["password", "passwd", "pass", "pwd", "secret", "token", "auth", "sig", "signature", "credential", "credentials", "apikey", "key"]);
const querySecretName = /(password|passwd|secret|token|api_?key|access_?key)/iu;

function redactUrlCredentials(text: string): string {
  return text
    .replace(urlCredential, (match: string, prefix: string, password: string) => interpolation.test(password) ? match : `${prefix}:[REDACTED]@`)
    .replace(queryParameter, (match: string, separator: string, name: string, value: string) => value !== "[REDACTED]" && isQuerySecret(name) ? `${separator}${name}=[REDACTED]` : match);
}

function isQuerySecret(name: string): boolean {
  return querySecretName.test(name) || name.toLowerCase().split(/[_.-]/u).some((segment) => querySecretSegments.has(segment));
}

function withoutTokens(text: string, tokens: Array<string | undefined>): string {
  return tokens.reduce<string>((redacted, token) => token ? redacted.replaceAll(token, "[REDACTED]") : redacted, text);
}

export function isEnvOperation(path: string): boolean {
  return envPath.test(path);
}

export function redactSensitive<T>(value: T, tokens: Array<string | undefined> = [], envResponse = false): T {
  if (typeof value === "string") return withoutTokens(redactUrlCredentials(value), tokens) as T;
  if (Array.isArray(value)) return (value as unknown[]).map((item) => redactSensitive(item, tokens, envResponse)) as T;
  if (!value || typeof value !== "object") return value;
  const binary = (value as Partial<BinaryEnvelope>).encoding === "base64" && typeof (value as Partial<BinaryEnvelope>).contentType === "string" && typeof (value as Partial<BinaryEnvelope>).value === "string";
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).filter(([key]) => key !== renderedComposeKey).map(([key, child]) => [key, redactField(key, child, tokens, envResponse, binary)])) as T;
}

function redactField(key: string, child: unknown, tokens: Array<string | undefined>, envResponse: boolean, binary: boolean): unknown {
  if (binary && key === "value") return child;
  if (envResponse && envValueKey.test(key)) return typeof child === "string" ? withoutTokens(child, tokens) : child;
  if (sensitiveKey.test(key)) return "[REDACTED]";
  return redactSensitive(child, tokens, envResponse);
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
    return redactSensitive({ data, status: response.status, request: { method: operation.method, path } }, [token], isEnvOperation(operation.path));
  }
}

export { CoolifyApiError };
