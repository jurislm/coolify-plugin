import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ciMetadataValue } from "./ci-metadata.js";
import { parseReleaseRepository, releaseRepoId } from "./release-repository.js";

export async function runReleasePlease(
  mode: string | undefined,
  token: string | undefined,
  expectedSha: string | undefined,
  request: typeof fetch,
  run: (args: string[]) => Promise<number>,
): Promise<void> {
  if (mode !== "github-release" && mode !== "release-pr") throw new Error("Unsupported release mode");
  if (!token) throw new Error("GITHUB_API_TOKEN is required");
  if (!expectedSha || !/^[a-f0-9]{40}$/.test(expectedSha)) throw new Error("Woodpecker commit SHA is required");
  async function readGitHub(path: string): Promise<unknown> {
    let response: Response;
    try {
      response = await request(`https://api.github.com${path}`, {
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${token}`,
          "X-GitHub-Api-Version": "2022-11-28",
        },
        redirect: "error",
        signal: AbortSignal.timeout(15000),
      });
    } catch {
      throw new Error("GitHub release preflight failed");
    }
    if (!response.ok || response.redirected) throw new Error("GitHub release preflight failed");
    return response.json().catch(() => null);
  }
  const repository = parseReleaseRepository(await readGitHub(`/repositories/${releaseRepoId}`));
  let temporary: string | undefined;
  try {
    let tokenPath: string;
    try {
      temporary = await mkdtemp(join(tmpdir(), "coolify-release-"));
      tokenPath = join(temporary, "token");
      await writeFile(tokenPath, token, { flag: "wx", mode: 0o600 });
    } catch {
      throw new Error("Release Please credential setup failed");
    }
    const canonical = parseReleaseRepository(await readGitHub(`/repos/${repository.fullName}`));
    if (canonical.fullName !== repository.fullName) throw new Error("GitHub release repository identity mismatch");
    const ref = await readGitHub(`/repos/${repository.fullName}/git/ref/heads/main`);
    const currentSha = (ref as { object?: { sha?: unknown } } | null)?.object?.sha;
    if (typeof currentSha !== "string" || !/^[a-f0-9]{40}$/.test(currentSha))
      throw new Error("GitHub release main SHA is invalid");
    if (currentSha !== expectedSha) return;
    let code: number;
    try {
      code = await run([
        "bunx", "release-please", mode,
        `--token=${tokenPath}`, `--repo-url=https://github.com/${repository.fullName}`,
        "--target-branch=main", "--config-file=release-please-config.json",
        "--manifest-file=.release-please-manifest.json",
      ]);
    } catch {
      throw new Error(`Release Please failed: ${mode}`);
    }
    if (code !== 0) throw new Error(`Release Please failed: ${mode}`);
  } finally {
    if (temporary) await rm(temporary, { recursive: true, force: true })
      .catch(() => { throw new Error("Release Please credential cleanup failed"); });
  }
}

export async function spawnReleasePlease(
  args: string[],
  token: string | undefined,
  write: (stdout: string, stderr: string) => void,
): Promise<number> {
  const env = Object.fromEntries(Object.entries(process.env).filter(([name]) => name !== "GITHUB_API_TOKEN"));
  const child = Bun.spawn(args, { env, stdout: "pipe", stderr: "pipe" });
  const [stdout, stderr, code] = await Promise.all([
    new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited,
  ]);
  const redact = (output: string) => token ? output.replaceAll(token, "[REDACTED]") : output;
  write(redact(stdout), redact(stderr));
  return code;
}

if (import.meta.main) {
  try {
    const token = process.env.GITHUB_API_TOKEN;
    await runReleasePlease(process.argv[2], token, ciMetadataValue("CI_COMMIT_SHA"), fetch, (args) => spawnReleasePlease(args, token, (stdout, stderr) => {
      process.stdout.write(stdout);
      process.stderr.write(stderr);
    }));
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Release failed");
    process.exitCode = 1;
  }
}
