import { describe, expect, test } from "bun:test";
import { verifySnapshot } from "./check-openapi.js";

const snapshot = JSON.stringify({ openapi: "3.1.0", info: { version: "0.1" }, paths: { "/health": { get: {} } } });
const sha256 = "4a38960fdf4201c8e15d50ba33cdc9fd24dec64c729d649167232607614485c1";
const sourceUrl = "https://raw.githubusercontent.com/coollabsio/coolify/v4.3.23/openapi.json";

describe("verifySnapshot", () => {
  test("rejects a persisted snapshot whose hash does not match", () => {
    expect(() => verifySnapshot(snapshot, { sourceUrl, sha256: "wrong", openapiVersion: "3.1.0", infoVersion: "0.1", pathCount: 1, operationCount: 1 })).toThrow(/sha256/iu);
  });

  test("checks document and info versions independently", () => {
    expect(verifySnapshot(snapshot, { sourceUrl, sha256, openapiVersion: "3.1.0", infoVersion: "0.1", pathCount: 1, operationCount: 1 })).toBeUndefined();
    expect(() => verifySnapshot(snapshot, { sourceUrl, sha256, openapiVersion: "3.0.0", infoVersion: "0.1", pathCount: 1, operationCount: 1 })).toThrow(/document version/iu);
    expect(() => verifySnapshot(snapshot, { sourceUrl, sha256, openapiVersion: "3.1.0", infoVersion: "0.2", pathCount: 1, operationCount: 1 })).toThrow(/info\.version/iu);
  });

  test("rejects a manifest from a non-authoritative source URL", () => {
    expect(() => verifySnapshot(snapshot, { sourceUrl: "https://example.com/openapi.json", sha256, openapiVersion: "3.1.0", infoVersion: "0.1", pathCount: 1, operationCount: 1 })).toThrow(/sourceUrl/iu);
  });
});
