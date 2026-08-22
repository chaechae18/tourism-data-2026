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
