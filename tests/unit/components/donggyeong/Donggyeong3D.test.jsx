import { render, screen } from "@testing-library/react";
import { vi } from "vitest";

const donggyeongStub = vi.hoisted(() => ({
  dispose: vi.fn(),
  root: {},
  update: vi.fn(),
}));

vi.mock("../../../../lib/donggyeong/create-donggyeong", () => ({
  createDonggyeong: () => donggyeongStub,
}));

vi.mock("three", () => {
  class Position {
    set() {}
  }
  class Scene {
    add() {}
  }
  class PerspectiveCamera {
    constructor() {
      this.position = new Position();
    }
    lookAt() {}
    updateProjectionMatrix() {}
  }
  class WebGLRenderer {
    constructor() {
      this.domElement = document.createElement("canvas");
      this.shadowMap = {};
    }
    dispose() {}
    render() {}
    setPixelRatio() {}
    setSize() {}
  }
  class Light {
    constructor() {
      this.position = new Position();
      this.shadow = { camera: {}, mapSize: { set() {} } };
    }
  }
  class Mesh {
    constructor() {
      this.position = new Position();
      this.rotation = {};
    }
  }
  return {
    ACESFilmicToneMapping: "aces",
    CircleGeometry: class {},
    Clock: class { getElapsedTime() { return 0; } },
    DirectionalLight: Light,
    HemisphereLight: Light,
    Mesh,
    PCFSoftShadowMap: "soft",
    PerspectiveCamera,
    SRGBColorSpace: "srgb",
    Scene,
    ShadowMaterial: class {},
    WebGLRenderer,
  };
});

import Donggyeong3D from "../../../../components/donggyeong/Donggyeong3D";

describe("Donggyeong3D", () => {
  it("mounts a renderer without creating the real mascot model", () => {
    render(<Donggyeong3D interactive={false} />);

    expect(screen.getByRole("img", { name: "3D 동경이 캐릭터 뷰어" }).querySelector("canvas")).toBeInTheDocument();
  });
});
