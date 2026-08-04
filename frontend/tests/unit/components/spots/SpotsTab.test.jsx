import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import SpotsTab from "../../../../components/spots/SpotsTab";

const api = vi.hoisted(() => ({
  createSpot: vi.fn(),
  createSpotComment: vi.fn(),
  deleteSpot: vi.fn(),
  listMySpots: vi.fn(),
  listPublicSpots: vi.fn(),
  listSpotRanking: vi.fn(),
  listSpotComments: vi.fn(),
  searchNearbyPlaces: vi.fn(),
  searchPlaces: vi.fn(),
  setSpotReaction: vi.fn(),
  uploadSpotImage: vi.fn(),
}));

vi.mock("../../../../lib/api/spots", () => api);

const PLACE = {
  provider: "KAKAO",
  id: "8089382",
  name: "첨성대",
  address: "경북 경주시 인왕동 839-1",
  roadAddress: "",
  latitude: 35.8347,
  longitude: 129.2191,
  categoryName: "여행 > 관광,명소",
  categoryGroupCode: "AT4",
  categoryGroupName: "관광명소",
  phone: "",
  placeUrl: "http://place.map.kakao.com/8089382",
};

const SPOT = {
  id: 1,
  userNo: 1,
  authorNickname: "lotus_traveler",
  place: {
    provider: "KAKAO",
    mapPlaceId: "8089382",
    type: "TOUR",
    name: "첨성대",
    address: "경북 경주시 인왕동 839-1",
    latitude: 35.8347,
    longitude: 129.2191,
  },
  photoUrl: null,
  caption: "밤에 다시 보고 싶은 장소예요.",
  likeCount: 0,
  commentCount: 0,
  isLiked: false,
  isBookmarked: false,
  isOwner: true,
  moderationStatus: 1,
  createdAt: "2026-07-29T10:30:00",
};

