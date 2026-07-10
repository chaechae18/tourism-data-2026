import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { HOME_CONTENT } from "../../../../lib/app-data";
import HomeTab from "../../../../components/home/HomeTab";

describe("HomeTab", () => {
  it("opens the map from the nearby-place action", () => {
    const onMapOpen = vi.fn();
    render(<HomeTab onMapOpen={onMapOpen} />);

    fireEvent.click(screen.getByRole("button", { name: "가까운 장소 보기" }));

    expect(onMapOpen).toHaveBeenCalledOnce();
  });

  it("links to the official tourism site", () => {
    render(<HomeTab onMapOpen={vi.fn()} />);

    expect(screen.getByRole("link", { name: "경주 관광 정보" })).toHaveAttribute("href", HOME_CONTENT.tourismUrl);
  });
});
