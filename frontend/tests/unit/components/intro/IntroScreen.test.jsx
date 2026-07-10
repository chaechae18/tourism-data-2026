import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";
import IntroScreen from "../../../../components/intro/IntroScreen";

describe("IntroScreen", () => {
  it("opens the login flow", () => {
    const onAuth = vi.fn();
    render(<IntroScreen onAuth={onAuth} />);

    fireEvent.click(screen.getByRole("button", { name: "로그인" }));

    expect(onAuth).toHaveBeenCalledWith("login");
  });
});
