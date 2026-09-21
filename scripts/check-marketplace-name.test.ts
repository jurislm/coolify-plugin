import { expect, test } from "bun:test";

const marketplace = await Bun.file(".agents/plugins/marketplace.json").json() as {
  name: string;
  plugins: Array<{ name: string }>;
};
const portableManifest = await Bun.file("plugin.json").json() as Record<string, unknown>;

test("uses a provider-owned marketplace without changing plugin identity", () => {
  expect(marketplace.name).toBe("coolify-marketplace");
  expect(marketplace.plugins).toHaveLength(1);
  expect(marketplace.plugins[0]?.name).toBe("coolify-plugin");
});

test("keeps portable component discovery on fixed root paths", () => {
  expect("skills" in portableManifest).toBe(false);
  expect("mcpServers" in portableManifest).toBe(false);
});
