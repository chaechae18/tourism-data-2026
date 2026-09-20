// @vitest-environment node
import { vi } from "vitest";
import { POST } from "../../../app/api/spot-images/upload/route";
import { getPayloadFromClientToken } from "@vercel/blob/client";

const pathname = "spots/12345678-1234-1234-1234-123456789abc.png";
const token = "vercel_blob_rw_teststore_abcdefghijklmnopqrstuvwxyz";
function request(body = { type: "blob.generate-client-token", payload: { pathname } }) {
  return new Request("https://app.example/api/spot-images/upload", {
    method: "POST",
    headers: { cookie: "session=signed-session", "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.stubEnv("BLOB_READ_WRITE_TOKEN", token);
  vi.stubEnv("VERCEL_BLOB_CALLBACK_URL", "https://app.example/api/spot-images/upload");
  vi.stubEnv("BACKEND_API_BASE_URL", "https://api.example");
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ user: { user_no: 2 } })));
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

it("issues a limited upload token only after verifying the backend session", async () => {
  const response = await POST(request());
  expect(response.status).toBe(200);
  expect(fetch).toHaveBeenCalledWith("https://api.example/api/v1/auth/me", expect.objectContaining({
    headers: { cookie: "session=signed-session" }, cache: "no-store", redirect: "error",
  }));
  const { clientToken } = await response.json();
  const payload = getPayloadFromClientToken(clientToken);
  expect(payload).toMatchObject({
    pathname, maximumSizeInBytes: 10 * 1024 * 1024,
    allowedContentTypes: ["image/jpeg", "image/png", "image/webp"],
    addRandomSuffix: true, allowOverwrite: false,
  });
  expect(payload.validUntil).toBeGreaterThan(Date.now());
  expect(payload.validUntil).toBeLessThanOrEqual(Date.now() + 5 * 60 * 1000);
  expect(JSON.parse(payload.onUploadCompleted.tokenPayload)).toEqual({ userNo: 2 });
});

it("rejects a missing login", async () => {
  fetch.mockResolvedValue(new Response(null, { status: 401 }));
  expect((await POST(request())).status).toBe(401);
});
it("rejects arbitrary paths", async () => {
  expect((await POST(request({ type: "blob.generate-client-token", payload: { pathname: "anything.html" } }))).status).toBe(400);
});
it("reports missing storage configuration", async () => {
  vi.stubEnv("BLOB_READ_WRITE_TOKEN", "");
  expect((await POST(request())).status).toBe(503);
  expect(fetch).not.toHaveBeenCalled();
});
it("rejects unsigned upload callbacks without trusting their payload", async () => {
  const response = await POST(request({ type: "blob.upload-completed", payload: { blob: { url: "https://attacker.example/image.png" } } }));
  expect(response.status).toBe(400);
  expect(fetch).not.toHaveBeenCalled();
});
