import { vi } from "vitest";
import { searchPlaces } from "../../../../lib/api/spots";

const BASE = "http://localhost:8001";

describe("spots api", () => {
  it("uses the Docker backend port for place search", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ places: [] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await searchPlaces("첨성대");

    expect(fetchMock.mock.calls[0][0]).toBe(
      `${BASE}/api/v1/places/search?query=${encodeURIComponent("첨성대")}&size=10`,
    );
  });

  it("reports a connection failure and preserves aborts", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    await expect(searchPlaces("첨성대")).rejects.toMatchObject({
      code: "NETWORK_ERROR",
      message: "서버에 연결하지 못했습니다.",
    });

    const aborted = Object.assign(new Error("aborted"), { name: "AbortError" });
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(aborted));
    await expect(searchPlaces("첨성대")).rejects.toMatchObject({ name: "AbortError" });
  });
});
