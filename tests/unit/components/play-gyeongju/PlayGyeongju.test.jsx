import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";

vi.mock("../../../../components/intro/IntroScreen", () => ({
  default: ({ onPreview }) => <button type="button" onClick={onPreview}>데모 시작</button>,
}));
vi.mock("../../../../components/auth/AuthModal", () => ({ default: () => null }));
vi.mock("../../../../components/home/HomeTab", () => ({ default: () => <div>Home tab</div> }));
vi.mock("../../../../components/my-dg/MyDGTab", () => ({ default: () => <div>MyDG tab</div> }));
vi.mock("../../../../components/map/GyeongjuMap2D", () => ({ default: () => <div>Map tab</div> }));
vi.mock("../../../../components/spots/SpotsTab", () => ({ default: () => <div>Spots tab</div> }));
vi.mock("../../../../components/my-page/MyPageTab", () => ({ default: () => <div>My page tab</div> }));

import PlayGyeongju from "../../../../components/play-gyeongju/PlayGyeongju";

describe("PlayGyeongju", () => {
  it("shows Home after entering the demo", () => {
    render(<PlayGyeongju />);

    fireEvent.click(screen.getByRole("button", { name: "데모 시작" }));

    expect(screen.getByText("Home tab")).toBeInTheDocument();
  });
});
