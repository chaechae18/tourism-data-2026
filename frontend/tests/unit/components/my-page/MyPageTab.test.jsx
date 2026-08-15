import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import MyPageTab from "../../../../components/my-page/MyPageTab";
import { LanguageProvider } from "../../../../components/i18n/LanguageProvider";

const userApi = vi.hoisted(() => ({
  getUserPreferences: vi.fn(),
  updateUserLanguage: vi.fn(),
}));

vi.mock("../../../../lib/api/users", () => userApi);

const PROPS = {
  completedQuestIds: [],
  onLogout: vi.fn(),
  onNotice: vi.fn(),
  setUser: vi.fn(),
  user: { email: "traveler@example.com", language: "ko", nickname: "lotus_traveler" },
};

describe("MyPageTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    userApi.getUserPreferences.mockResolvedValue({ language: "ko" });
    userApi.updateUserLanguage.mockResolvedValue({ language: "en" });
  });

  it("persists the selected language and applies it immediately", async () => {
    render(
      <LanguageProvider>
        <MyPageTab {...PROPS} />
      </LanguageProvider>,
    );

    await waitFor(() => expect(userApi.getUserPreferences).toHaveBeenCalledOnce());

    fireEvent.click(screen.getByRole("button", { name: "English" }));

    expect(screen.getByText("My travel settings")).toBeInTheDocument();
    await waitFor(() => expect(userApi.updateUserLanguage).toHaveBeenCalledWith("en"));
  });

  it("logs the user out from the withdrawal action", () => {
    const onLogout = vi.fn();
    render(<MyPageTab {...PROPS} onLogout={onLogout} />);

    fireEvent.click(screen.getByRole("button", { name: "회원 탈퇴" }));

    expect(onLogout).toHaveBeenCalledOnce();
  });
});
