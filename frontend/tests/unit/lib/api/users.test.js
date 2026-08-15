import { vi } from "vitest";
import { getUserPreferences, updateUserLanguage } from "../../../../lib/api/users";

const ENDPOINT = "http://localhost:8001/api/v1/users/me/preferences";

describe("users api", () => {
  it("loads and persists the local user's language preference", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ language: "en" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(getUserPreferences()).resolves.toEqual({ language: "en" });
    await updateUserLanguage("en");

    expect(fetchMock).toHaveBeenNthCalledWith(1, ENDPOINT, expect.objectContaining({
      headers: expect.objectContaining({ "X-User-No": "1" }),
    }));
    expect(fetchMock).toHaveBeenNthCalledWith(2, ENDPOINT, expect.objectContaining({
      method: "PATCH",
      body: JSON.stringify({ language: "en" }),
      headers: expect.objectContaining({ "X-User-No": "1" }),
    }));
  });
});
