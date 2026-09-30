export class CoolifyApiError extends Error {
  constructor(
    readonly status: number,
    readonly method: string,
    readonly path: string,
    message: string,
  ) {
    super(message);
    this.name = "CoolifyApiError";
  }
}

export function redactErrorText(message: string, tokens: Array<string | undefined> = []): string {
  let redacted = message;
  for (const token of tokens) if (token) redacted = redacted.replaceAll(token, "[REDACTED]");
  return redacted.replace(/Bearer\s+[^\s,;]+/giu, "Bearer [REDACTED]");
}

export function errorMessage(error: unknown, tokens: Array<string | undefined> = []): string {
  return redactErrorText(error instanceof Error ? error.message : String(error), tokens);
}

export function formatToolError(error: unknown, tokens: Array<string | undefined>) {
  return error instanceof CoolifyApiError
    ? { code: "COOLIFY_API_ERROR", status: error.status, method: error.method, path: error.path, message: errorMessage(error, tokens) }
    : { code: "COOLIFY_TOOL_ERROR", message: errorMessage(error, tokens) };
}
