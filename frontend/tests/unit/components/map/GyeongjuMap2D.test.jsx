import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { QUESTS } from "../../../../lib/app-data";
import GyeongjuMap2D from "../../../../components/map/GyeongjuMap2D";

const PROPS = {
  completedQuestIds: [],
  onComplete: vi.fn(),
  onDocent: vi.fn(),
  onSelect: vi.fn(),
  selectedPlace: QUESTS[0],
};

// jsdom에는 PointerEvent가 없어서 fireEvent.pointerDown으로는 좌표가 전달되지 않는다.
// 좌표를 담을 수 있는 MouseEvent를 같은 이름으로 직접 보내 손가락 끌기를 흉내낸다.
function dragPointer(element, points) {
  const types = ["pointerdown", ...points.slice(1).map(() => "pointermove"), "pointerup"];
  [...points, points.at(-1)].forEach(([clientX, clientY], index) => {
    fireEvent(element, new MouseEvent(types[index], { bubbles: true, clientX, clientY }));
  });
}

describe("GyeongjuMap2D", () => {
  it("selects a place marker", () => {
    const onSelect = vi.fn();
    render(<GyeongjuMap2D {...PROPS} onSelect={onSelect} />);

    fireEvent.click(screen.getByRole("button", { name: "첨성대 선택" }));

    expect(onSelect).toHaveBeenCalledWith(QUESTS[1]);
  });

  it("marks the selected quest as complete", () => {
    const onComplete = vi.fn();
    render(<GyeongjuMap2D {...PROPS} onComplete={onComplete} />);

    fireEvent.click(screen.getByRole("button", { name: "퀘스트 완료" }));

    expect(onComplete).toHaveBeenCalledWith(QUESTS[0].id);
  });

  it("shows the full Gyeongju landmarks on the map", () => {
    render(<GyeongjuMap2D {...PROPS} />);

    expect(screen.getByRole("button", { name: "불국사 선택" })).toBeInTheDocument();
  });

  it("lists the course places in visit order when the list view is selected", () => {
    const onSelect = vi.fn();
    render(<GyeongjuMap2D {...PROPS} onSelect={onSelect} />);

    fireEvent.click(screen.getByRole("button", { name: "리스트" }));

    expect(screen.getByText(`오늘의 코스 ${QUESTS.length}곳`)).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(QUESTS.length);

    fireEvent.click(screen.getByRole("button", { name: "석굴암 선택" }));

    expect(onSelect).toHaveBeenCalledWith(QUESTS[4]);
  });

  it("shows a guidance message when no TMAP key is connected", async () => {
    render(<GyeongjuMap2D {...PROPS} />);

    fireEvent.click(screen.getByRole("button", { name: "지도에 도보 경로 표시" }));

    expect(await screen.findByRole("status")).toHaveTextContent("TMAP 키");
  });

  it("opens the docent player for a place that has a description", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ placeId: 41, name: "첨성대", text: "별을 읽던 곳이다.", source: "한국관광공사" }),
    })));
    const place = { ...QUESTS[0], placeId: 41, docent: true };
    render(<GyeongjuMap2D {...PROPS} places={[place]} selectedPlace={place} />);

    fireEvent.click(screen.getByRole("button", { name: "도슨트 듣기" }));

    expect(await screen.findByRole("dialog", { name: "도슨트" })).toBeInTheDocument();
    vi.unstubAllGlobals();
  });

  it("keeps the docent button off for a place without a description", () => {
    const place = { ...QUESTS[0], placeId: 41, docent: false };
    render(<GyeongjuMap2D {...PROPS} places={[place]} selectedPlace={place} />);

    expect(screen.getByRole("button", { name: "준비 중" })).toBeDisabled();
  });

  it("zooms the map with the zoom buttons and keeps marker size fixed", () => {
    const { container } = render(<GyeongjuMap2D {...PROPS} />);
    const mapBody = () => container.querySelector("svg > g[transform]");
    const markerBody = () => screen.getByRole("button", { name: "첨성대 선택" }).querySelector("g");

    // 1배에서는 축소·되돌리기를 쓸 이유가 없다.
    expect(screen.getByRole("button", { name: "지도 축소" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "지도 원래대로" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "지도 확대" }));

    // 지도 본체는 1.6배로 커지고, 마커는 그만큼 되돌려져 원래 크기를 유지한다.
    expect(mapBody().getAttribute("transform")).toContain("scale(1.6)");
    expect(markerBody().getAttribute("transform")).toContain(`scale(${1 / 1.6})`);

    fireEvent.click(screen.getByRole("button", { name: "지도 원래대로" }));

    expect(mapBody().getAttribute("transform")).toContain("scale(1)");
    expect(markerBody().getAttribute("transform")).toContain("scale(1)");
  });

  it("does not select a marker when the map was dragged instead of tapped", () => {
    const bounds = vi.spyOn(Element.prototype, "getBoundingClientRect")
      .mockReturnValue({ left: 0, top: 0, width: 390, height: 500 });
    const onSelect = vi.fn();
    const { container } = render(<GyeongjuMap2D {...PROPS} onSelect={onSelect} />);
    const marker = screen.getByRole("button", { name: "첨성대 선택" });

    fireEvent.click(screen.getByRole("button", { name: "지도 확대" }));  // 확대해야 이동할 여지가 생긴다
    dragPointer(marker.closest("svg"), [[200, 240], [140, 240]]);
    fireEvent.click(marker);

    // 1.6배 확대 위치(-117)에서 왼쪽으로 60만큼 끌린다.
    expect(container.querySelector("svg > g[transform]").getAttribute("transform")).toContain("translate(-177");
    expect(onSelect).not.toHaveBeenCalled();
    bounds.mockRestore();
  });

  it("opens the Kakao Map route page for the selected place", () => {
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    render(<GyeongjuMap2D {...PROPS} />);

    fireEvent.click(screen.getByRole("button", { name: "카카오맵으로 길찾기" }));

    const [url] = open.mock.calls[0];
    expect(url).toContain("map.kakao.com/link/to");
    expect(url).toContain(`,${QUESTS[0].latitude},${QUESTS[0].longitude}`);
    open.mockRestore();
  });
});

describe("장소 상세 정보", () => {
  const detailed = {
    ...QUESTS[0],
    placeId: 41,
    operatingHours: "09:00~18:00",
    parking: "가능 (무료)",
    restDate: "연중무휴",
    menu: "한우물회 / 성게비빔밥",
  };

  it("운영시간·주차·휴무일·메뉴를 보여준다", () => {
    render(<GyeongjuMap2D {...PROPS} places={[detailed]} selectedPlace={detailed} />);

    expect(screen.getByText("09:00~18:00")).toBeInTheDocument();
    expect(screen.getByText("가능 (무료)")).toBeInTheDocument();
    expect(screen.getByText("연중무휴")).toBeInTheDocument();
    expect(screen.getByText("한우물회 / 성게비빔밥")).toBeInTheDocument();
  });

  it("값이 없는 항목은 줄을 그리지 않는다", () => {
    const sparse = { ...detailed, parking: null, menu: null, restDate: null };
    render(<GyeongjuMap2D {...PROPS} places={[sparse]} selectedPlace={sparse} />);

    expect(screen.getByText("09:00~18:00")).toBeInTheDocument();
    expect(screen.queryByText("주차")).not.toBeInTheDocument();
    expect(screen.queryByText("메뉴")).not.toBeInTheDocument();
  });
});
