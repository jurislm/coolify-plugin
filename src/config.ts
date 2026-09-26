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

function cursorValue(env: Record<string, string | undefined>, name: string, cursorName: string): string | undefined {
  const cursor = env[cursorName]?.trim();
  return cursor === `\${${name}}` ? undefined : cursor;
}

export function loadConfig(env: Record<string, string | undefined> = process.env): CoolifyConfig {
  const cloudUrl = env.COOLIFY_BASE_URL?.trim();
  const cloudToken = env.COOLIFY_ACCESS_TOKEN?.trim();
  const useCloud = Boolean(cloudUrl || cloudToken);
  const rawUrl = useCloud ? cloudUrl : cursorValue(env, "COOLIFY_BASE_URL", "CURSOR_COOLIFY_BASE_URL");
  const token = useCloud ? cloudToken : cursorValue(env, "COOLIFY_ACCESS_TOKEN", "CURSOR_COOLIFY_ACCESS_TOKEN");

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
