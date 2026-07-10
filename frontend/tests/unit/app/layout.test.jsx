import RootLayout from "../../../app/layout";

describe("RootLayout", () => {
  it("sets Korean as the document language", () => {
    const layout = RootLayout({ children: "content" });

    expect(layout.props.lang).toBe("ko");
  });
});
