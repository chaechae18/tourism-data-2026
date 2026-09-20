import { vi } from "vitest";
import { searchPlaces, createSpot, listMySpots, uploadSpotImage } from "../../../../lib/api/spots";

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

vi.mock("@vercel/blob/client", () => ({ upload: vi.fn() }));

afterEach(() => vi.unstubAllGlobals());

it("sends session cookies without a hardcoded identity", async () => {
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => [] });
  vi.stubGlobal("fetch", fetchMock);
  await listMySpots();
  await createSpot({ caption: "test" });
  for (const [, options] of fetchMock.mock.calls) {
    expect(options.credentials).toBe("include");
    expect(options.headers).not.toHaveProperty("X-User-No");
  }
});

it("uploads large images directly to Blob and returns its persistent URL", async () => {
  const { upload } = await import("@vercel/blob/client");
  upload.mockResolvedValue({ url: "https://store.public.blob.vercel-storage.com/spot.png" });
  const file = new File([new Uint8Array(5 * 1024 * 1024)], "photo.png", { type: "image/png" });
  const result = await uploadSpotImage(file);
  expect(upload).toHaveBeenCalledWith(expect.stringMatching(/^spots\/.*\.png$/), file, {
    access: "public", handleUploadUrl: "/api/spot-images/upload", contentType: "image/png",
  });
  expect(result.url).toContain("blob.vercel-storage.com");
});

it("rejects unsupported and oversized images before upload", async () => {
  const { upload } = await import("@vercel/blob/client");
  await expect(uploadSpotImage(new File(["x"], "x.svg", { type: "image/svg+xml" }))).rejects.toMatchObject({ code: "UNSUPPORTED_IMAGE_TYPE" });
  await expect(uploadSpotImage({ type: "image/png", size: 10 * 1024 * 1024 + 1 })).rejects.toMatchObject({ code: "IMAGE_TOO_LARGE" });
  expect(upload).not.toHaveBeenCalled();
});
