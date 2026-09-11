"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { createDonggyeong } from "../../public/models/donggyeong/avatar.js";
import { attachClickGreeting } from "../../public/models/donggyeong/click-greeting.js";
import manifest from "../../public/models/donggyeong/manifest.json";
import { donggyeongModelCache } from "../../lib/donggyeong/glb-memory-cache";
import { useI18n } from "../i18n/LanguageProvider";

export default function Donggyeong3D({ className = "", interactive = true, items = [] }) {
  const { t } = useI18n();
  const mountRef = useRef(null);
  const viewerRef = useRef(null);
  const [status, setStatus] = useState("loading");
  const modelKey = JSON.stringify(items);

  useEffect(() => {
    const mount = mountRef.current;
    const scene = new THREE.Scene();
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.VSMShadowMap;
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.toneMappingExposure = 0.86;
    mount.appendChild(renderer.domElement);

    const camera = new THREE.PerspectiveCamera(31, 1, 0.1, 100);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 2.3, 0);
    controls.enableDamping = true;
    controls.enabled = interactive;
    controls.enablePan = false;
    controls.minDistance = 6;
    controls.maxDistance = 22;
    controls.maxPolarAngle = Math.PI * 0.53;
    const pmrem = new THREE.PMREMGenerator(renderer);
    const room = new RoomEnvironment();
    const environment = pmrem.fromScene(room, 0.04);
    scene.environment = environment.texture;
    scene.environmentIntensity = 0.65;
    room.dispose();
    pmrem.dispose();
    scene.add(new THREE.HemisphereLight(0xfff5df, 0x817361, 0.65));
    const key = new THREE.DirectionalLight(0xffedce, 2);
    key.position.set(-3, 7, 6);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    Object.assign(key.shadow.camera, { left: -4, right: 4, top: 6, bottom: -3, near: 0.1, far: 20 });
    key.shadow.normalBias = 0.004;
    scene.add(key);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.ShadowMaterial({ opacity: 0.22 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.007;
    floor.receiveShadow = true;
    scene.add(floor);

    let active = true;
    let revision = 0;
    let avatar;
    const detachGreeting = interactive ? attachClickGreeting(renderer.domElement, camera, () => avatar) : () => {};
    const handles = new Map();
    const equipped = new Map();
    const load = async (url) => {
      if (!handles.has(url)) handles.set(url, donggyeongModelCache.acquire(url));
      return (await handles.get(url)).asset;
    };
    const fitBackdrop = () => {
      scene.background = avatar?.background || null;
      if (!scene.background) return;
      const texture = scene.background;
      const imageAspect = texture.image.width / texture.image.height;
      texture.repeat.set(Math.min(1, camera.aspect / imageAspect), -Math.min(1, imageAspect / camera.aspect));
      texture.offset.set((1 - texture.repeat.x) / 2, (1 - texture.repeat.y) / 2);
      texture.updateMatrix();
    };
    const resize = () => {
      const { clientWidth: width, clientHeight: height } = mount;
      if (!width || !height) return;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      // The existing wardrobe has a narrow central column; fit the complete silhouette.
      camera.position.set(0.6, 2.8, Math.max(11, 7.3 / camera.aspect));
      controls.update();
      renderer.setSize(width, height);
      fitBackdrop();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(mount);
    resize();
    const baseReady = load(`${manifest.base.url}?v=${manifest.base.sha256.slice(0, 12)}`).then((asset) => {
      if (!active) return;
      avatar = createDonggyeong(asset);
      scene.add(avatar.root);
    });
    viewerRef.current = {
      greet: () => avatar?.greet(),
      async setItems(entries) {
        const request = ++revision;
        setStatus("loading");
        try {
          await baseReady;
          if (!active || request !== revision) return;
          const assets = await Promise.all(entries.map((entry) => load(entry.modelUrl)));
          if (!active || request !== revision) return;
          for (const slot of equipped.keys()) {
            if (!entries.some((entry) => entry.slot === slot)) {
              avatar.remove(slot);
              equipped.delete(slot);
            }
          }
          entries.forEach((entry, index) => {
            if (equipped.get(entry.slot)?.id !== entry.id) avatar.equip(entry.slot, assets[index]);
            equipped.set(entry.slot, entry);
          });
          avatar.setMasks([...equipped.values()]);
          avatar.root.traverse((node) => {
            if (node.isMesh) { node.castShadow = true; node.receiveShadow = true; }
          });
          fitBackdrop();
          avatar.greet();
          setStatus("ready");
        } catch (error) {
          if (active && request === revision) {
            console.error("동경이 모델을 불러오지 못했습니다", error);
            setStatus("error");
          }
        }
      },
    };
    const clock = new THREE.Clock();
    renderer.setAnimationLoop(() => {
      const delta = clock.getDelta();
      if (document.hidden) return;
      controls.update();
      avatar?.update(delta);
      renderer.render(scene, camera);
    });
    return () => {
      active = false;
      viewerRef.current = null;
      renderer.setAnimationLoop(null);
      observer.disconnect();
      detachGreeting();
      controls.dispose();
      if (avatar) {
        for (const slot of [...avatar.equipment.keys()]) avatar.remove(slot);
        avatar.mixer.stopAllAction();
        avatar.mixer.uncacheRoot(avatar.base);
        avatar.base.traverse((node) => { if (node.isSkinnedMesh) node.skeleton.dispose(); });
      }
      void Promise.allSettled([...handles.values()].map(async (handle) => (await handle).release()))
        .then(() => donggyeongModelCache.clearUnused());
      environment.dispose();
      floor.geometry.dispose();
      floor.material.dispose();
      key.shadow.dispose();
      renderer.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, [interactive]);

  useEffect(() => {
    void viewerRef.current?.setItems(JSON.parse(modelKey));
  }, [interactive, modelKey]);

  return (
    <div className={className}>
      <div ref={mountRef} className="absolute inset-0" aria-label={interactive ? `${t("donggyeong.viewerLabel")} · ${t("donggyeong.greet")}` : t("donggyeong.viewerLabel")} role={interactive ? "button" : "img"} tabIndex={interactive && status === "ready" ? 0 : undefined} aria-disabled={interactive ? status !== "ready" : undefined} onKeyDown={interactive ? (event) => {
        if (status === "ready" && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          if (!event.repeat) viewerRef.current?.greet();
        }
      } : undefined} />
      {status !== "ready" && <p role="status" className="pointer-events-none absolute inset-x-2 bottom-3 text-center text-xs text-white">{t(status === "error" ? "donggyeong.loadError" : "donggyeong.loading")}</p>}
    </div>
  );
}
