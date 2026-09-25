import { expect, test } from "bun:test";
import { operations } from "./generated/operations.js";

test("generated operations match the pinned Coolify manifest", async () => {
  const manifest = JSON.parse(await Bun.file("api/manifest.json").text()) as { operationCount: number; openapiVersion: string; infoVersion: string };
  expect(operations).toHaveLength(manifest.operationCount);
  expect(operations.every((operation) => operation.name.startsWith("coolify_") && operation.path.startsWith("/"))).toBe(true);
  expect(manifest.openapiVersion).toBe("3.1.0");
  expect(manifest.infoVersion).toBe("0.1");
  const fallback = JSON.parse(await Bun.file(".codex-plugin/plugin.json").text()) as { mcpServers?: string; apps?: string };
  expect(fallback.mcpServers).toBe("./.mcp.json");
  expect(fallback.apps).toBeUndefined();
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
});
