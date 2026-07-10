import { vi } from "vitest";
import { requestTmapPedestrianRoute } from "../../../../lib/tmap/pedestrian-route";

const START = { name: "출발", latitude: 35.8351, longitude: 129.2167 };
const END = { name: "첨성대", latitude: 35.8347, longitude: 129.2191 };

describe("requestTmapPedestrianRoute", () => {
  it("normalizes a TMAP GeoJSON route", async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        features: [
          { properties: { totalDistance: 320, totalTime: 260 }, geometry: { type: "Point", coordinates: [129.2167, 35.8351] } },
          { properties: {}, geometry: { type: "LineString", coordinates: [[129.2167, 35.8351], [129.2191, 35.8347]] } },
        ],
      }),
    });

    const route = await requestTmapPedestrianRoute({ appKey: "test-key", start: START, end: END, fetcher });

    expect(route).toEqual({
      coordinates: [
        { latitude: 35.8351, longitude: 129.2167 },
        { latitude: 35.8347, longitude: 129.2191 },
      ],
      distanceMeters: 320,
      durationSeconds: 260,
      source: "tmap",
    });
  });

  it("rejects a request without an app key", async () => {
    await expect(requestTmapPedestrianRoute({ appKey: "", start: START, end: END })).rejects.toThrow("TMAP_APP_KEY_MISSING");
  });
});
