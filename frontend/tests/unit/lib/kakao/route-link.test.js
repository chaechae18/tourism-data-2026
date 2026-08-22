import { buildKakaoRouteUrl } from "../../../../lib/kakao/route-link";

const START = { name: "현재 위치", latitude: 35.8351, longitude: 129.2167 };
const END = { name: "김유신묘", latitude: 35.8462, longitude: 129.2109 };

describe("buildKakaoRouteUrl", () => {
  it("builds a web route link with the destination name and coordinates", () => {
    const url = buildKakaoRouteUrl({ start: START, end: END, userAgent: "Mozilla/5.0 (Macintosh)" });

    expect(url).toBe(`https://map.kakao.com/link/to/${encodeURIComponent("김유신묘")},35.8462,129.2109`);
  });

  it("builds an app route link with both endpoints on mobile", () => {
    const url = buildKakaoRouteUrl({
      start: START,
      end: END,
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
    });

    expect(url).toContain("kakaomap://route?");
    expect(url).toContain("sp=35.8351%2C129.2167");
    expect(url).toContain("ep=35.8462%2C129.2109");
    expect(url).toContain("by=FOOT");
  });

  it("returns an empty string without a destination", () => {
    expect(buildKakaoRouteUrl({ start: START })).toBe("");
  });
});
