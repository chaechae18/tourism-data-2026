import { useState } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import { completeQuest, fetchCourse, fetchSelectedRole } from "../../../../lib/api/journey";
import { fetchInventory, saveOutfit } from "../../../../lib/api/inventory";
import { DONGGYEONG_ITEMS } from "../../../../lib/donggyeong/role-outfit";
import PlayGyeongju from "../../../../components/play-gyeongju/PlayGyeongju";

vi.mock("../../../../lib/api/journey", () => ({ completeQuest: vi.fn(), fetchCourse: vi.fn(), fetchSelectedRole: vi.fn() }));
vi.mock("../../../../lib/api/inventory", () => ({ fetchInventory: vi.fn(), saveOutfit: vi.fn() }));
vi.mock("../../../../lib/api/notifications", () => ({ notifyQuestCompleted: vi.fn().mockResolvedValue({}) }));
vi.mock("../../../../components/notifications/NotificationButton", () => ({ default: () => null }));
vi.mock("../../../../components/intro/AppGuide", () => ({ default: () => null }));
vi.mock("../../../../components/home/HomeTab", () => ({ default: () => <p>홈 화면</p> }));
vi.mock("../../../../components/journey/RoleSelect", () => ({
  ROLES: [{ key: "king", name: "왕", ready: true }, { key: "monk", name: "스님", ready: true }],
  default: ({ onSelect, open }) => <>
    {open && <p>역할 선택 창 열림</p>}
    <button onClick={() => onSelect({ key: "king", name: "왕", ready: true })}>왕 선택</button>
    <button onClick={() => onSelect({ key: "monk", name: "스님", ready: true })}>스님 선택</button>
  </>,
}));
vi.mock("../../../../components/map/GyeongjuMap2D", () => ({
  default: ({ onComplete, selectedPlace, completedQuestIds, onOpenRoles }) => {
    const [message, setMessage] = useState("");
    return <>
      <button onClick={onOpenRoles}>역할 바꾸기</button>
      <button onClick={async () => {
        try { const saved = await onComplete(selectedPlace.id, { demoCompletion: true }); setMessage(saved.reward?.name || "보상 없음"); }
        catch (error) { setMessage(error.message); }
      }}>완료 요청</button>
      <p>{selectedPlace.name}</p><p>완료 수: {completedQuestIds.length}</p><p>{message}</p>
    </>;
  },
}));
vi.mock("../../../../components/my-dg/MyDGTab", () => ({
  default: ({ availableItems, outfit, setOutfit, onSaveOutfit }) => <>
    <p>보유: {availableItems.map((item) => item.name).join(",")}</p>
    <p>착용: {outfit.hat || "없음"}</p>
    <button onClick={() => setOutfit({ hat: availableItems[0].id })}>모자 착용</button>
    <button onClick={onSaveOutfit}>복장 저장</button>
  </>,
}));

const HAT = DONGGYEONG_ITEMS.find((item) => item.id === "king_hat");
const PLACE = { id: "place-154", questId: 154, name: "방문 장소", latitude: 35.8, longitude: 129.2 };

beforeEach(() => {
  vi.stubGlobal("localStorage", { getItem: () => "1" });
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ user: { nickname: "사용자" } }) }));
  fetchSelectedRole.mockResolvedValue({ key: "king" });
  fetchCourse.mockResolvedValue({ places: [PLACE] });
  fetchInventory.mockResolvedValue({ items: [], outfit: {} });
});
afterEach(() => vi.unstubAllGlobals());

it("opens role selection without creating a default course even when the guide was already seen", async () => {
  fetchSelectedRole.mockResolvedValue(null);
  render(<PlayGyeongju />);
  await screen.findByText("역할 선택 창 열림");
  expect(fetchCourse).not.toHaveBeenCalled();
  expect(fetchInventory).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "스님 선택" }));
  await waitFor(() => expect(fetchCourse).toHaveBeenCalledWith(expect.objectContaining({ persona: "monk" })));
  expect(screen.queryByText("역할 선택 창 열림")).not.toBeInTheDocument();
});

