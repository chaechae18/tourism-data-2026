import * as THREE from 'three';

const clamp = THREE.MathUtils.clamp;
const smooth = t => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };

// A damped follower is driven by the animated attachment, never by a free-running wave.
// All coordinates below are in the avatar's rest space (+Y up, +Z forward).
export function createSecondaryMotion(root, bones) {
  root.updateMatrixWorld(true);
  const inverseRoot = new THREE.Matrix4();
  const point = new THREE.Vector3(), rotation = new THREE.Quaternion();
  const controllers = new Map();
  for (const [name, boneName, length] of [['cloth', 'dg_chest', 1.1], ['cord', 'dg_head', 2.15], ['ribbon', 'dg_head', .4], ['hand', 'dg_hand_right', .3]]) {
    const bone = bones.get(boneName);
    const restRotation = bone.getWorldQuaternion(new THREE.Quaternion()).invert();
    controllers.set(name, { bone, length, restRotation, position: null, velocity: new THREE.Vector3(), offset: new THREE.Vector3(), turn: new THREE.Quaternion() });
  }
  const pieces = new Map();
  function profile(node, slot) {
    const name = node.name;
    if (slot === 'hat' && /scholar_gat_string|scholar_gat_knot|scholar_amber_cord_bead/.test(name)) return ['cord', 4.263, 2.19];
    if (slot === 'hat' && /court_silk_ribbon|merchant_headband_(short_)?tail/.test(name)) return ['ribbon', 4.18, .34];
    if (slot === 'hand' && /king_ruyi_cord|scholar_bookmark/.test(name)) return ['hand', 1.87, .35];
    if (slot === 'top' && !/sleeve|cuff|shoulder|cross_collar/.test(name)) return ['cloth', 1.65, 1.1];
    if (slot === 'bottom' && !/boot|trouser/.test(name)) return ['cloth', 1.65, 1.1];
    return null;
  }
  function attach(copy, slot) {
    root.updateMatrixWorld(true);
    inverseRoot.copy(root.matrixWorld).invert();
    const records = [];
    copy.traverse(node => {
      if (!node.isMesh) return;
      const setup = profile(node, slot);
      if (!setup) return;
      const [controller, anchor, length] = setup;
      const toRest = new THREE.Matrix4().multiplyMatrices(inverseRoot, node.matrixWorld);
      const toLocal = toRest.clone().invert();
      const normalToRest = new THREE.Matrix3().getNormalMatrix(toRest);
      const normalToLocal = new THREE.Matrix3().getNormalMatrix(toLocal);
      const original = node.geometry;
      const positions = original.attributes.position;
      const weights = new Float32Array(positions.count);
      const slopes = new Float32Array(positions.count);
      const sideSlopes = new Float32Array(positions.count);
      let active = false;
      for (let i = 0; i < positions.count; i++) {
        point.fromBufferAttribute(positions, i).applyMatrix4(toRest);
        const t = clamp((anchor - point.y) / length, 0, 1);
        weights[i] = smooth(t);
        slopes[i] = -6 * t * (1 - t) / length;
        if (controller === 'cloth') {
          // The upper side panels stay sewn to the sleeves beside the palms.
          // Apply the same field to the shell, edging and fitted armor/lacing.
          const side = clamp((Math.abs(point.x) - .72) / .24, 0, 1);
          const height = clamp((point.y - 1.05) / .3, 0, 1);
          const fixed = smooth(side) * smooth(height);
          sideSlopes[i] = -weights[i] * 6 * side * (1 - side) / .24 * Math.sign(point.x) * smooth(height);
          slopes[i] = slopes[i] * (1 - fixed) - weights[i] * smooth(side) * 6 * height * (1 - height) / .3;
          weights[i] *= 1 - fixed;
        }
        active ||= weights[i] > 0;
      }
      if (!active) return;
      // Cached GLBs remain immutable; only flexible meshes get private buffers.
      node.geometry = original.clone();
      node.geometry.attributes.position.setUsage(THREE.DynamicDrawUsage);
      node.geometry.attributes.normal?.setUsage(THREE.DynamicDrawUsage);
      node.frustumCulled = false;
      records.push({ node, original, weights, slopes, sideSlopes, toLocal, normalToRest, normalToLocal, vectorToLocal: new THREE.Matrix3().setFromMatrix4(toLocal), controller });
    });
    pieces.set(copy, records);
  }
  function detach(copy) {
    for (const { node, original } of pieces.get(copy) || []) {
      node.geometry.dispose();
      node.geometry = original;
    }
    pieces.delete(copy);
  }
  const target = new THREE.Vector3(), lag = new THREE.Vector3(), gravity = new THREE.Vector3();
  const localOffset = new THREE.Vector3(), normal = new THREE.Vector3();
  const rootRotation = new THREE.Quaternion();
  function update(dt) {
    if (dt <= 0) return;
    root.updateMatrixWorld(true);
    inverseRoot.copy(root.matrixWorld).invert();
    root.getWorldQuaternion(rootRotation).invert();
    for (const [name, state] of controllers) {
      state.bone.getWorldQuaternion(rotation).premultiply(rootRotation);
      state.turn.copy(rotation).multiply(state.restRotation);
      state.bone.getWorldPosition(point).applyMatrix4(inverseRoot);
      target.set(0, -state.length, 0).applyQuaternion(state.turn).add(point);
      if (!state.position) state.position = target.clone();
      // Fixed-size substeps prevent frame-rate dependent spring explosions.
      const steps = Math.ceil(dt / (1 / 120)), h = dt / steps;
      const stiffness = name === 'cloth' ? 60 : 65;
      for (let i = 0; i < steps; i++) {
        state.velocity.addScaledVector(lag.copy(target).sub(state.position), stiffness * h);
        state.velocity.multiplyScalar(Math.exp(-10 * h));
        state.position.addScaledVector(state.velocity, h);
      }
      lag.copy(state.position).sub(target).applyQuaternion(rotation.copy(state.turn).invert());
      // Compensate the tilt of the attachment so hanging parts still seek down.
      gravity.set(0, -state.length, 0).applyQuaternion(rotation);
      gravity.y += state.length;
      state.offset.copy(lag).multiplyScalar(name === 'cloth' ? 1.5 : .8).addScaledVector(gravity, name === 'cord' ? .65 : .18);
      const limit = name === 'cord' ? .075 : name === 'cloth' ? .028 : .025;
      state.offset.clampLength(0, limit);
      if (name === 'cord') {
        // Keep the lower loop on the front side of the cheeks and pendant.
        state.offset.z = clamp(state.offset.z, 0, .045);
        state.offset.y = clamp(state.offset.y, -.025, 0);
      } else state.offset.y = 0;
    }
    for (const records of pieces.values()) for (const record of records) {
      const { node, original, weights, slopes, sideSlopes, vectorToLocal, normalToRest, normalToLocal, controller } = record;
      const offset = controllers.get(controller).offset;
      // Transform a vector, without the translation component of the bind matrix.
      localOffset.copy(offset).applyMatrix3(vectorToLocal);
      const src = original.attributes.position.array, dst = node.geometry.attributes.position.array;
      const sourceNormals = original.attributes.normal, normals = node.geometry.attributes.normal;
      for (let i = 0, j = 0; i < weights.length; i++, j += 3) {
        dst[j] = src[j] + localOffset.x * weights[i];
        dst[j + 1] = src[j + 1] + localOffset.y * weights[i];
        dst[j + 2] = src[j + 2] + localOffset.z * weights[i];
        if (normals) {
          normal.fromBufferAttribute(sourceNormals, i).applyMatrix3(normalToRest).normalize();
          const shear = normal.dot(offset) / (1 + sideSlopes[i] * offset.x + slopes[i] * offset.y);
          normal.x -= sideSlopes[i] * shear;
          normal.y -= slopes[i] * shear;
          normal.applyMatrix3(normalToLocal).normalize();
          normals.setXYZ(i, normal.x, normal.y, normal.z);
        }
      }
      node.geometry.attributes.position.needsUpdate = true;
      if (normals) normals.needsUpdate = true;
    }
  }
  return { attach, detach, update };
}
