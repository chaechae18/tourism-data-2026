import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";


export class ModelAssetFile {
  static supportedExtensions = new Set([".glb", ".gltf"]);

  constructor(url) {
    const cleanPath = url.split(/[?#]/, 1)[0];
    const dotIndex = cleanPath.lastIndexOf(".");
    this.url = url;
    this.extension = dotIndex >= 0 ? cleanPath.slice(dotIndex).toLowerCase() : "";
    if (!ModelAssetFile.supportedExtensions.has(this.extension)) {
      throw new TypeError(`지원하지 않는 3D 모델 확장자입니다: ${this.extension || "없음"}`);
    }
  }

  get isBinary() {
    return this.extension === ".glb";
  }
}


function disposeMaterial(material) {
  for (const value of Object.values(material)) {
    if (value?.isTexture) value.dispose();
  }
  material.dispose();
}


function disposeScene(scene) {
  scene.traverse((object) => {
    object.geometry?.dispose();
    if (Array.isArray(object.material)) {
      object.material.forEach(disposeMaterial);
    } else if (object.material) {
      disposeMaterial(object.material);
    }
  });
}


export class GlbMemoryCache {
  constructor(loader = new GLTFLoader()) {
    this.loader = loader;
    this.entries = new Map();
  }

  async acquire(url) {
    const assetFile = new ModelAssetFile(url);
    let entry = this.entries.get(assetFile.url);
    if (!entry) {
      entry = {
        references: 0,
        promise: this.loader.loadAsync(assetFile.url),
      };
      this.entries.set(assetFile.url, entry);
      entry.promise.catch(() => this.entries.delete(assetFile.url));
    }
    entry.references += 1;

    try {
      const asset = await entry.promise;
      let released = false;
      return {
        asset,
        release: () => {
          if (released) return;
          released = true;
          entry.references = Math.max(0, entry.references - 1);
        },
      };
    } catch (error) {
      entry.references = Math.max(0, entry.references - 1);
      throw error;
    }
  }

  async evict(url) {
    const entry = this.entries.get(url);
    if (!entry || entry.references > 0) return false;
    const asset = await entry.promise;
    disposeScene(asset.scene);
    this.entries.delete(url);
    return true;
  }

  async clearUnused() {
    const urls = [...this.entries.entries()]
      .filter(([, entry]) => entry.references === 0)
      .map(([url]) => url);
    await Promise.all(urls.map((url) => this.evict(url)));
  }
}


export const donggyeongModelCache = new GlbMemoryCache();
