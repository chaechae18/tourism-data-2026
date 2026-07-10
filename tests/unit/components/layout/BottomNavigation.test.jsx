import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";
import BottomNavigation from "../../../../components/layout/BottomNavigation";

describe("BottomNavigation", () => {
  it("changes to the selected tab", () => {
    const onChange = vi.fn();
    render(<BottomNavigation activeTab="home" onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: "Map" }));

    expect(onChange).toHaveBeenCalledWith("map");
  });
});