describe("SpotsTab", () => {
  beforeEach(() => {
    api.listPublicSpots.mockResolvedValue([]);
    api.listSpotRanking.mockResolvedValue([]);
    api.listMySpots.mockResolvedValue([]);
    api.searchPlaces.mockResolvedValue({ places: [PLACE] });
    api.searchNearbyPlaces.mockResolvedValue({
      places: [{ ...PLACE, distance: 120 }],
    });
    api.createSpot.mockResolvedValue({ ...SPOT, moderationStatus: 0 });
    api.deleteSpot.mockResolvedValue(null);
    api.listSpotComments.mockResolvedValue([]);
    api.createSpotComment.mockResolvedValue({
      id: 1,
      spotId: 1,
      userNo: 1,
      authorNickname: "lotus_traveler",
      content: "야경이 좋아요.",
      moderationStatus: 0,
      isOwner: true,
      createdAt: "2026-07-29T10:31:00",
    });
    api.setSpotReaction.mockResolvedValue({
      spotId: 1,
      type: "like",
      active: true,
      likeCount: 1,
    });
  });

  it("searches for a place and registers the selected result", async () => {
    render(<SpotsTab />);
    fireEvent.click(screen.getByRole("button", { name: "나의 스팟 등록" }));

    fireEvent.change(screen.getByPlaceholderText("어디에서 발견했나요?"), {
      target: { value: "첨성대" },
    });
    fireEvent.click(await screen.findByRole("button", { name: /첨성대/ }));
    fireEvent.change(
      screen.getByPlaceholderText("경주에서 발견한 순간을 350자 이내로 남겨 보세요."),
      { target: { value: "고즈넉한 오후였습니다." } },
    );
    fireEvent.click(screen.getByRole("button", { name: "스팟 공유" }));

    await waitFor(() => expect(api.createSpot).toHaveBeenCalledWith({
      place: PLACE,
      placeType: "TOUR",
      caption: "고즈넉한 오후였습니다.",
      photoUrl: null,
    }));
  });

  it("loads nearby places from the current location", async () => {
    const getCurrentPosition = vi.fn((success) => success({
      coords: {
        latitude: 35.8347,
        longitude: 129.2191,
      },
    }));
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: { getCurrentPosition },
    });
    render(<SpotsTab />);
    fireEvent.click(screen.getByRole("button", { name: "나의 스팟 등록" }));

    fireEvent.click(screen.getByRole("button", { name: "내 주변 장소" }));

    await waitFor(() => expect(api.searchNearbyPlaces).toHaveBeenCalledWith({
      latitude: 35.8347,
      longitude: 129.2191,
    }));
    expect(await screen.findByRole("button", { name: /첨성대.*120m/ })).toBeInTheDocument();
    expect(getCurrentPosition).toHaveBeenCalledWith(
      expect.any(Function),
      expect.any(Function),
      {
        enableHighAccuracy: false,
        maximumAge: 300_000,
        timeout: 8_000,
      },
    );
  });

  it("rejects a review containing a blocked expression", async () => {
    render(<SpotsTab />);
    fireEvent.click(screen.getByRole("button", { name: "나의 스팟 등록" }));

    fireEvent.change(screen.getByPlaceholderText("어디에서 발견했나요?"), {
      target: { value: "첨성대" },
    });
    fireEvent.click(await screen.findByRole("button", { name: /첨성대/ }));
    fireEvent.change(
      screen.getByPlaceholderText("경주에서 발견한 순간을 350자 이내로 남겨 보세요."),
      { target: { value: "바보 같은 글" } },
    );
    fireEvent.click(screen.getByRole("button", { name: "스팟 공유" }));

    expect(api.createSpot).not.toHaveBeenCalled();
    expect(screen.getByText("한줄평에 사용할 수 없는 표현이 있어요.")).toBeInTheDocument();
  });

  it("deletes the current user's spot", async () => {
    api.listMySpots.mockResolvedValue([{ ...SPOT, moderationStatus: 0 }]);
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<SpotsTab />);
    fireEvent.click(screen.getByRole("button", { name: "나의 스팟 등록" }));

    fireEvent.click(await screen.findByRole("button", { name: "내 스팟 삭제" }));

    await waitFor(() => expect(api.deleteSpot).toHaveBeenCalledWith(1));
  });

  it("likes a public spot and submits a comment", async () => {
    api.listPublicSpots.mockResolvedValue([SPOT]);
    render(<SpotsTab />);
    fireEvent.click(screen.getByRole("button", { name: "목록" }));

    fireEvent.click(await screen.findByRole("button", { name: "좋아요" }));
    await waitFor(() => expect(api.setSpotReaction).toHaveBeenCalledWith(1, "like", true));

    fireEvent.click(screen.getByRole("button", { name: "댓글" }));
    await screen.findByPlaceholderText("댓글을 남겨보세요");
    fireEvent.change(screen.getByPlaceholderText("댓글을 남겨보세요"), {
      target: { value: "야경이 좋아요." },
    });
    fireEvent.click(screen.getByRole("button", { name: "등록" }));

    await waitFor(() => expect(api.createSpotComment).toHaveBeenCalledWith(
      1,
      "야경이 좋아요.",
    ));
  });

  it("opens on the daily ranking tab", async () => {
    api.listSpotRanking.mockResolvedValue([{ ...SPOT, rank: 1 }]);
    render(<SpotsTab />);

    expect(screen.getByRole("button", { name: "랭킹" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(await screen.findByText("오늘 00:00 기준")).toBeInTheDocument();
    expect(await screen.findByText("1")).toBeInTheDocument();
  });

  it("reloads the list with the selected order", async () => {
    render(<SpotsTab />);
    fireEvent.click(screen.getByRole("button", { name: "목록" }));
    fireEvent.change(screen.getByLabelText("스팟 목록 정렬"), {
      target: { value: "newest" },
    });

    await waitFor(() => expect(api.listPublicSpots).toHaveBeenLastCalledWith("newest"));
  });
});
