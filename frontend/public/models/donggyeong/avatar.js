import * as THREE from 'three';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';
import { createSecondaryMotion } from './secondary-motion.js';

// Cached assets stay immutable; bones, mixers and flexible buffers belong to each avatar.
export function createDonggyeong(asset) {
  const root = new THREE.Group();
  const base = cloneSkeleton(asset.scene);
  root.add(base);
  const bones = new Map();
  base.traverse(node => { if (node.isBone) bones.set(node.name, node); });
  const secondaryMotion = createSecondaryMotion(root, bones);
  const mixer = new THREE.AnimationMixer(base);
  const idle = mixer.clipAction(THREE.AnimationClip.findByName(asset.animations, 'Idle'));
  const selected = mixer.clipAction(THREE.AnimationClip.findByName(asset.animations, 'Select'));
  selected.setLoop(THREE.LoopOnce, 1);
  selected.clampWhenFinished = true;
  idle.play();
  const equipment = new Map();
  let background = null;
  let paused = false;
  mixer.addEventListener('finished', event => {
    if (event.action !== selected) return;
    selected.fadeOut(.2);
    idle.reset().setEffectiveWeight(1).fadeIn(.2).play();
  });
  function remove(slot) {
    const copy = equipment.get(slot);
    if (!copy) return;
    secondaryMotion.detach(copy);
    root.remove(copy);
    if (slot === 'effect') {
      background?.dispose();
      background = null;
    }
    copy.traverse(node => { if (node.isSkinnedMesh) node.skeleton.dispose(); });
    equipment.delete(slot);
  }
  function equip(slot, wearable) {
    const copy = cloneSkeleton(wearable.scene);
    copy.traverse(node => {
      if (!node.isSkinnedMesh) return;
      const mapped = node.skeleton.bones.map(bone => {
        const target = bones.get(bone.name);
        if (!target) throw new Error(`의상 뼈대가 일치하지 않습니다: ${bone.name}`);
        return target;
      });
      const skeleton = new THREE.Skeleton(mapped, node.skeleton.boneInverses.map(matrix => matrix.clone()));
      node.skeleton.dispose();
      node.bind(skeleton, node.bindMatrix);
    });
    remove(slot);
    if (slot === 'effect') {
      copy.traverse(node => { if (node.isMesh) background = node.material.map.clone(); });
      // glTF textures use top-origin UVs; a screen background uses bottom-origin UVs.
      background.repeat.y = -1;
      background.offset.y = 1;
      background.needsUpdate = true;
      copy.visible = false;
    }
    root.add(copy);
    equipment.set(slot, copy);
    secondaryMotion.attach(copy, slot);
    return copy;
  }
  return {
    root, base, bones, mixer, equipment,
    get background() { return background; },
    equip, remove,
    setMasks(entries) {
      base.traverse(node => { node.visible = true; });
      for (const entry of entries) for (const name of entry.hideBaseNodes) {
        const node = base.getObjectByName(name);
        if (node) node.visible = false;
      }
    },
    greet() {
      if (paused || selected.isRunning()) return;
      idle.fadeOut(.14);
      selected.reset().setEffectiveWeight(1).fadeIn(.14).play();
    },
    setPaused(value) { paused = value; mixer.timeScale = value ? 0 : 1; },
    get paused() { return paused; },
    update(delta) {
      const dt = paused ? 0 : Math.max(0, Math.min(delta, .05));
      mixer.update(dt);
      secondaryMotion.update(dt);
    },
  };
}
