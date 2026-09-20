import { act, fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";
import QuestResultModal from "../../../../components/map/QuestResultModal";

vi.mock("../../../../components/map/QuestConfetti", () => ({ default: () => <div data-testid="confetti" /> }));

afterEach(() => vi.useRealTimers());

it.each([
  ["hat", "신라 금관", "모자를 얻었어요!"],
  ["top", "홍색 왕의 예복", "상의를 얻었어요!"],
  ["bottom", "홍색 금수 하상", "하의를 얻었어요!"],
  ["hand", "목제 주판", "목제 주판 획득!"],
  ["effect", "교촌마을", "배경을 얻었어요!"],
])("shows the %s reward after confetti and keeps it open until acknowledged", (slot, name, title) => {
  vi.useFakeTimers();
  const onClose = vi.fn();
  render(<QuestResultModal result={{ type: "success", name: "방문 장소", reward: { slot, name } }} onClose={onClose} />);
  expect(screen.getByRole("dialog", { name: "퀘스트 완료!" })).toBeInTheDocument();
  expect(screen.getByTestId("confetti")).toBeInTheDocument();
  expect(screen.queryByText(name)).not.toBeInTheDocument();
  act(() => vi.advanceTimersByTime(2200));
  expect(screen.getByRole("dialog", { name: title })).toBeInTheDocument();
  expect(screen.getByText(name)).toBeInTheDocument();
  expect(screen.queryByTestId("confetti")).not.toBeInTheDocument();
  expect(onClose).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "좋아, 계속 탐험하기" }));
  expect(onClose).toHaveBeenCalledOnce();
});

it("does not skip an earned reward when dismissing the celebration early", () => {
  const onClose = vi.fn();
  render(<QuestResultModal result={{ type: "success", reward: { slot: "hat", name: "검은 갓" } }} onClose={onClose} />);
  fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
  expect(screen.getByRole("dialog", { name: "모자를 얻었어요!" })).toBeInTheDocument();
  expect(onClose).not.toHaveBeenCalled();
});

it("does not invent rewards for completions with no new item", () => {
  vi.useFakeTimers();
  render(<QuestResultModal result={{ type: "success", name: "완료한 장소", reward: null }} onClose={vi.fn()} />);
  act(() => vi.advanceTimersByTime(10000));
  expect(screen.getByRole("dialog", { name: "퀘스트 완료!" })).toBeInTheDocument();
  expect(screen.queryByText(/얻었어요/)).not.toBeInTheDocument();
});
