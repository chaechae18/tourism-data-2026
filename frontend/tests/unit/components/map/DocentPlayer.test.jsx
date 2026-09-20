import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import DocentPlayer from "../../../../components/map/DocentPlayer";

const PLACE = { id: "place-41", placeId: 41, name: "경주 동궁과 월지", docent: true };
const SCRIPT = "동궁과 월지는 신라 왕궁의 별궁 터다.";

describe("DocentPlayer", () => {
  beforeEach(() => {
    vi.stubGlobal("URL", class extends URL {
      static createObjectURL = vi.fn(() => "blob:docent-audio");
      static revokeObjectURL = vi.fn();
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  function stubScript(payload = { placeId: 41, name: PLACE.name, text: SCRIPT, source: "한국관광공사" }, ok = true) {
    vi.stubGlobal("fetch", vi.fn((url) => Promise.resolve(url.includes("/audio?") ? {
      ok: true,
      blob: () => Promise.resolve(new Blob(["audio"], { type: "audio/mpeg" })),
    } : {
      ok,
      status: ok ? 200 : 404,
      json: () => Promise.resolve(payload),
    })));
  }

  it("plays the place description from the docent audio endpoint", async () => {
    stubScript();
    const { unmount } = render(<DocentPlayer onClose={vi.fn()} place={PLACE} />);

    const audio = await screen.findByTestId("docent-audio");
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining("/api/v1/journey/docent/41/audio?lang=ko"), expect.objectContaining({ signal: expect.any(AbortSignal) }));
    expect(audio).toHaveAttribute("src", "blob:docent-audio");
    expect(URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    expect(await screen.findByText(SCRIPT)).toBeInTheDocument();
    unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:docent-audio");
  });

  it("shows the script and its source alongside the player", async () => {
    stubScript();
    render(<DocentPlayer onClose={vi.fn()} place={PLACE} />);

    expect(await screen.findByText("한국관광공사")).toBeInTheDocument();
    expect(screen.getByText("출처")).toBeInTheDocument();
    fireEvent.canPlayThrough(await screen.findByTestId("docent-audio"));
    expect(screen.getByRole("button", { name: "도슨트 재생" })).toBeEnabled();
  });

  it("reports a script that could not be loaded", async () => {
    stubScript({ error: { code: "DOCENT_NOT_FOUND", message: "읽어 줄 설명이 없는 장소입니다." } }, false);
    render(<DocentPlayer onClose={vi.fn()} place={PLACE} />);

    await waitFor(() => {
      expect(screen.getByText("읽어 줄 설명이 없는 장소입니다.")).toBeInTheDocument();
    });
  });
});
