import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";

const mocks = vi.hoisted(() => ({
  acquire: vi.fn(), release: vi.fn(), clearUnused: vi.fn(),
  equip: vi.fn(), setMasks: vi.fn(), greet: vi.fn(),
}));

vi.mock("three", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    WebGLRenderer: class {
      constructor() { this.domElement = document.createElement("canvas"); this.shadowMap = {}; }
      dispose() {}
      setPixelRatio() {}
      setSize() {}
      setAnimationLoop() {}
    },
    PMREMGenerator: class {
      fromScene() { return { texture: {}, dispose() {} }; }
      dispose() {}
    },
  };
});
vi.mock("three/addons/controls/OrbitControls.js", () => ({
  OrbitControls: class {
    constructor() { this.target = { set() {} }; }
    update() {}
    dispose() {}
  },
}));
vi.mock("three/addons/environments/RoomEnvironment.js", () => ({
  RoomEnvironment: class { dispose() {} },
}));
vi.mock("../../../../public/models/donggyeong/avatar.js", async () => {
  const { Group } = await import("three");
  return { createDonggyeong: () => ({
    root: new Group(), base: new Group(), equipment: new Map(),
    mixer: { stopAllAction() {}, uncacheRoot() {} },
    equip: mocks.equip, setMasks: mocks.setMasks, greet: mocks.greet,
    remove() {}, update() {},
  }) };
});
vi.mock("../../../../lib/donggyeong/glb-memory-cache", () => ({
  donggyeongModelCache: mocks,
}));

import Donggyeong3D from "../../../../components/donggyeong/Donggyeong3D";

const hat = (id) => ({ id, slot: "hat", modelUrl: `/${id}.glb`, hideBaseNodes: [] });

describe("Donggyeong3D", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.acquire.mockResolvedValue({ asset: {}, release: mocks.release });
    mocks.clearUnused.mockResolvedValue(undefined);
  });

  it("loads the base and releases its cache handle on unmount", async () => {
    const { unmount } = render(<Donggyeong3D />);
    const viewer = screen.getByRole("button", { name: /3D 동경이/ });
    await waitFor(() => expect(viewer).toHaveAttribute("aria-disabled", "false"));
    expect(document.querySelector("button")).not.toBeInTheDocument();
    fireEvent.keyDown(viewer, { key: "Enter" });
    expect(mocks.greet).toHaveBeenCalledTimes(2);
    expect(viewer.querySelector("canvas")).toBeInTheDocument();
    unmount();
    await waitFor(() => expect(mocks.release).toHaveBeenCalledOnce());
  });

  it("ignores an older item load that finishes after a newer selection", async () => {
    let finishOld;
    mocks.acquire.mockImplementation((url) => url === "/old.glb"
      ? new Promise((resolve) => { finishOld = resolve; })
      : Promise.resolve({ asset: {}, release: mocks.release }));
    const { rerender } = render(<Donggyeong3D items={[hat("old")]} />);
    await waitFor(() => expect(finishOld).toBeTypeOf("function"));
    rerender(<Donggyeong3D items={[hat("new")]} />);
    await waitFor(() => expect(mocks.setMasks).toHaveBeenLastCalledWith([hat("new")]));
    finishOld({ asset: {}, release: mocks.release });
    await waitFor(() => expect(mocks.setMasks).toHaveBeenLastCalledWith([hat("new")]));
    expect(mocks.equip).toHaveBeenCalledOnce();
  });
});
