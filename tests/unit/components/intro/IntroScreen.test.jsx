import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";

vi.mock("../../../../components/donggyeong/Donggyeong3D", () => ({
  default: () => <div data-testid="donggyeong-stub" />,
}));

import IntroScreen from "../../../../components/intro/IntroScreen";

describe("IntroScreen", () => {
  it("opens the sign-up flow", () => {
    const onAuth = vi.fn();
    render(<IntroScreen onAuth={onAuth} onPreview={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "회원가입" }));

    expect(onAuth).toHaveBeenCalledWith("signup");
  });
});
