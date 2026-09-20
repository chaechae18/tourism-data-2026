import { maps } from "../../../helpers/maplibre";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import { QUESTS } from "../../../../lib/app-data";
import GyeongjuMap2D from "../../../../components/map/GyeongjuMap2D";

// Canvas animation is separate from GPS and completion dialog behavior.
vi.mock("../../../../components/map/QuestConfetti", () => ({ default: () => null }));

const PROPS = {
  completedQuestIds: [],
  onComplete: vi.fn(),
  onDocent: vi.fn(),
  onSelect: vi.fn(),
  selectedPlace: QUESTS[0],
};

describe("GyeongjuMap2D", () => {
  it.each([true, false])("passes the saved reward to the celebration for demo=%s", async (demo) => {
    vi.stubGlobal("navigator", { geolocation: { getCurrentPosition: (resolve) => resolve({ coords: {
      latitude: QUESTS[0].latitude, longitude: QUESTS[0].longitude, accuracy: 10,
    } }) } });
    try {
      render(<GyeongjuMap2D {...PROPS} onComplete={vi.fn().mockResolvedValue({ completed: true, reward: { slot: "hat", name: "신라 금관" } })} />);
      fireEvent.click(screen.getByRole("button", { name: demo ? "예비용 · 방문 완료 체험" : "퀘스트 완료" }));
      fireEvent.click(await screen.findByRole("button", { name: "보상 확인하기" }));
      expect(screen.getByRole("dialog", { name: "모자를 얻었어요!" })).toBeInTheDocument();
      expect(screen.getByText("신라 금관")).toBeInTheDocument();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("includes coastal and northern course places in both markers and the list", async () => {
    const places = [
      QUESTS[0],
      { ...QUESTS[1], id: "place-coast", name: "감포 해안", longitude: 129.5, latitude: 35.8 },
      { ...QUESTS[2], id: "place-north", name: "양동마을", longitude: 129.255, latitude: 36.002 },
    ];
    const onSelect = vi.fn();
    render(<GyeongjuMap2D {...PROPS} places={places} selectedPlace={places[1]} onSelect={onSelect} />);
    const marker = await screen.findByRole("button", { name: "감포 해안 선택" });
    expect(marker.querySelector("img")).toHaveAttribute("src", "/images/map-quests/tower-simple.webp");
    expect(screen.getByRole("button", { name: "양동마을 선택" })).toBeInTheDocument();
    expect(maps[0].options.maxBounds[1][0]).toBeGreaterThan(129.5);
    expect(maps[0].options.maxBounds[1][1]).toBeGreaterThan(36.002);
    expect(maps[0].easeTo).toHaveBeenCalledWith(expect.objectContaining({ center: [129.5, 35.8] }));
    fireEvent.click(marker);
    expect(onSelect).toHaveBeenCalledWith(places[1]);
    fireEvent.click(screen.getByRole("button", { name: "리스트" }));
    expect(screen.getByText("오늘의 코스 3곳")).toBeInTheDocument();
    places.forEach((place) => expect(screen.getByRole("button", { name: `${place.name} 선택` })).toBeInTheDocument());
  });

  it("saves an explicit demo completion without requesting GPS", async () => {
    const getCurrentPosition = vi.fn();
    vi.stubGlobal("navigator", { geolocation: { getCurrentPosition } });
    const onComplete = vi.fn().mockResolvedValue(true);
    render(<GyeongjuMap2D {...PROPS} onComplete={onComplete} />);
    fireEvent.click(screen.getByRole("button", { name: "예비용 · 방문 완료 체험" }));
    await waitFor(() => expect(onComplete).toHaveBeenCalledWith(QUESTS[0].id, { demoCompletion: true }));
    expect(getCurrentPosition).not.toHaveBeenCalled();
    expect(await screen.findByText("심사·시연용 체험")).toBeInTheDocument();
    vi.unstubAllGlobals();
  });

  it("explains the demo button on tap and associates help with the button", () => {
    render(<GyeongjuMap2D {...PROPS} />);
    const help = screen.getByRole("button", { name: "예비 버튼을 만든 이유" });
    expect(help).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(help);
    expect(help).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("tooltip")).toHaveTextContent("현장 방문이 어려운 심사위원");
    expect(screen.getByRole("button", { name: "예비용 · 방문 완료 체험" }))
      .toHaveAttribute("aria-describedby", screen.getByRole("tooltip").id);
  });

  it("does not celebrate a failed demo save", async () => {
    render(<GyeongjuMap2D {...PROPS} onComplete={vi.fn().mockRejectedValue(new Error("저장 실패"))} />);
    fireEvent.click(screen.getByRole("button", { name: "예비용 · 방문 완료 체험" }));
    expect(await screen.findByText("저장 실패")).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "퀘스트 완료!" })).not.toBeInTheDocument();
  });

  it("disables both completion buttons after completion", () => {
    render(<GyeongjuMap2D {...PROPS} completedQuestIds={[QUESTS[0].id]} />);
    const buttons = screen.getAllByRole("button", { name: "방문 완료" });
    expect(buttons).toHaveLength(2);
    buttons.forEach((button) => expect(button).toBeDisabled());
  });

  it("selects a place marker", async () => {
    const onSelect = vi.fn();
    render(<GyeongjuMap2D {...PROPS} onSelect={onSelect} />);

    fireEvent.click(await screen.findByRole("button", { name: "첨성대 선택" }));

    expect(onSelect).toHaveBeenCalledWith(QUESTS[1]);
  });

  it.each([
    [0, 10, true, null],
    [0.001, 10, false, "조금만 더 가까이 와주세요"],
    [0, 150, false, "위치가 부정확해요. 탁 트인 곳에서 다시 시도해 주세요."],
  ])("checks fresh GPS with offset %s and accuracy %s", async (offset, accuracy, allowed, message) => {
    const coords = { latitude: QUESTS[0].latitude + offset, longitude: QUESTS[0].longitude, accuracy };
    const getCurrentPosition = vi.fn((resolve) => resolve({ coords }));
    vi.stubGlobal("navigator", { geolocation: { getCurrentPosition } });
    const onComplete = vi.fn();
    render(<GyeongjuMap2D {...PROPS} onComplete={onComplete} />);
    fireEvent.click(screen.getByRole("button", { name: "퀘스트 완료" }));
    if (allowed) {
      await waitFor(() => expect(onComplete).toHaveBeenCalledWith(QUESTS[0].id, coords));
      expect(await screen.findByRole("dialog", { name: "퀘스트 완료!" })).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "좋아, 계속 탐험하기" }));
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    } else {
      expect(await screen.findByText(message)).toBeInTheDocument();
      expect(onComplete).not.toHaveBeenCalled();
    }
    expect(getCurrentPosition).toHaveBeenCalledWith(expect.any(Function), expect.any(Function),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 });
    vi.unstubAllGlobals();
  });

  it("does not celebrate when saving fails", async () => {
    vi.stubGlobal("navigator", { geolocation: { getCurrentPosition: (resolve) => resolve({ coords: {
      latitude: QUESTS[0].latitude, longitude: QUESTS[0].longitude, accuracy: 10,
    } }) } });
    render(<GyeongjuMap2D {...PROPS} onComplete={vi.fn().mockRejectedValue(new Error("저장에 실패했어요."))} />);
    fireEvent.click(screen.getByRole("button", { name: "퀘스트 완료" }));
    expect(await screen.findByText("저장에 실패했어요.")).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "퀘스트 완료!" })).not.toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    vi.unstubAllGlobals();
  });

  it("blocks completion when location permission is denied", async () => {
    vi.stubGlobal("navigator", { geolocation: { getCurrentPosition: (_, reject) => reject({ code: 1 }) } });
    const onComplete = vi.fn();
    render(<GyeongjuMap2D {...PROPS} onComplete={onComplete} />);
    fireEvent.click(screen.getByRole("button", { name: "퀘스트 완료" }));
    expect(await screen.findByText("퀘스트를 완료하려면 위치 권한을 허용해 주세요.")).toBeInTheDocument();
    expect(onComplete).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("shows the full Gyeongju landmarks on the map", async () => {
    render(<GyeongjuMap2D {...PROPS} />);

    expect(await screen.findByRole("button", { name: "불국사 선택" })).toBeInTheDocument();
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

    expect(await screen.findByText(/TMAP 키/)).toBeInTheDocument();
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

  it("opens the Kakao Map route page for the selected place", () => {
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    render(<GyeongjuMap2D {...PROPS} />);

    fireEvent.click(screen.getByRole("button", { name: "카카오맵으로 길찾기" }));

    const [url] = open.mock.calls[0];
    expect(url).toContain("map.kakao.com/link/to");
    expect(url).toContain(`,${QUESTS[0].latitude},${QUESTS[0].longitude}`);
    open.mockRestore();
  });

  it("keeps the translated label but routes with the Korean place name", () => {
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    const place = { ...QUESTS[0], name: "Cheomseongdae", routeName: "첨성대" };
    render(<GyeongjuMap2D {...PROPS} places={[place]} selectedPlace={place} />);

    expect(screen.getAllByText("Cheomseongdae").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "카카오맵으로 길찾기" }));

    expect(open.mock.calls[0][0]).toContain(encodeURIComponent("첨성대"));
    expect(open.mock.calls[0][0]).not.toContain(encodeURIComponent("Cheomseongdae"));
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
