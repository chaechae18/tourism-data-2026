import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";
import AppModal from "../../../../components/ui/AppModal";

describe("AppModal", () => {
  it("does not render when closed", () => {
    render(<AppModal open={false} title="로그인">내용</AppModal>);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("delegates the close action", () => {
    const onClose = vi.fn();
    render(<AppModal open onClose={onClose} title="로그인">내용</AppModal>);

    fireEvent.click(screen.getByRole("button", { name: "닫기" }));

    expect(onClose).toHaveBeenCalledOnce();
  });

  it("renders as a full-screen sheet", () => {
    render(<AppModal open onClose={vi.fn()} title="로그인">내용</AppModal>);

    expect(screen.getByRole("dialog", { name: "로그인" })).toHaveClass("app-modal-sheet", "h-[100svh]");
  });
});
