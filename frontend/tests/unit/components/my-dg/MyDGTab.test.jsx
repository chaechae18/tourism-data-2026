import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { QUESTS } from "../../../../lib/app-data";

const api = vi.hoisted(() => ({
  listDonggyeongItems: vi.fn(),
}));

vi.mock("../../../../components/donggyeong/Donggyeong3D", () => ({
  default: ({ items }) => (
    <div
      data-testid="donggyeong-stub"
      data-model-urls={items.map((item) => item.modelUrl).join(",")}
    />
  ),
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

    fireEvent.click(screen.getByRole("button", { name: "금관" }));

    expect(setOutfit).toHaveBeenCalledOnce();
  });

  it("renders item graphics without font-dependent symbol glyphs", () => {
    render(<MyDGTab {...PROPS} />);

    expect(screen.queryByText("♛")).not.toBeInTheDocument();
    expect(screen.queryByText("✿")).not.toBeInTheDocument();
  });

  it("repairs and deduplicates legacy mojibake item names", async () => {
    api.listDonggyeongItems.mockResolvedValue([
      { id: 1, name: "ê¸ˆê´€", slot: "hat", modelUrl: null },
      { id: 6, name: "금관", slot: "hat", modelUrl: "/models/donggyeong/items/crown.glb" },
    ]);

    render(<MyDGTab {...PROPS} />);

    expect(await screen.findByRole("button", { name: "금관" })).toHaveAttribute(
      "data-model-url",
      "/models/donggyeong/items/crown.glb",
    );
    expect(screen.getAllByRole("button", { name: "금관" })).toHaveLength(1);
    expect(screen.queryByText("ê¸ˆê´€")).not.toBeInTheDocument();
  });

  it("passes equipped item models to the 3D viewer", () => {
    render(<MyDGTab {...PROPS} outfit={{ hat: "crown", hand: "camera" }} />);

    expect(screen.getByTestId("donggyeong-stub")).toHaveAttribute(
      "data-model-urls",
      "/models/donggyeong/items/crown.glb,/models/donggyeong/items/camera.glb",
    );
  });

  it("opens the selected quest on the map", () => {
    const onMapQuest = vi.fn();
    render(<MyDGTab {...PROPS} onMapQuest={onMapQuest} />);

    fireEvent.click(screen.getByRole("button", { name: `분황사 ${QUESTS[0].distance} · ${QUESTS[0].description}` }));

    expect(onMapQuest).toHaveBeenCalledWith(QUESTS[0]);
  });
});
