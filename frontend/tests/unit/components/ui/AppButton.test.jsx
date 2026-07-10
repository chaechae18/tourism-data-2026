import { fireEvent, render, screen } from "@testing-library/react";
import { Send } from "lucide-react";
import { vi } from "vitest";
import AppButton, { IconButton } from "../../../../components/ui/AppButton";

describe("AppButton", () => {
  it("calls the supplied action", () => {
    const onClick = vi.fn();
    render(<AppButton onClick={onClick}>저장</AppButton>);

    fireEvent.click(screen.getByRole("button", { name: "저장" }));

    expect(onClick).toHaveBeenCalledOnce();
  });

  it("exposes an accessible label for icon-only controls", () => {
    render(<IconButton icon={Send} label="전송" />);

    expect(screen.getByRole("button", { name: "전송" })).toBeInTheDocument();
  });
});
