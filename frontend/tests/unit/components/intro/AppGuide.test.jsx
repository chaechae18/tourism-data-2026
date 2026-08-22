import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";
import AppGuide from "../../../../components/intro/AppGuide";

describe("AppGuide", () => {
  it("walks through every tab in order", () => {
    const onTabChange = vi.fn();
    const onDone = vi.fn();
    render(<AppGuide onDone={onDone} onTabChange={onTabChange} />);

    expect(screen.getByText("홈")).toBeInTheDocument();
    ["다음", "다음", "다음", "다음"].forEach((label) => fireEvent.click(screen.getByRole("button", { name: label })));
    fireEvent.click(screen.getByRole("button", { name: "캐릭터 고르러 가기" }));

    expect(onTabChange.mock.calls.map(([tab]) => tab)).toEqual(["home", "my-dg", "map", "spots", "my-page"]);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("can be skipped at any step", () => {
    const onDone = vi.fn();
    render(<AppGuide onDone={onDone} onTabChange={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "건너뛰기" }));

    expect(onDone).toHaveBeenCalledTimes(1);
  });
});
