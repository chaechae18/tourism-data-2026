import { vi } from "vitest";
import { completeQuest } from "../../../../lib/api/journey";

afterEach(() => vi.unstubAllGlobals());

it.each([
  [{ demoCompletion: true }, { demoCompletion: true }],
  [{ latitude: 35.8, longitude: 129.2, accuracy: 10 }, { latitude: 35.8, longitude: 129.2, accuracy: 10 }],
])("sends the selected completion mode with the session", async (input, expected) => {
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ completed: true }) });
  vi.stubGlobal("fetch", fetchMock);
  await completeQuest({ questId: 7, ...input });
  const [url, options] = fetchMock.mock.calls[0];
  expect(url).toContain("/quests/7/complete");
  expect(options.credentials).toBe("include");
  expect(JSON.parse(options.body)).toEqual(expected);
});
