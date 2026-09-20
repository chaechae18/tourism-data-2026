import { useState } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { vi } from "vitest";
import { DONGGYEONG_ITEMS, getRoleOutfit } from "../../../../lib/donggyeong/role-outfit";
import { QUESTS } from "../../../../lib/app-data";
import { LanguageProvider, useI18n } from "../../../../components/i18n/LanguageProvider";

vi.mock("../../../../lib/api/users", () => ({
  getUserPreferences: vi.fn().mockResolvedValue({ language: "ko" }),
  updateUserLanguage: vi.fn(async (language) => ({ language })),
}));

vi.mock("../../../../components/donggyeong/Donggyeong3D", () => ({
  default: ({ items }) => <div data-testid="donggyeong-stub" data-model-urls={items.map((item) => item.modelUrl).join(",")} />,
}));

vi.mock("../../../../components/donggyeong/DonggyeongCamera", () => ({
  default: ({ onClose, items }) => <div role="dialog" aria-label="동경이와 사진찍기" data-items={items.map((item) => item.id).join(",")}><button onClick={onClose}>닫기</button></div>,
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
  it("opens the camera with the current outfit separately from saving the outfit", () => {
    const onSaveOutfit = vi.fn();
    render(<MyDGTab {...PROPS} outfit={{ hat: "king_hat" }} onSaveOutfit={onSaveOutfit} />);
    fireEvent.click(screen.getByRole("button", { name: "사진찍기" }));
    expect(screen.getByRole("dialog", { name: "동경이와 사진찍기" })).toHaveAttribute("data-items", "king_hat");
    expect(onSaveOutfit).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "닫기" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "착장 저장" }));
    expect(onSaveOutfit).toHaveBeenCalledOnce();
  });

  it.each([["머리", "hat"], ["손", "hand"], ["상의", "top"], ["하의", "bottom"], ["배경", "effect"]])("opens %s in a modal with only that slot's owned items", (label, slot) => {
    render(<MyDGTab {...PROPS} availableItems={DONGGYEONG_ITEMS.filter((item) => item.id.startsWith("king_"))} />);
    fireEvent.click(screen.getByRole("button", { name: label }));
    const dialog = screen.getByRole("dialog", { name: label });
    const item = DONGGYEONG_ITEMS.find((item) => item.id === `king_${slot}`);
    expect(within(dialog).getByRole("button", { name: item.name })).toBeInTheDocument();
    expect(within(dialog).getAllByRole("button")).toHaveLength(2);
    fireEvent.click(within(dialog).getByRole("heading", { name: label }));
    expect(dialog).toBeInTheDocument();
    fireEvent.click(dialog.parentElement);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("keeps keyboard focus in the item modal and restores focus and scrolling on Escape", () => {
    render(<MyDGTab {...PROPS} availableItems={DONGGYEONG_ITEMS} />);
    const trigger = screen.getByRole("button", { name: "머리" });
    const overflow = document.body.style.overflow;
    trigger.focus();
    fireEvent.click(trigger);
    const dialog = screen.getByRole("dialog", { name: "머리" });
    const buttons = within(dialog).getAllByRole("button");
    expect(buttons[0]).toHaveFocus();
    expect(document.body.style.overflow).toBe("hidden");
    fireEvent.keyDown(buttons[0], { key: "Tab", shiftKey: true });
    expect(buttons[buttons.length - 1]).toHaveFocus();
    fireEvent.keyDown(buttons[buttons.length - 1], { key: "Tab" });
    expect(buttons[0]).toHaveFocus();
    fireEvent.keyDown(buttons[0], { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    expect(document.body.style.overflow).toBe(overflow);
  });

  it("keeps API place names and descriptions through Korean → English → Korean", async () => {
    const onMapQuest = vi.fn();
    const place = { ...QUESTS[0], id: "place-154", name: "경주 시장", description: "시장 방문" };
    function TranslatedCourse() {
      const { language, changeLanguage, saving } = useI18n();
      const places = [{ ...place, ...(language === "en" ? { name: "Gyeongju Market", description: "Visit the market" } : {}) }];
      return <>
        <button disabled={saving} onClick={() => changeLanguage("en")}>English</button>
        <button disabled={saving} onClick={() => changeLanguage("ko")}>한국어</button>
        <MyDGTab {...PROPS} places={places} onMapQuest={onMapQuest} />
      </>;
    }
    render(<LanguageProvider><TranslatedCourse /></LanguageProvider>);
    expect(await screen.findByText("경주 시장")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "English" }));
    expect(await screen.findByText("Gyeongju Market")).toBeInTheDocument();
    expect(screen.getByText(/Visit the market/)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", { name: "한국어" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "한국어" }));
    fireEvent.click(await screen.findByRole("button", { name: /경주 시장.*시장 방문/ }));
    expect(onMapQuest).toHaveBeenCalledWith(place);
    expect(screen.queryByText(/quests\.place-/)).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", { name: "English" })).toBeEnabled());
  });

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
