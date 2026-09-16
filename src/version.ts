import { readFileSync } from "node:fs";

export const pluginVersion = (JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version: string }).version;
