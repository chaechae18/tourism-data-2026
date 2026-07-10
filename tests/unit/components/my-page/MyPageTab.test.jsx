import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";
import MyPageTab from "../../../../components/my-page/MyPageTab";

const PROPS = {
  completedQuestIds: [],
  onLogout: vi.fn(),
  onNotice: vi.fn(),
  setUser: vi.fn(),
  user: { email: "traveler@example.com", language: "ko", nickname: "lotus_traveler" },
};

describe("MyPageTab", () => {
  it("updates language through the user state setter", () => {
    const setUser = vi.fn();
    render(<MyPageTab {...PROPS} setUser={setUser} />);

    fireEvent.click(screen.getByRole("button", { name: "English" }));

    expect(setUser).toHaveBeenCalledOnce();
  });

  it("logs the user out from the withdrawal action", () => {
    const onLogout = vi.fn();
    render(<MyPageTab {...PROPS} onLogout={onLogout} />);

    fireEvent.click(screen.getByRole("button", { name: "회원 탈퇴" }));

    expect(onLogout).toHaveBeenCalledOnce();
  });
});
