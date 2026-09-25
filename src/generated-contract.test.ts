import { expect, test } from "bun:test";
import { operations } from "./generated/operations.js";

test("generated operations match the pinned Coolify manifest", async () => {
  const manifest = JSON.parse(await Bun.file("api/manifest.json").text()) as { operationCount: number; openapiVersion: string; infoVersion: string };
  expect(operations).toHaveLength(manifest.operationCount);
  expect(operations).toHaveLength(276);
  expect(operations.every((operation) => operation.name.startsWith("coolify_") && operation.path.startsWith("/"))).toBe(true);
  expect(manifest.openapiVersion).toBe("3.1.0");
  expect(manifest.infoVersion).toBe("0.1");
  const fallback = JSON.parse(await Bun.file(".codex-plugin/plugin.json").text()) as { mcpServers?: string; apps?: string };
  expect(fallback.mcpServers).toBe("./.mcp.json");
  expect(fallback.apps).toBeUndefined();
});

test("exposes the official server validation operation", () => {
  const operation = operations.find((item) => item.path === "/servers/{uuid}/validate" && item.method === "POST");
  expect(operation).toBeDefined();
  expect(operation?.inputSchema.safeParse({ uuid: "server" }).success).toBe(true);
  expect(operation?.inputSchema.safeParse({ uuid: "server", body: { install: true } }).success).toBe(true);
  expect(operation?.responseSchema.safeParse({ message: "Validation started." }).success).toBe(true);
});

test("requires a cloud provider token on every provider list operation", () => {
  const paths = [
    "/digitalocean/regions", "/digitalocean/sizes", "/digitalocean/images", "/digitalocean/ssh-keys",
    "/hetzner/locations", "/hetzner/server-types", "/hetzner/images", "/hetzner/ssh-keys", "/hetzner/firewalls", "/hetzner/networks",
    "/vultr/regions", "/vultr/plans", "/vultr/os", "/vultr/ssh-keys",
  ];
  for (const path of paths) {
    const operation = operations.find((item) => item.path === path && item.method === "GET");
    expect(operation).toBeDefined();
    expect(operation?.inputSchema.safeParse({}).success).toBe(false);
    expect(operation?.responseSchema.safeParse([]).success).toBe(true);
    for (const key of ["cloud_provider_token_uuid", "cloud_provider_token_id"]) {
      const result = operation?.inputSchema.safeParse({ [key]: "provider-token" });
      expect(result?.success).toBe(true);
      if (result?.success) expect(JSON.stringify(result.data)).toContain(key);
    }
  }
});

test("supports provider server creation inputs and response objects", () => {
  const cases = [
    { path: "/servers/digitalocean", body: { region: "nyc1", size: "s-1vcpu-1gb", image: "ubuntu-24-04-x64", private_key_uuid: "key" }, response: { uuid: "server", digitalocean_droplet_id: 1, ip: "203.0.113.1" } },
    { path: "/servers/hetzner", body: { location: "nbg1", server_type: "cx11", image: 1, private_key_uuid: "key" }, response: { uuid: "server", hetzner_server_id: 1, ip: "203.0.113.1" } },
    { path: "/servers/vultr", body: { region: "ewr", plan: "vc2-1c-1gb", os_id: 477, private_key_uuid: "key" }, response: { uuid: "server", vultr_instance_id: "instance", ip: "203.0.113.1" } },
  ];
  for (const item of cases) {
    const operation = operations.find((candidate) => candidate.path === item.path && candidate.method === "POST");
    expect(operation).toBeDefined();
    expect(operation?.inputSchema.safeParse({ body: item.body }).success).toBe(false);
    expect(operation?.inputSchema.safeParse({ body: { ...item.body, cloud_provider_token_uuid: "token" } }).success).toBe(true);
    expect(operation?.inputSchema.safeParse({ body: { ...item.body, cloud_provider_token_id: "legacy-token" } }).success).toBe(true);
    expect(operation?.responseSchema.safeParse(item.response).success).toBe(true);
  }
});

test("documents provider validation and upstream failure responses", async () => {
  const spec = JSON.parse(await Bun.file("openapi/coolify-openapi.json").text()) as { paths: Record<string, Record<string, { responses: Record<string, unknown> }>> };
  const listPaths = [
    "/digitalocean/regions", "/digitalocean/sizes", "/digitalocean/images", "/digitalocean/ssh-keys",
    "/hetzner/locations", "/hetzner/server-types", "/hetzner/images", "/hetzner/ssh-keys", "/hetzner/firewalls", "/hetzner/networks",
    "/vultr/regions", "/vultr/plans", "/vultr/os", "/vultr/ssh-keys",
  ];
  for (const path of listPaths) {
    const responses = spec.paths[path].get.responses;
    expect((responses["422"] as { $ref?: string }).$ref).toBe("#/components/responses/422");
    const failure = responses["500"] as { content?: Record<string, { schema?: { properties?: Record<string, { type?: string }> } }> };
    expect(failure.content?.["application/json"]?.schema?.properties?.message?.type).toBe("string");
  }
  for (const path of ["/servers/digitalocean", "/servers/hetzner", "/servers/vultr"]) {
    const responses = spec.paths[path].post.responses;
    expect((responses["422"] as { $ref?: string }).$ref).toBe("#/components/responses/422");
    const failure = responses["500"] as { content?: Record<string, { schema?: { properties?: Record<string, { type?: string }> } }> };
    expect(failure.content?.["application/json"]?.schema?.properties?.message?.type).toBe("string");
  }
});

