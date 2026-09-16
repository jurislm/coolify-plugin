export function checkReleaseTag(version: string, tag: string | undefined): void {
  const expected = `v${version}`;
  if (tag !== expected) throw new Error(`CI_COMMIT_TAG must be ${expected}; received ${tag ?? "unset"}`);
}

if (import.meta.main) {
  const packageJson = JSON.parse(await Bun.file("package.json").text()) as { version: string };
  checkReleaseTag(packageJson.version, process.env.CI_COMMIT_TAG);
  console.error(`Release tag verified: v${packageJson.version}`);
}
