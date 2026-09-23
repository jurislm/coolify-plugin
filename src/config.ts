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

export function loadConfig(env: Record<string, string | undefined> = process.env): CoolifyConfig {
  const rawUrl = env.COOLIFY_BASE_URL?.trim();
  const token = env.COOLIFY_ACCESS_TOKEN?.trim();

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
