import { vi } from "vitest";
import { fetchInventory, saveOutfit } from "../../../../lib/api/inventory";

afterEach(() => vi.unstubAllGlobals());

it("loads inventory using the authenticated session and selected role", async () => {
  const saved = { items: [{ id: "king_hat" }], outfit: {} };
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => saved });
  vi.stubGlobal("fetch", fetchMock);
  expect(await fetchInventory({ persona: "king" })).toEqual(saved);
  expect(fetchMock.mock.calls[0][0]).toContain("/inventory?persona=king");
  expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: "GET", credentials: "include" });
});

it("saves only equipped slots and surfaces rejected ownership", async () => {
  const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 400, json: async () => ({ error: { code: "ITEM_NOT_OWNED", message: "보유하지 않은 아이템" } }) });
  vi.stubGlobal("fetch", fetchMock);
  await expect(saveOutfit({ persona: "king", outfit: { hat: "king_hat", top: undefined } })).rejects.toMatchObject({ code: "ITEM_NOT_OWNED" });
  expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: "PUT", credentials: "include", body: JSON.stringify({ outfit: { hat: "king_hat" } }) });
});
