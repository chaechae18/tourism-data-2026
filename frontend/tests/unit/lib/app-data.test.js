import { DG_INVENTORY, QUESTS, SPOT_RANKING, SPOT_REVIEW_LIMIT } from "../../../lib/app-data";

describe("app data", () => {
  it("keeps the review limit at 350 characters", () => {
    expect(SPOT_REVIEW_LIMIT).toBe(350);
  });

  it("provides places for the 2D map", () => {
    expect(QUESTS.length).toBeGreaterThan(0);
  });

  it("provides a five-place ranking snapshot", () => {
    expect(SPOT_RANKING).toHaveLength(5);
  });

  it("provides a GLB model for every Donggyeong item", () => {
    expect(DG_INVENTORY).toHaveLength(5);
    expect(DG_INVENTORY.every((item) => item.modelUrl.endsWith(".glb"))).toBe(true);
  });
});
