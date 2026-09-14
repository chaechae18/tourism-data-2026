import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import { LanguageProvider, useI18n } from "../../../../components/i18n/LanguageProvider";

const userApi = vi.hoisted(() => ({
  getUserPreferences: vi.fn(),
  updateUserLanguage: vi.fn(),
}));

vi.mock("../../../../lib/api/users", () => userApi);

function LanguageProbe() {
  const { changeLanguage, language, reloadLanguage, resetLanguage, t } = useI18n();
  return (
    <div>
      <p>{language}</p>
      <p>{t("nav.home")}</p>
      <button type="button" onClick={() => changeLanguage("en").catch(() => undefined)}>
        English
      </button>
      <button type="button" onClick={() => reloadLanguage().catch(() => undefined)}>Reload</button>
      <button type="button" onClick={resetLanguage}>Reset</button>
    </div>
  );
}

describe("LanguageProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    userApi.getUserPreferences.mockResolvedValue({ language: "ko" });
  });

  it("loads the saved backend language", async () => {
    userApi.getUserPreferences.mockResolvedValue({ language: "ja" });
    render(<LanguageProvider><LanguageProbe /></LanguageProvider>);

    expect(await screen.findByText("ホーム")).toBeInTheDocument();
    expect(document.documentElement.lang).toBe("ja");
  });

  it("updates optimistically and rolls back when persistence fails", async () => {
    let rejectUpdate;
    userApi.updateUserLanguage.mockImplementation(() => new Promise((_, reject) => {
      rejectUpdate = reject;
    }));
    render(<LanguageProvider><LanguageProbe /></LanguageProvider>);
    await waitFor(() => expect(userApi.getUserPreferences).toHaveBeenCalledOnce());

    fireEvent.click(screen.getByRole("button", { name: "English" }));
    expect(screen.getByText("Home")).toBeInTheDocument();

    rejectUpdate(new Error("save failed"));
    expect(await screen.findByText("홈")).toBeInTheDocument();
  });

  it("loads the next account's language and clears it on logout", async () => {
    render(<LanguageProvider><LanguageProbe /></LanguageProvider>);
    await waitFor(() => expect(userApi.getUserPreferences).toHaveBeenCalledOnce());

    userApi.getUserPreferences.mockResolvedValue({ language: "zh" });
    fireEvent.click(screen.getByRole("button", { name: "Reload" }));
    expect(await screen.findByText("zh")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    expect(screen.getByText("ko")).toBeInTheDocument();
  });
});
