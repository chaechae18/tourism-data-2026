import { useState } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { vi } from "vitest";
import { DONGGYEONG_ITEMS, getRoleOutfit } from "../../../../lib/donggyeong/role-outfit";
import { QUESTS } from "../../../../lib/app-data";

vi.mock("../../../../components/donggyeong/Donggyeong3D", () => ({
  default: ({ items }) => (
    <div
      data-testid="donggyeong-stub"
      data-model-urls={items.map((item) => item.modelUrl).join(",")}
    />
  ),
}));


import MyDGTab from "../../../../components/my-dg/MyDGTab";

const PROPS = {
  completedQuestIds: [],
  onMapQuest: vi.fn(),
  onSaveOutfit: vi.fn(),
  outfit: {},
  setOutfit: vi.fn(),
};

describe("MyDGTab", () => {
  it("shows the correct Donggyeong number", () => {
    render(<MyDGTab {...PROPS} />);

    expect(screen.getByText("540 · 내 동경이")).toBeInTheDocument();
  });

  it("renders item graphics without font-dependent symbol glyphs", () => {
    render(<MyDGTab {...PROPS} />);

    expect(screen.queryByText("♛")).not.toBeInTheDocument();
    expect(screen.queryByText("✿")).not.toBeInTheDocument();
  });

  it("passes a complete five-slot role outfit to the viewer", () => {
    render(<MyDGTab {...PROPS} outfit={getRoleOutfit("hwarang")} />);
    const urls = screen.getByTestId("donggyeong-stub").getAttribute("data-model-urls").split(",");
    expect(urls).toHaveLength(5);
    expect(urls.every((url) => url.includes("/warrior/") && url.includes("?v="))).toBe(true);
  });

  it("equips and removes an owned item without changing the other slots", () => {
    function Wardrobe() {
      const [outfit, setOutfit] = useState(getRoleOutfit("king"));
      return <MyDGTab {...PROPS} availableItems={DONGGYEONG_ITEMS} outfit={outfit} setOutfit={setOutfit} />;
    }
    render(<Wardrobe />);
    const hat = DONGGYEONG_ITEMS.find((item) => item.id === "warrior_hat");
    const hand = DONGGYEONG_ITEMS.find((item) => item.id === "king_hand");

    fireEvent.click(screen.getByRole("button", { name: "머리" }));
    const dialog = screen.getByRole("dialog", { name: "머리" });
    expect(within(dialog).queryByText(hand.name)).not.toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: hat.name }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByTestId("donggyeong-stub")).toHaveAttribute("data-model-urls", expect.stringContaining(hat.modelUrl));
    expect(screen.getByTestId("donggyeong-stub")).toHaveAttribute("data-model-urls", expect.stringContaining(hand.modelUrl));

    fireEvent.click(screen.getByRole("button", { name: "머리" }));
    expect(screen.getByRole("button", { name: hat.name })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "착용 해제" }));
    expect(screen.getByTestId("donggyeong-stub").getAttribute("data-model-urls")).not.toContain(hat.modelUrl);
    expect(screen.getByTestId("donggyeong-stub")).toHaveAttribute("data-model-urls", expect.stringContaining(hand.modelUrl));
  });

  it("does not offer unowned items and leaves the outfit unchanged when closed", () => {
    const setOutfit = vi.fn();
    render(<MyDGTab {...PROPS} setOutfit={setOutfit} />);
    fireEvent.click(screen.getByRole("button", { name: "머리" }));
    expect(screen.getByText("획득한 아이템이 없어요")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "신라 금관" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "닫기" }));
    expect(setOutfit).not.toHaveBeenCalled();
  });

  it("opens the selected quest on the map", () => {
    const onMapQuest = vi.fn();
    render(<MyDGTab {...PROPS} onMapQuest={onMapQuest} />);

    fireEvent.click(screen.getByRole("button", { name: `분황사 ${QUESTS[0].distance} · ${QUESTS[0].description}` }));

    expect(onMapQuest).toHaveBeenCalledWith(QUESTS[0]);
  });
});
