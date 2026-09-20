import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import { LanguageProvider } from "../../../../components/i18n/LanguageProvider";
import TranslatableText from "../../../../components/spots/TranslatableText";

const userApi = vi.hoisted(() => ({
  getUserPreferences: vi.fn(),
  updateUserLanguage: vi.fn(),
}));
const translationApi = vi.hoisted(() => ({ translateText: vi.fn() }));

vi.mock("../../../../lib/api/users", () => userApi);
vi.mock("../../../../lib/api/translations", () => translationApi);

function renderText(properties) {
  return render(
    <LanguageProvider>
      <TranslatableText targetType="spot" targetId={7} text="すばらしい眺め" {...properties} />
    </LanguageProvider>,
  );
}

describe("TranslatableText", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    userApi.getUserPreferences.mockResolvedValue({ language: "ko" });
  });

  it("translates the place name with the text and toggles both back", async () => {
    translationApi.translateText.mockResolvedValue({
      language: "ko",
      text: "멋진 풍경",
      placeName: "첨성대",
    });
    renderText({ sourceLanguage: "ja", name: "瞻星台", nameClassName: "title" });

    fireEvent.click(await screen.findByRole("button", { name: "번역하기" }));
    expect(translationApi.translateText).toHaveBeenCalledWith("spot", 7, "ko");

    expect(await screen.findByText("멋진 풍경")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "첨성대" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "원문 보기" }));
    expect(screen.getByText("すばらしい眺め")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "瞻星台" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "번역하기" }));
    expect(await screen.findByText("멋진 풍경")).toBeInTheDocument();
    expect(translationApi.translateText).toHaveBeenCalledOnce();
  });

  it("hides the button when the post is already in the viewer language", async () => {
    renderText({ sourceLanguage: "ko", text: "멋진 풍경" });

    await waitFor(() => expect(userApi.getUserPreferences).toHaveBeenCalledOnce());
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("keeps the original text when translation fails", async () => {
    translationApi.translateText.mockRejectedValue(new Error("boom"));
    renderText({ sourceLanguage: "ja" });

    fireEvent.click(await screen.findByRole("button", { name: "번역하기" }));

    expect(await screen.findByText(/번역하지 못했어요/)).toBeInTheDocument();
    expect(screen.getByText("すばらしい眺め")).toBeInTheDocument();
  });
});
