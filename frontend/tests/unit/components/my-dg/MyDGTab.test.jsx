import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { QUESTS } from "../../../../lib/app-data";

const api = vi.hoisted(() => ({
  listDonggyeongItems: vi.fn(),
}));

vi.mock("../../../../components/donggyeong/Donggyeong3D", () => ({
  default: () => <div data-testid="donggyeong-stub" />,
}));

vi.mock("../../../../lib/api/donggyeong", () => api);

import MyDGTab from "../../../../components/my-dg/MyDGTab";

const PROPS = {
  completedQuestIds: [],
  onMapQuest: vi.fn(),
  onSaveOutfit: vi.fn(),
  outfit: {},
  setOutfit: vi.fn(),
};

describe("MyDGTab", () => {
  beforeEach(() => {
    api.listDonggyeongItems.mockResolvedValue([]);
  });

  it("shows the correct Donggyeong number", () => {
    render(<MyDGTab {...PROPS} />);

    expect(screen.getByText("540 · 내 동경이")).toBeInTheDocument();
  });

  it("equips the selected inventory item", () => {
    const setOutfit = vi.fn();
    render(<MyDGTab {...PROPS} setOutfit={setOutfit} />);

    fireEvent.click(screen.getByRole("button", { name: "♛ 금관" }));

    expect(setOutfit).toHaveBeenCalledOnce();
  });

  it("opens the selected quest on the map", () => {
    const onMapQuest = vi.fn();
    render(<MyDGTab {...PROPS} onMapQuest={onMapQuest} />);

    fireEvent.click(screen.getByRole("button", { name: `분황사 ${QUESTS[0].distance} · ${QUESTS[0].description}` }));

    expect(onMapQuest).toHaveBeenCalledWith(QUESTS[0]);
  });
});
