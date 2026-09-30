#!/usr/bin/env bun

import { ConfigError, loadConfig } from "./config.js";
import { createServer } from "./server.js";
import { createStdioTransport } from "./transports/stdio.js";

try {
  const config = loadConfig();
  if (process.argv.includes("--require-config") && (!config.baseUrl || !config.token)) throw new ConfigError("A complete URL/token pair is required for the selected Coolify configuration");
  await createServer(config).connect(createStdioTransport());
} catch (error) {
  console.error(`Coolify MCP server failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
