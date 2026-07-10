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

  it("shows the full Gyeongju landmarks when the map scope changes", () => {
    render(<GyeongjuMap2D {...PROPS} />);

    fireEvent.click(screen.getByRole("button", { name: "전체 경주" }));

    expect(screen.getByRole("button", { name: "불국사 선택" })).toBeInTheDocument();
  });

  it("falls back to a demo route before a TMAP key is connected", async () => {
    render(<GyeongjuMap2D {...PROPS} />);

    fireEvent.click(screen.getByRole("button", { name: "TMAP 길찾기" }));

    expect(await screen.findByRole("status")).toHaveTextContent("데모 경로");
  });
});
