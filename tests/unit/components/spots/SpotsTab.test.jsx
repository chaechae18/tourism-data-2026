import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { SPOT_RANKING } from "../../../../lib/app-data";
import SpotsTab from "../../../../components/spots/SpotsTab";

const PROPS = {
  bookmarks: [],
  commentsBySpot: {},
  onAddComment: vi.fn(),
  onAddSpot: vi.fn(),
  onBookmark: vi.fn(),
  onLike: vi.fn(),
  spots: SPOT_RANKING,
  user: { nickname: "lotus_traveler" },
};

describe("SpotsTab", () => {
  it("submits a valid spot without changing the ranking list", () => {
    const onAddSpot = vi.fn();
    render(<SpotsTab {...PROPS} onAddSpot={onAddSpot} />);

    fireEvent.change(screen.getByPlaceholderText("어디에서 발견했나요?"), { target: { value: "교촌마을" } });
    fireEvent.change(screen.getByPlaceholderText("경주에서 발견한 순간을 350자 이내로 남겨 보세요."), { target: { value: "고즈넉한 오후였습니다." } });
    fireEvent.click(screen.getByRole("button", { name: "스팟 공유" }));

    expect(onAddSpot).toHaveBeenCalledOnce();
  });

  it("rejects a review containing a blocked expression", () => {
    const onAddSpot = vi.fn();
    render(<SpotsTab {...PROPS} onAddSpot={onAddSpot} />);

    fireEvent.change(screen.getByPlaceholderText("어디에서 발견했나요?"), { target: { value: "교촌마을" } });
    fireEvent.change(screen.getByPlaceholderText("경주에서 발견한 순간을 350자 이내로 남겨 보세요."), { target: { value: "바보 같은 글" } });
    fireEvent.click(screen.getByRole("button", { name: "스팟 공유" }));

    expect(onAddSpot).not.toHaveBeenCalled();
  });
});