test("accepts Coolify resource IDs for log tools", () => {
  for (const name of ["coolify_get_database_logs_by_uuid", "coolify_get_service_logs_by_uuid"]) {
    const operation = operations.find((item) => item.name === name);
    expect(operation?.inputSchema.safeParse({
      uuid: "oaqwnu9cvxorr2ah5fcl5222", lines: 10, show_timestamps: false, sub_service_name: "web",
    }).success).toBe(true);
  }
});

test("allows either environment identifier when creating a resource", () => {
  for (const operation of operations.filter((item) => item.method === "POST" && ["/applications/", "/databases/", "/services"].some((prefix) => item.path.startsWith(prefix)))) {
    const body = (operation.inputSchema as { shape?: { body?: { shape?: Record<string, { isOptional: () => boolean }> } } }).shape?.body?.shape;
    if (!body?.environment_name || !body.environment_uuid) continue;
    expect(body.environment_name.isOptional()).toBe(true);
    expect(body.environment_uuid.isOptional()).toBe(true);
  }
  const database = operations.find((item) => item.name === "coolify_create_database_postgresql")!;
  const input = { body: { project_uuid: "project", server_uuid: "server" } };
  expect(database.inputSchema.safeParse(input).success).toBe(false);
  expect(database.inputSchema.safeParse({ body: { ...input.body, environment_name: "qa" } }).success).toBe(true);
  expect(database.inputSchema.safeParse({ body: { ...input.body, environment_uuid: "environment" } }).success).toBe(true);
});

test("accepts observed Coolify 4.3.23 read responses", () => {
  const response = (name: string, data: unknown) => operations.find((item) => item.name === name)?.responseSchema.safeParse(data).success;
  expect(response("coolify_get_application_by_uuid", { settings: { use_build_secrets: "false" } })).toBe(true);
  for (const name of ["coolify_list_application_destinations", "coolify_list_project_shared_envs", "coolify_list_environment_shared_envs", "coolify_list_server_shared_envs"]) {
    expect(response(name, [{}])).toBe(true);
  }
  expect(response("coolify_get_server_log_drains", { logdrain_newrelic_license_key: null, logdrain_axiom_api_key: null, logdrain_custom_config: null, logdrain_custom_config_parser: null })).toBe(true);
  for (const name of ["coolify_create_project_shared_env", "coolify_create_environment_shared_env", "coolify_create_server_shared_env"]) {
    const operation = operations.find((item) => item.name === name);
    expect(operation?.inputSchema.safeParse({ uuid: "resource-id", environment_name_or_uuid: "qa", body: { key: "QA", value: "probe" } }).success).toBe(true);
    expect(response(name, { id: 1 })).toBe(true);
  }
  expect(response("coolify_update_project_shared_env", { id: 1, value: "[REDACTED]" })).toBe(true);
  expect(response("coolify_delete_project_shared_env", { message: "deleted" })).toBe(true);
  expect(response("coolify_list_cloud_init_scripts", [])).toBe(true);
  expect(response("coolify_list_team_shared_envs", [])).toBe(true);
  expect(response("coolify_get_current_team_email_notifications", { smtp_host: null })).toBe(true);
  expect(response("coolify_list_github_apps", [{ app_id: null, installation_id: null, client_id: null, private_key_id: "key-id" }])).toBe(true);
  expect(response("coolify_list_private_keys", [{ description: null }])).toBe(true);
  expect(response("coolify_get_token_team_members", [{ email_verified_at: null, two_factor_confirmed_at: null, force_password_reset: "0" }])).toBe(true);
  expect(response("coolify_list_applications", [{ build_pack: "dockerimage" }])).toBe(true);
  expect(response("coolify_create_cloud_init_script", { uuid: "script", name: "qa", script: "true" })).toBe(true);
  expect(response("coolify_get_cloud_init_script_by_uuid", { uuid: "script", name: "qa", script: "true" })).toBe(true);
  expect(response("coolify_delete_cloud_init_script_by_uuid", { message: "deleted" })).toBe(true);
  expect(response("coolify_clone_database_by_uuid", { uuid: "database", message: "cloned" })).toBe(true);
  expect(response("coolify_clone_service_by_uuid", { uuid: "service", message: "cloned" })).toBe(true);
  expect(response("coolify_delete_tag_by_application_uuid", { message: "deleted" })).toBe(true);
  expect(response("coolify_delete_tag_by_database_uuid", { message: "deleted" })).toBe(true);
  expect(response("coolify_delete_tag_by_service_uuid", { message: "deleted" })).toBe(true);
  expect(response("coolify_update_database_backup", { message: "updated" })).toBe(true);
});