it("restores an existing role without forcing role selection", async () => {
  render(<PlayGyeongju />);
  await waitFor(() => expect(fetchCourse).toHaveBeenCalledWith(expect.objectContaining({ persona: "king" })));
  expect(screen.queryByText("역할 선택 창 열림")).not.toBeInTheDocument();
});

it("connects the saved reward to the dialog, wardrobe and persisted outfit after reopening", async () => {
  completeQuest.mockResolvedValue({ completed: true, reward: HAT, inventory: { items: [HAT], outfit: {} } });
  saveOutfit.mockResolvedValue({ items: [HAT], outfit: { hat: HAT.id } });
  const first = render(<PlayGyeongju />);
  await screen.findByText("홈 화면");
  await waitFor(() => expect(fetchInventory).toHaveBeenCalledWith(expect.objectContaining({ persona: "king" })));
  fireEvent.click(screen.getByRole("button", { name: "지도", exact: true }));
  await screen.findByText("방문 장소");
  fireEvent.click(screen.getByRole("button", { name: "완료 요청" }));
  expect(await screen.findByText(HAT.name)).toBeInTheDocument();
  expect(screen.getByText("완료 수: 1")).toBeInTheDocument();
  expect(completeQuest).toHaveBeenCalledWith({ questId: PLACE.questId, demoCompletion: true });
  fireEvent.click(screen.getByRole("button", { name: "동경이", exact: true }));
  expect(screen.getByText(`보유: ${HAT.name}`)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "모자 착용" }));
  fireEvent.click(screen.getByRole("button", { name: "복장 저장" }));
  await waitFor(() => expect(saveOutfit).toHaveBeenCalledWith({ persona: "king", outfit: { hat: HAT.id } }));
  first.unmount();
  fetchInventory.mockResolvedValue({ items: [HAT], outfit: { hat: HAT.id } });
  render(<PlayGyeongju />);
  await screen.findByText("홈 화면");
  fireEvent.click(screen.getByRole("button", { name: "동경이", exact: true }));
  expect(await screen.findByText(`보유: ${HAT.name}`)).toBeInTheDocument();
  expect(screen.getByText(`착용: ${HAT.id}`)).toBeInTheDocument();
});

it("does not award or mark completed when saving fails", async () => {
  completeQuest.mockRejectedValue(new Error("저장 실패"));
  render(<PlayGyeongju />);
  await screen.findByText("홈 화면");
  fireEvent.click(screen.getByRole("button", { name: "지도", exact: true }));
  await screen.findByText("방문 장소");
  fireEvent.click(screen.getByRole("button", { name: "완료 요청" }));
  expect(await screen.findByText("저장 실패")).toBeInTheDocument();
  expect(screen.getByText("완료 수: 0")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "동경이", exact: true }));
  expect(screen.getByText("보유:")).toBeInTheDocument();
});

it("keeps the current course when reselecting a role and loads the next role's inventory", async () => {
  fetchInventory.mockResolvedValue({ items: [HAT], outfit: { hat: HAT.id } });
  render(<PlayGyeongju />);
  await screen.findByText("홈 화면");
  fireEvent.click(screen.getByRole("button", { name: "지도", exact: true }));
  await screen.findByText("방문 장소");
  fireEvent.click(screen.getByRole("button", { name: "역할 바꾸기" }));
  fireEvent.click(screen.getByRole("button", { name: "왕 선택" }));
  expect(screen.getByText("방문 장소")).toBeInTheDocument();
  fetchInventory.mockResolvedValue({ items: [], outfit: {} });
  fetchCourse.mockResolvedValue({ places: [{ ...PLACE, id: "place-155", questId: 155, name: "스님 방문 장소" }] });
  fireEvent.click(screen.getByRole("button", { name: "역할 바꾸기" }));
  fireEvent.click(screen.getByRole("button", { name: "스님 선택" }));
  await screen.findByText("스님 방문 장소");
  fireEvent.click(screen.getByRole("button", { name: "동경이", exact: true }));
  expect(screen.getByText("보유:")).toBeInTheDocument();
  expect(screen.getByText("착용: 없음")).toBeInTheDocument();
});
