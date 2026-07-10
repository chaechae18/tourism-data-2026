import { render, screen } from "@testing-library/react";
import { vi } from "vitest";

vi.mock("../../../components/play-gyeongju/PlayGyeongju", () => ({
  default: () => <div>Play Gyeongju app</div>,
}));

import Page from "../../../app/page";

describe("Page", () => {
  it("renders the application shell", () => {
    render(<Page />);

    expect(screen.getByText("Play Gyeongju app")).toBeInTheDocument();
  });
});
