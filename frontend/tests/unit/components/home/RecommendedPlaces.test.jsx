import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import RecommendedPlaces from "../../../../components/home/RecommendedPlaces";

const PLACE = {
  name: "불국사",
  text: "유네스코 세계문화유산",
  address: "경북 경주시 불국로 385",
  latitude: 35.790102,
  longitude: 129.332099,
  admission_fee: "성인 6,000원",
};

describe("RecommendedPlaces", () => {
  it("renders the name, blurb and address", () => {
    render(<RecommendedPlaces loading={false} places={[PLACE]} />);

    expect(screen.getByText("불국사")).toBeInTheDocument();
    expect(screen.getByText("유네스코 세계문화유산")).toBeInTheDocument();
    expect(screen.getByText("경북 경주시 불국로 385")).toBeInTheDocument();
  });

  it("shows the admission fee as a badge", () => {
    render(<RecommendedPlaces loading={false} places={[PLACE]} />);

    expect(screen.getByText("성인 6,000원")).toBeInTheDocument();
  });

  it("omits the fee badge when the column is empty", () => {
    render(<RecommendedPlaces loading={false} places={[{ ...PLACE, admission_fee: null }]} />);

    expect(screen.queryByText("성인 6,000원")).not.toBeInTheDocument();
    expect(screen.getByText("불국사")).toBeInTheDocument();
  });

  it("renders a place whose coordinates failed to parse", () => {
    render(<RecommendedPlaces loading={false} places={[{ ...PLACE, latitude: null, longitude: null }]} />);

    expect(screen.getByText("불국사")).toBeInTheDocument();
  });

  it("keeps the API order rather than re-sorting", () => {
    const places = [
      { ...PLACE, name: "불국사" },
      { ...PLACE, name: "첨성대" },
      { ...PLACE, name: "대릉원" },
    ];
    render(<RecommendedPlaces loading={false} places={places} />);

    const rendered = screen.getAllByRole("heading", { level: 3 }).map((el) => el.textContent);
    expect(rendered).toEqual(["불국사", "첨성대", "대릉원"]);
  });

  it("says so when nothing is recommended", () => {
    render(<RecommendedPlaces loading={false} places={[]} />);

    expect(screen.getByText("추천 중인 관광지가 없어요.")).toBeInTheDocument();
  });
});
