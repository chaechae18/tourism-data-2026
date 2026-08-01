import { vi } from "vitest";
import { listBanners, listFestivals } from "../../../../lib/api/home";

const BASE = "http://localhost:8000";

describe("home api", () => {
  it("builds the URL with the requested language and returns the body", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [{ title: "경주의 밤" }],
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(listBanners()).resolves.toEqual([{ title: "경주의 밤" }]);
    expect(fetchMock.mock.calls[0][0]).toBe(`${BASE}/api/v1/main/banners`);

    await listFestivals("en");
    expect(fetchMock.mock.calls[1][0]).toBe(`${BASE}/api/v1/main/festivals?lang=en`);
  });

  it("raises the error message the server sent", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({ error: { code: "DB_UNAVAILABLE", message: "잠시 후 다시 시도해 주세요." } }),
    }));

    await expect(listBanners()).rejects.toMatchObject({
      name: "ApiError",
      code: "DB_UNAVAILABLE",
      message: "잠시 후 다시 시도해 주세요.",
      status: 503,
    });
  });

  it("reports a connection failure but lets an abort through", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    await expect(listBanners()).rejects.toThrow("서버에 연결하지 못했습니다.");

    const aborted = Object.assign(new Error("aborted"), { name: "AbortError" });
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(aborted));
    await expect(listBanners()).rejects.toMatchObject({ name: "AbortError" });
  });
});
