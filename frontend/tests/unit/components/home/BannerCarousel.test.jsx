import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import BannerCarousel from "../../../../components/home/BannerCarousel";

const BANNER = { img: "/night.png", title: "경주의 밤", sub_title: "첨성대 야경", link: "/night" };

describe("BannerCarousel", () => {
  it("renders the title and subtitle over the image", () => {
    render(<BannerCarousel banners={[BANNER]} loading={false} />);

    expect(screen.getByText("경주의 밤")).toBeInTheDocument();
    expect(screen.getByText("첨성대 야경")).toBeInTheDocument();
  });

  it("wraps a banner in a link when the API supplied one", () => {
    render(<BannerCarousel banners={[BANNER]} loading={false} />);

    expect(screen.getByRole("link")).toHaveAttribute("href", "/night");
  });

  it("renders a banner without a link as plain content", () => {
    render(<BannerCarousel banners={[{ ...BANNER, link: null }]} loading={false} />);

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByText("경주의 밤")).toBeInTheDocument();
  });

  it("survives a banner that has no image", () => {
    render(<BannerCarousel banners={[{ ...BANNER, img: null }]} loading={false} />);

    expect(screen.getByText("경주의 밤")).toBeInTheDocument();
  });

  it("hides the banner image from screen readers as decoration", () => {
    const { container } = render(<BannerCarousel banners={[BANNER]} loading={false} />);

    expect(container.querySelector("img")).toHaveAttribute("aria-hidden", "true");
  });

  it("says so when nothing is on display", () => {
    render(<BannerCarousel banners={[]} loading={false} />);

    expect(screen.getByText("지금 노출 중인 배너가 없어요.")).toBeInTheDocument();
  });

  it("offers a retry when the request failed", () => {
    const onRetry = vi.fn();
    render(<BannerCarousel banners={null} error={new Error("서버에 연결하지 못했습니다.")} loading={false} onRetry={onRetry} />);

    expect(screen.getByRole("alert")).toHaveTextContent("불러오지 못했어요");
    expect(screen.getByRole("button", { name: "다시 시도" })).toBeInTheDocument();
  });
});
