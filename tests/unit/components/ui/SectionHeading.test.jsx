import { render, screen } from "@testing-library/react";
import SectionHeading from "../../../../components/ui/SectionHeading";

describe("SectionHeading", () => {
  it("renders the section title", () => {
    render(<SectionHeading eyebrow="Quest" title="방문 퀘스트" />);

    expect(screen.getByRole("heading", { name: "방문 퀘스트" })).toBeInTheDocument();
  });
});
