import { createDonggyeong } from "../../../../lib/donggyeong/create-donggyeong";

describe("createDonggyeong", () => {
  it("builds a non-empty mascot scene graph", () => {
    const model = createDonggyeong();

    expect(model.root.children.length).toBeGreaterThan(0);
  });

  it("updates the mascot animation without throwing", () => {
    const model = createDonggyeong();

    expect(() => model.update(1)).not.toThrow();
  });
});
