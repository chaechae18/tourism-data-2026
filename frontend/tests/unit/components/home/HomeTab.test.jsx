import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HOME_CONTENT } from "../../../../lib/app-data";
import HomeTab from "../../../../components/home/HomeTab";

const BASE = "http://api.test";

const BANNERS = [{ img: "/b.png", title: "경주의 밤", sub_title: "첨성대 야경", link: "/night" }];
const POPUPS = [{ title: "시스템 점검 안내", content: "새벽 2시 점검", img: null, link: "/notice/1" }];
const FESTIVALS = [
  {
    name: "신라문화제",
    content: "경주 대표 축제",
    location: "경주시 일원",
    start_date: "2026-08-04T00:00:00+09:00",
    end_date: "2026-08-08T00:00:00+09:00",
    img: "/f.png",
    url: "https://example.com/silla",
  },
];
const PLACES = [
  {
    name: "불국사",
    text: "유네스코 세계문화유산",
    address: "경북 경주시 불국로 385",
    latitude: 35.790102,
    longitude: 129.332099,
    admission_fee: "성인 6,000원",
  },
];

/** Route each home endpoint to its payload; anything else fails the test. */
function stubApi({ banners = BANNERS, popup = POPUPS, festivals = FESTIVALS, places = PLACES } = {}) {
  const routes = {
    "/api/main/banners": banners,
    "/api/main/popup": popup,
    "/api/main/festivals": festivals,
    "/api/main/places/recommended": places,
  };

  const fetchMock = vi.fn(async (url) => {
    const { pathname } = new URL(url);
    const body = routes[pathname];
    if (body === undefined) throw new Error(`unexpected request: ${pathname}`);
    if (body instanceof Error) throw body;
    return { ok: true, status: 200, json: async () => body };
  });

  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("HomeTab", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_BASE_URL = BASE;
  });

  it("opens the map from the nearby-place action", async () => {
    stubApi();
    const onMapOpen = vi.fn();
    render(<HomeTab onMapOpen={onMapOpen} />);
    await screen.findByText("경주의 밤");

    fireEvent.click(screen.getByRole("button", { name: "가까운 장소 보기" }));

    expect(onMapOpen).toHaveBeenCalledOnce();
  });

  it("links to the official tourism site", async () => {
    stubApi();
    render(<HomeTab onMapOpen={vi.fn()} />);
    await screen.findByText("경주의 밤");

    expect(screen.getByRole("link", { name: "경주 관광 정보" })).toHaveAttribute("href", HOME_CONTENT.tourismUrl);
  });

  it("renders every section from the API", async () => {
    stubApi();
    render(<HomeTab onMapOpen={vi.fn()} />);

    expect(await screen.findByText("경주의 밤")).toBeInTheDocument();
    expect(await screen.findByText("시스템 점검 안내")).toBeInTheDocument();
    expect(await screen.findByText("신라문화제")).toBeInTheDocument();
    expect(await screen.findByText("불국사")).toBeInTheDocument();
  });

  it("formats a festival run from the ISO timestamps", async () => {
    stubApi();
    render(<HomeTab onMapOpen={vi.fn()} />);

    expect(await screen.findByText("8. 4 - 8. 8")).toBeInTheDocument();
  });

  it("requests the user's language on every translatable endpoint", async () => {
    const fetchMock = stubApi();
    render(<HomeTab language="en" onMapOpen={vi.fn()} />);

    await screen.findByText("경주의 밤");

    const requested = fetchMock.mock.calls.map(([url]) => url.toString());
    expect(requested).toHaveLength(4);
    requested.forEach((url) => expect(url).toContain("lang=en"));
  });

  it("defaults to Korean when no language is set", async () => {
    const fetchMock = stubApi();
    render(<HomeTab onMapOpen={vi.fn()} />);

    await screen.findByText("경주의 밤");

    expect(fetchMock.mock.calls[0][0].toString()).toContain("lang=ko");
  });

  it("shows a loading state before the data arrives", async () => {
    stubApi();
    const { container } = render(<HomeTab onMapOpen={vi.fn()} />);

    expect(container.querySelectorAll('[aria-busy="true"]').length).toBeGreaterThan(0);

    // Let the pending requests settle so the state update is not reported as
    // happening outside act().
    await screen.findByText("경주의 밤");
    expect(container.querySelectorAll('[aria-busy="true"]')).toHaveLength(0);
  });

  it("reports a failed section instead of showing placeholder content", async () => {
    stubApi({ festivals: new TypeError("Failed to fetch") });
    render(<HomeTab onMapOpen={vi.fn()} />);

    expect(await screen.findByText("불러오지 못했어요")).toBeInTheDocument();
    // The other sections still render — one dead endpoint must not blank the page.
    expect(await screen.findByText("불국사")).toBeInTheDocument();
  });

  it("retries only the section that failed", async () => {
    const fetchMock = stubApi({ festivals: new TypeError("Failed to fetch") });
    render(<HomeTab onMapOpen={vi.fn()} />);

    await screen.findByText("불러오지 못했어요");
    const callsBefore = fetchMock.mock.calls.length;

    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));

    await waitFor(() => expect(fetchMock.mock.calls.length).toBe(callsBefore + 1));
  });

  it("tells the user when a section is genuinely empty", async () => {
    stubApi({ festivals: [] });
    render(<HomeTab onMapOpen={vi.fn()} />);

    expect(await screen.findByText("예정된 행사가 없어요.")).toBeInTheDocument();
  });
});
