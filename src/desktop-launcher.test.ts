import { expect, test } from "bun:test";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const initialize = '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-11-25","capabilities":{},"clientInfo":{"name":"fixture","version":"1"}}}\n';

test.each([
  {},
  { COOLIFY_BASE_URL: "https://canonical.example", CURSOR_COOLIFY_ACCESS_TOKEN: "fixture-cursor" },
  { COOLIFY_CLOUD_BASE_URL: "https://cloud.example", COOLIFY_BASE_URL: "https://canonical.example", COOLIFY_ACCESS_TOKEN: "fixture-canonical" },
])("opt-in startup rejects missing or mixed selected credentials: %j", (environment) => {
  const result = Bun.spawnSync([process.execPath, resolve("src/index.ts"), "--require-config"], { env: { PATH: "/usr/bin:/bin", ...environment }, stdin: Buffer.from(initialize), stdout: "pipe", stderr: "pipe" });
  expect(result.exitCode).toBe(1);
  expect(result.stdout.length).toBe(0);
  expect(new TextDecoder().decode(result.stderr)).toContain("complete URL/token pair");
  expect(new TextDecoder().decode(result.stderr)).not.toContain("fixture-");
});

function launch(startup: string, environment: Record<string, string | undefined> = {}) {
  const fixtureHome = mkdtempSync(join(tmpdir(), "coolify-desktop-"));
  try {
    const bin = join(fixtureHome, ".bun/bin");
    const startupDirectory = join(fixtureHome, "startup");
    mkdirSync(bin, { recursive: true });
    mkdirSync(startupDirectory);
    writeFileSync(join(fixtureHome, ".zshenv"), "return 88\n");
    writeFileSync(join(startupDirectory, ".zshenv"), startup);
    const executable = join(bin, "bunx");
    writeFileSync(executable, `#!/bin/sh\n[ "$1" = -y ] || exit 11\n[ "$2" = @jurislm/coolify-plugin@latest ] || exit 12\n[ "$3" = --require-config ] || exit 13\n[ "$PATH" = "$HOME/.bun/bin:/usr/bin:/bin" ] || exit 14\n[ -z "\${UNRELATED_SECRET+x}" ] || exit 15\n[ -z "\${PARENT_SECRET+x}" ] || exit 16\n[ -z "\${ZDOTDIR+x}" ] || exit 17\nexec '${process.execPath}' '${resolve("src/index.ts")}' --require-config\n`);
    chmodSync(executable, 0o700);
    const result = Bun.spawnSync(["/bin/zsh", "-f", resolve("launchers/coolify-desktop.zsh")], {
      env: { HOME: fixtureHome, ZDOTDIR: startupDirectory, PATH: "/usr/bin:/bin", LANG: "C", PARENT_SECRET: "fixture-parent", ...environment }, stdin: Buffer.from(initialize), stdout: "pipe", stderr: "pipe",
    });
    return { code: result.exitCode, output: new TextDecoder().decode(result.stdout), error: new TextDecoder().decode(result.stderr), startupRan: existsSync(join(fixtureHome, "startup-ran")) };
  } finally {
    rmSync(fixtureHome, { recursive: true, force: true });
  }
}

test("desktop launcher sources startup settings and preserves only stdio and supported variables", () => {
  const result = launch("print -r -- startup-banner\nprint -u2 -- startup-diagnostic\nexport COOLIFY_BASE_URL=' https://canonical.example/ '\nexport COOLIFY_ACCESS_TOKEN=' fixture-canonical '\nexport UNRELATED_SECRET=fixture-unrelated\n");
  expect(result.code).toBe(0);
  expect(JSON.parse(result.output).result.serverInfo.name).toBe("coolify-plugin");
  expect(result.error).toBe("startup-diagnostic\n");
  expect(result.output).not.toContain("startup-banner");
  expect(result.output).not.toContain("fixture-");
});

test.each([
  { CURSOR_COOLIFY_BASE_URL: "https://cursor.example", CURSOR_COOLIFY_ACCESS_TOKEN: "fixture-cursor" },
  { CURSOR_COOLIFY_BASE_URL: "https://cursor.example", COOLIFY_BASE_URL: "https://canonical.example", COOLIFY_ACCESS_TOKEN: "fixture-canonical" },
  { COOLIFY_CLOUD_BASE_URL: "https://cloud.example", COOLIFY_CLOUD_ACCESS_TOKEN: "fixture-cloud" },
  { CURSOR_COOLIFY_BASE_URL: "${COOLIFY_BASE_URL}", CURSOR_COOLIFY_ACCESS_TOKEN: "${COOLIFY_ACCESS_TOKEN}", COOLIFY_BASE_URL: "https://canonical.example", COOLIFY_ACCESS_TOKEN: "fixture-canonical" },
])("desktop launcher preserves supported pair selection: %j", (environment) => {
  const result = launch("print -r -- startup-banner\n", environment);
  expect(result.code).toBe(0);
  expect(JSON.parse(result.output).result.serverInfo.name).toBe("coolify-plugin");
});

test("desktop launcher stops after startup failure even with inherited complete credentials", () => {
  const result = launch("print -u2 -- startup-failure\nreturn 12\n", { COOLIFY_BASE_URL: "https://canonical.example", COOLIFY_ACCESS_TOKEN: "fixture-canonical" });
  expect(result).toMatchObject({ code: 12, output: "", error: "startup-failure\n" });
});

test("desktop launcher permits a benign final optional guard with complete credentials", () => {
  const result = launch('export COOLIFY_BASE_URL=https://canonical.example\nexport COOLIFY_ACCESS_TOKEN=fixture-canonical\n[[ -n ${OPTIONAL_FIXTURE:-} ]] && export OPTIONAL_FIXTURE\n');
  expect(result.code).toBe(0);
  expect(JSON.parse(result.output).result.serverInfo.name).toBe("coolify-plugin");
});

test("desktop launcher rejects bad startup syntax before executing any startup command", () => {
  const result = launch(': > "$HOME/startup-ran"\nif ; then\n', { COOLIFY_BASE_URL: "https://canonical.example", COOLIFY_ACCESS_TOKEN: "fixture-canonical" });
  expect(result.code).not.toBe(0);
  expect(result.output).toBe("");
  expect(result.startupRan).toBe(false);
});
