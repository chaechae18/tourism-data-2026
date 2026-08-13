import { render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import DocentPlayer from "../../../../components/map/DocentPlayer";

const PLACE = { id: "place-41", placeId: 41, name: "경주 동궁과 월지", docent: true };
const SCRIPT = "동궁과 월지는 신라 왕궁의 별궁 터다.";

describe("DocentPlayer", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function stubScript(payload = { placeId: 41, name: PLACE.name, text: SCRIPT, source: "한국관광공사" }) {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({
      ok: true,
      json: () => Promise.resolve(payload),
    })));
  }

  it("plays the place description from the docent audio endpoint", async () => {
    stubScript();
    const { container } = render(<DocentPlayer onClose={vi.fn()} place={PLACE} />);

    const audio = container.querySelector("audio");
    expect(audio).toHaveAttribute("src", expect.stringContaining("/api/v1/journey/docent/41/audio"));
    expect(await screen.findByText(SCRIPT)).toBeInTheDocument();
  });

  it("shows the script and its source alongside the player", async () => {
    stubScript();
    render(<DocentPlayer onClose={vi.fn()} place={PLACE} />);

    expect(await screen.findByText("출처: 한국관광공사")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "도슨트 재생" })).toBeInTheDocument();
  });

  it("reports a script that could not be loaded", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({
      ok: false,
      status: 404,
      json: () => Promise.resolve({ error: { code: "DOCENT_NOT_FOUND", message: "읽어 줄 설명이 없는 장소입니다." } }),
    })));
    render(<DocentPlayer onClose={vi.fn()} place={PLACE} />);

    await waitFor(() => {
      expect(screen.getByText("읽어 줄 설명이 없는 장소입니다.")).toBeInTheDocument();
    });
  });
});
