#!/usr/bin/env bun

import { loadConfig } from "./config.js";
import { createServer } from "./server.js";
import { createStdioTransport } from "./transports/stdio.js";

try {
  await createServer(loadConfig()).connect(createStdioTransport());
} catch (error) {
  console.error(`Coolify MCP server failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
