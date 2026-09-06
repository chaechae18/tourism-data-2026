import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { vi } from "vitest";
import { HOME_CONTENT } from "../../../../lib/app-data";
import HomeTab from "../../../../components/home/HomeTab";

const api = vi.hoisted(() => ({
  listBanners: vi.fn(),
  listFestivals: vi.fn(),
  listPopups: vi.fn(),
  listRecommendedPlaces: vi.fn(),
}));

vi.mock("../../../../lib/api/home", () => api);

const BANNER = {
  img: "/b.png",
  title: "경주의 밤",
  subTitle: "첨성대 야경",
  link: "/night",
};

const POPUP = {
  title: "시스템 점검 안내",
  content: "새벽 2시 점검",
  img: null,
  link: "/notice/1",
};

const FESTIVAL = {
  name: "신라문화제",
  content: "경주 대표 축제",
  location: "경주시 일원",
  startDate: "2026-08-04T00:00:00",
  endDate: "2026-08-08T00:00:00",
  img: "/f.png",
  url: "https://example.com/silla",
};

const PLACE = {
  name: "불국사",
  text: "석가탑과 다보탑이 마주 선 절.\n돌계단까지 국보입니다.",
  address: "경북 경주시 불국로 385",
  latitude: 35.790102,
  longitude: 129.332099,
  admissionFee: "성인 6,000원",
};

describe("HomeTab", () => {
  beforeEach(() => {
    window.localStorage.clear();
    api.listBanners.mockResolvedValue([BANNER]);
    api.listPopups.mockResolvedValue([POPUP]);
    api.listFestivals.mockResolvedValue([FESTIVAL]);
    api.listRecommendedPlaces.mockResolvedValue([PLACE]);
  });

  it("renders every section from the API", async () => {
    render(<HomeTab onMapOpen={vi.fn()} />);
    expect(await screen.findByText("시스템 점검 안내")).toBeInTheDocument();

    expect(screen.getByText("신라문화제")).toBeInTheDocument();
    expect(screen.getByText("8. 4 - 8. 8")).toBeInTheDocument();
    expect(screen.getByText("불국사")).toBeInTheDocument();
    expect(screen.getByText("성인 6,000원")).toBeInTheDocument();
    // 요약은 줄바꿈을 그대로 살려 두 줄 높이 고정 상자에 담는다.
    const summary = screen.getByText(PLACE.text.replace("\n", " "));
    expect(summary.textContent).toBe(PLACE.text);
    expect(summary.className).toContain("whitespace-pre-line");
    expect(summary.className).toContain("h-12");
    expect(screen.getByRole("link", { name: "자세히 보기" })).toHaveAttribute("href", POPUP.link);
    expect(screen.getByRole("link", { name: "행사 정보" })).toHaveAttribute("href", FESTIVAL.url);
    expect(
      screen.getByText("신라문화제").closest("article").querySelector("img"),
    ).toHaveAttribute("src", FESTIVAL.img);
    expect(screen.getByRole("link", { name: PLACE.address })).toHaveAttribute(
      "href",
      `https://map.kakao.com/link/map/${encodeURIComponent(PLACE.name)},${PLACE.latitude},${PLACE.longitude}`,
    );
    // 경주 소식은 SHOW_NEWS_BANNERS 로 꺼져 있어 배너를 아예 부르지 않는다.
    expect(screen.queryByText("경주 소식")).not.toBeInTheDocument();
    expect(api.listBanners).not.toHaveBeenCalled();
  });

  it("shows notices in a popup that stays hidden for the rest of the day", async () => {
    const { unmount } = render(<HomeTab onMapOpen={vi.fn()} />);
    await screen.findByText("시스템 점검 안내");

    fireEvent.click(screen.getByRole("button", { name: "오늘 하루 보지 않기" }));
    expect(screen.queryByText("시스템 점검 안내")).not.toBeInTheDocument();

    unmount();
    render(<HomeTab onMapOpen={vi.fn()} />);
    await screen.findByText("신라문화제");

    expect(screen.queryByText("시스템 점검 안내")).not.toBeInTheDocument();
  });

  it("pages the recommended places two at a time", async () => {
    const names = ["불국사", "석굴암", "첨성대", "동궁과 월지"];
    api.listRecommendedPlaces.mockResolvedValue(names.map((name) => ({ ...PLACE, name })));
    render(<HomeTab onMapOpen={vi.fn()} />);
    await screen.findByText("석굴암");

    expect(screen.queryByText("첨성대")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "추천 관광지 2페이지" }));

    expect(screen.getByText("첨성대")).toBeInTheDocument();
    expect(screen.queryByText("불국사")).not.toBeInTheDocument();
  });

  it("opens the map and links to the tourism site", async () => {
    const onMapOpen = vi.fn();
    render(<HomeTab onMapOpen={onMapOpen} />);
    await screen.findByText("신라문화제");

    fireEvent.click(screen.getByRole("button", { name: "가까운 장소 보기" }));

    expect(onMapOpen).toHaveBeenCalledOnce();
    expect(screen.getByRole("link", { name: "경주 관광 정보" })).toHaveAttribute(
      "href",
      HOME_CONTENT.tourismUrl,
    );
  });

  it("requests the user's language on every section", async () => {
    render(<HomeTab language="en" onMapOpen={vi.fn()} />);
    await screen.findByText("신라문화제");

    expect(api.listPopups).toHaveBeenCalledWith("en");
    expect(api.listFestivals).toHaveBeenCalledWith("en");
    expect(api.listRecommendedPlaces).toHaveBeenCalledWith("en");
  });

  it("keeps the other sections when one of them fails", async () => {
    api.listPopups.mockRejectedValue(new Error("서버에 연결하지 못했습니다."));
    render(<HomeTab onMapOpen={vi.fn()} />);

    expect(await screen.findByText("요청을 처리하지 못했습니다.")).toBeInTheDocument();
    expect(screen.getByText("신라문화제")).toBeInTheDocument();
    expect(screen.getByText("불국사")).toBeInTheDocument();
  });

  it("drops links that are not http(s)", async () => {
    api.listPopups.mockResolvedValue([{ ...POPUP, link: "javascript:alert(1)" }]);
    render(<HomeTab onMapOpen={vi.fn()} />);

    expect(await screen.findByText("시스템 점검 안내")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "자세히 보기" })).not.toBeInTheDocument();
  });

  it("tells the user when a section is empty and skips missing fields", async () => {
    api.listPopups.mockResolvedValue([]);
    api.listFestivals.mockResolvedValue([{ ...FESTIVAL, endDate: null }]);
    api.listRecommendedPlaces.mockResolvedValue([{ ...PLACE, admissionFee: null }]);
    render(<HomeTab onMapOpen={vi.fn()} />);

    await waitFor(() => expect(screen.getByText("8. 4 시작")).toBeInTheDocument());
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    const place = screen.getByText("불국사").closest("article");
    expect(within(place).queryByText(/원/)).not.toBeInTheDocument();
  });
});
