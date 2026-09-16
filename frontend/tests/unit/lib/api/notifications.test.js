import { vi } from "vitest";
import {
  listNotifications,
  markNotificationRead,
  notifyQuestCompleted,
} from "../../../../lib/api/notifications";

afterEach(() => vi.unstubAllGlobals());


it("sends notification requests with the login session instead of a user number", async () => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => [],
  });
  vi.stubGlobal("fetch", fetchMock);

  await listNotifications();
  await markNotificationRead(7);
  await notifyQuestCompleted({ id: "place-1", name: "첨성대" });

  for (const [, options] of fetchMock.mock.calls) {
    expect(options.credentials).toBe("include");
    expect(options.headers?.["X-User-No"]).toBeUndefined();
  }
});
