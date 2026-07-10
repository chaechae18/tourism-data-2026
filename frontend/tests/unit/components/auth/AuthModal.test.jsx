import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";
import AuthModal from "../../../../components/auth/AuthModal";

describe("AuthModal", () => {
  it("requires consent before completing sign-up", () => {
    render(<AuthModal mode="signup" onClose={vi.fn()} onComplete={vi.fn()} />);

    expect(screen.getByRole("button", { name: "동의하고 시작하기" })).toBeDisabled();
  });

  it("passes the submitted profile to the completion handler", () => {
    const onComplete = vi.fn();
    render(<AuthModal mode="signup" onClose={vi.fn()} onComplete={onComplete} />);

    fireEvent.change(screen.getByPlaceholderText("여행자 이름"), { target: { value: "경주여행자" } });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "동의하고 시작하기" }));

    expect(onComplete).toHaveBeenCalledWith({ nickname: "경주여행자", email: "traveler@example.com" });
  });
});
