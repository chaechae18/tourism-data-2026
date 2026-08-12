"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { createDonggyeong } from "../../lib/donggyeong/create-donggyeong";
import { donggyeongModelCache } from "../../lib/donggyeong/glb-memory-cache";
import { useI18n } from "../i18n/LanguageProvider";

export default function Donggyeong3D({ className = "", interactive = true, items = [] }) {
  const { t } = useI18n();
  const mountRef = useRef(null);
  const modelUrls = [...new Set(items.map((item) => item.modelUrl).filter(Boolean))];
  const modelKey = modelUrls.join("|");

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.domElement.style.touchAction = "none";
    mount.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight(0xfffdf8, 0x718087, 1.3));
    const key = new THREE.DirectionalLight(0xffeed2, 2.15);
    key.position.set(-3.8, 6, 5.4);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.left = -6;
    key.shadow.camera.right = 6;
    key.shadow.camera.top = 7;
    key.shadow.camera.bottom = -7;
    key.shadow.radius = 7;
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xf4f8fa, 0.72);
    fill.position.set(4.5, 2.5, 5.5);
    scene.add(fill);
    const rim = new THREE.DirectionalLight(0xe6c985, 0.44);
    rim.position.set(4, 4, -5);
    scene.add(rim);

    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(3.2, 64),
      new THREE.ShadowMaterial({ opacity: 0.28 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -3.05;
    ground.receiveShadow = true;
    scene.add(ground);

    const donggyeong = createDonggyeong();
    scene.add(donggyeong.root);
    let active = true;
    const itemHandles = [];
    const itemScenes = [];

    const itemLoadPromise = Promise.allSettled(modelUrls.map(async (url) => {
      try {
        const handle = await donggyeongModelCache.acquire(url);
        if (!active) {
          handle.release();
          return;
        }
        const itemScene = handle.asset.scene.clone(true);
        itemScene.traverse((object) => {
          if (!object.isMesh) return;
          object.castShadow = true;
          object.receiveShadow = true;
        });
        itemHandles.push(handle);
        itemScenes.push(itemScene);
        donggyeong.root.add(itemScene);
      } catch {
        // Keep the base mascot usable if one optional item asset fails to load.
      }
    }));

    const orbit = { theta: 0, phi: 1.5, radius: 12.3, drag: false, x: 0, y: 0 };
    const applyCamera = () => {
      camera.position.set(
        orbit.radius * Math.sin(orbit.phi) * Math.sin(orbit.theta),
        orbit.radius * Math.cos(orbit.phi),
        orbit.radius * Math.sin(orbit.phi) * Math.cos(orbit.theta),
      );
      camera.lookAt(0, -0.42, 0);
    };
    applyCamera();

    const resize = () => {
      const width = mount.clientWidth;
      const height = mount.clientHeight;
      if (!width || !height) return;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(mount);
    resize();

    const onPointerDown = (event) => {
      if (!interactive) return;
      orbit.drag = true;
      orbit.x = event.clientX;
      orbit.y = event.clientY;
      renderer.domElement.setPointerCapture?.(event.pointerId);
    };
    const onPointerMove = (event) => {
      if (!orbit.drag) return;
      orbit.theta -= (event.clientX - orbit.x) * 0.007;
      orbit.phi = Math.min(2.05, Math.max(0.78, orbit.phi - (event.clientY - orbit.y) * 0.005));
      orbit.x = event.clientX;
      orbit.y = event.clientY;
      applyCamera();
    };
    const stopDrag = () => { orbit.drag = false; };
    const onWheel = (event) => {
      if (!interactive) return;
      event.preventDefault();
      orbit.radius = Math.min(20, Math.max(10.5, orbit.radius + event.deltaY * 0.008));
      applyCamera();
    };
    const canvas = renderer.domElement;
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", stopDrag);
    canvas.addEventListener("pointercancel", stopDrag);
    canvas.addEventListener("pointerleave", stopDrag);
    canvas.addEventListener("wheel", onWheel, { passive: false });

    const clock = new THREE.Clock();
    let frame;
    const render = () => {
      donggyeong.update(clock.getElapsedTime());
      renderer.render(scene, camera);
      frame = requestAnimationFrame(render);
    };
    render();

    return () => {
      active = false;
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", stopDrag);
      canvas.removeEventListener("pointercancel", stopDrag);
      canvas.removeEventListener("pointerleave", stopDrag);
      canvas.removeEventListener("wheel", onWheel);
      itemScenes.forEach((itemScene) => donggyeong.root.remove(itemScene));
      itemHandles.forEach((handle) => handle.release());
      void itemLoadPromise.then(() => donggyeongModelCache.clearUnused());
      donggyeong.dispose();
      renderer.dispose();
      mount.removeChild(canvas);
    };
  }, [interactive, modelKey]);

  return (
    <div
      ref={mountRef}
      className={className}
      aria-label={t("donggyeong.viewerLabel")}
      role="img"
    />
  );
}
