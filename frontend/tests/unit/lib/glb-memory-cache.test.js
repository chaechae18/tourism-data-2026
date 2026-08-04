import { vi } from "vitest";
import { GlbMemoryCache, ModelAssetFile } from "../../../lib/donggyeong/glb-memory-cache";


describe("GlbMemoryCache", () => {
  it("validates model extensions without query strings", () => {
    expect(new ModelAssetFile("/models/item.GLB?v=1").isBinary).toBe(true);
    expect(() => new ModelAssetFile("/models/item.obj")).toThrow(TypeError);
  });

  it("loads the same asset once and evicts it after every release", async () => {
    const geometry = { dispose: vi.fn() };
    const material = { dispose: vi.fn() };
    const scene = {
      traverse: (visit) => visit({ geometry, material }),
    };
    const loader = {
      loadAsync: vi.fn().mockResolvedValue({ scene }),
    };
    const cache = new GlbMemoryCache(loader);

    const first = await cache.acquire("/models/crown.glb");
    const second = await cache.acquire("/models/crown.glb");
    expect(loader.loadAsync).toHaveBeenCalledOnce();

    first.release();
    expect(await cache.evict("/models/crown.glb")).toBe(false);
    second.release();
    expect(await cache.evict("/models/crown.glb")).toBe(true);
    expect(geometry.dispose).toHaveBeenCalledOnce();
    expect(material.dispose).toHaveBeenCalledOnce();
  });
});
