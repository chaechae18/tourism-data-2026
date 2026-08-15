import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, vi } from "vitest";

vi.mock("../../../../components/intro/IntroScreen", () => ({
  default: ({ onAuth }) => <button type="button" onClick={() => onAuth("login")}>로그인</button>,
}));
vi.mock("../../../../components/auth/AuthModal", () => ({
  default: ({ mode }) => <div>{mode || "closed"}</div>,
}));
vi.mock("../../../../components/home/HomeTab", () => ({ default: () => <div>Home tab</div> }));
vi.mock("../../../../components/my-dg/MyDGTab", () => ({ default: () => <div>MyDG tab</div> }));
vi.mock("../../../../components/map/GyeongjuMap2D", () => ({ default: () => <div>Map tab</div> }));
vi.mock("../../../../components/spots/SpotsTab", () => ({ default: () => <div>Spots tab</div> }));
vi.mock("../../../../components/my-page/MyPageTab", () => ({ default: () => <div>My page tab</div> }));

import PlayGyeongju from "../../../../components/play-gyeongju/PlayGyeongju";

describe("PlayGyeongju", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("passes the login mode to the authentication modal", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    render(<PlayGyeongju />);

    fireEvent.click(await screen.findByRole("button", { name: "로그인" }));

    expect(screen.getByText("login")).toBeInTheDocument();
  });
});
