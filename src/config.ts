export interface CoolifyConfig {
  baseUrl?: string;
  token?: string;
  timeoutMs: number;
}

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

function environmentValue(env: Record<string, string | undefined>, name: string, alias?: string): string | undefined {
  const value = env[name]?.trim();
  return value === `\${${name}}` || (alias && value === `\${${alias}}`) ? undefined : value;
}

export function loadConfig(env: Record<string, string | undefined> = process.env): CoolifyConfig {
  const cloudUrl = environmentValue(env, "COOLIFY_CLOUD_BASE_URL");
  const cloudToken = environmentValue(env, "COOLIFY_CLOUD_ACCESS_TOKEN");
  const useCloud = Boolean(cloudUrl || cloudToken);
  const configureUrl = environmentValue(env, "CURSOR_COOLIFY_BASE_URL", "COOLIFY_BASE_URL");
  const configureToken = environmentValue(env, "CURSOR_COOLIFY_ACCESS_TOKEN", "COOLIFY_ACCESS_TOKEN");
  const useConfigure = Boolean(configureUrl || configureToken);
  const canonicalUrl = environmentValue(env, "COOLIFY_BASE_URL");
  const canonicalToken = environmentValue(env, "COOLIFY_ACCESS_TOKEN");
  const rawUrl = useCloud ? cloudUrl : useConfigure ? configureUrl : canonicalUrl;
  const token = useCloud ? cloudToken : useConfigure ? configureToken : canonicalToken;

  if (!rawUrl) return { ...(token ? { token } : {}), timeoutMs: 30_000 };

  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new ConfigError("COOLIFY_BASE_URL must be a valid HTTP(S) URL");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new ConfigError("COOLIFY_BASE_URL must use http:// or https://");
  }
  if (url.search || url.hash) throw new ConfigError("COOLIFY_BASE_URL must not include a query or fragment");
  url.pathname = url.pathname.replace(/\/+$/u, "");
  if (!url.pathname.endsWith("/api/v1")) url.pathname = `${url.pathname}/api/v1`.replace(/^\/\//u, "/");

  return { baseUrl: url.toString().replace(/\/$/u, ""), ...(token ? { token } : {}), timeoutMs: 30_000 };
}
