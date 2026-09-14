import * as THREE from 'three';

// A character tap greets; orbit drags, pinches and background taps do not.
export function attachClickGreeting(element, camera, getAvatar) {
  const raycaster = new THREE.Raycaster();
  const pointers = new Set();
  let tap = null;
  const down = event => {
    pointers.add(event.pointerId);
    tap = pointers.size === 1 && event.button === 0
      ? { id: event.pointerId, x: event.clientX, y: event.clientY, time: event.timeStamp, moved: false }
      : null;
  };
  const move = event => {
    if (tap?.id === event.pointerId && Math.hypot(event.clientX - tap.x, event.clientY - tap.y) > 6) tap.moved = true;
  };
  const up = event => {
    const candidate = tap;
    pointers.delete(event.pointerId);
    tap = null;
    if (!candidate || candidate.id !== event.pointerId || candidate.moved || event.timeStamp - candidate.time > 600) return;
    if (Math.hypot(event.clientX - candidate.x, event.clientY - candidate.y) > 6) return;
    const avatar = getAvatar();
    if (!avatar) return;
    const bounds = element.getBoundingClientRect();
    if (!bounds.width || !bounds.height || event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) return;
    camera.updateMatrixWorld();
    avatar.root.updateMatrixWorld(true);
    raycaster.setFromCamera(new THREE.Vector2(
      (event.clientX - bounds.left) / bounds.width * 2 - 1,
      -(event.clientY - bounds.top) / bounds.height * 2 + 1,
    ), camera);
    const meshes = [];
    avatar.root.traverseVisible(node => {
      if (!node.isMesh) return;
      if (node.isSkinnedMesh) node.computeBoundingSphere();
      meshes.push(node);
    });
    if (raycaster.intersectObjects(meshes, false).length) avatar.greet();
  };
  const cancel = event => { pointers.delete(event.pointerId); tap = null; };
  const handlers = { pointerdown: down, pointermove: move, pointerup: up, pointercancel: cancel };
  for (const [type, handler] of Object.entries(handlers)) element.addEventListener(type, handler);
  return () => {
    for (const [type, handler] of Object.entries(handlers)) element.removeEventListener(type, handler);
    pointers.clear();
    tap = null;
  };
}
