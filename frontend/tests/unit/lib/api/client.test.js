import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, fetchJson } from "../../../../lib/api/client";

const BASE = "http://api.test";

function jsonResponse(body, { ok = true, status = 200 } = {}) {
  return { ok, status, json: async () => body };
}

describe("fetchJson", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_BASE_URL = BASE;
  });

  it("requests the given path against the configured origin", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([]));
    vi.stubGlobal("fetch", fetchMock);

    await fetchJson("/api/main/banners");

    expect(fetchMock.mock.calls[0][0].toString()).toBe(`${BASE}/api/main/banners`);
  });

  it("passes the language through as a query parameter", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([]));
    vi.stubGlobal("fetch", fetchMock);

    await fetchJson("/api/main/popup", { lang: "en" });

    expect(fetchMock.mock.calls[0][0].toString()).toBe(`${BASE}/api/main/popup?lang=en`);
  });

  it("omits the parameter when no language is given", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([]));
    vi.stubGlobal("fetch", fetchMock);

    await fetchJson("/api/main/popup");

    expect(fetchMock.mock.calls[0][0].toString()).not.toContain("lang");
  });

  it("returns the parsed body", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse([{ title: "배너" }])));

    await expect(fetchJson("/api/main/banners")).resolves.toEqual([{ title: "배너" }]);
  });

  it("raises with the status when the server rejects the request", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(null, { ok: false, status: 500 })));

    await expect(fetchJson("/api/main/banners")).rejects.toMatchObject({
      name: "ApiError",
      status: 500,
    });
  });

  it("reports a connection failure rather than leaking the raw error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    await expect(fetchJson("/api/main/banners")).rejects.toThrow("서버에 연결하지 못했습니다.");
  });

  it("explains an unset origin instead of building a broken URL", async () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "";

    await expect(fetchJson("/api/main/banners")).rejects.toBeInstanceOf(ApiError);
  });

  it("lets an abort propagate so unmounted callers can ignore it", async () => {
    const abortError = Object.assign(new Error("aborted"), { name: "AbortError" });
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(abortError));

    await expect(fetchJson("/api/main/banners")).rejects.toMatchObject({ name: "AbortError" });
  });
});
