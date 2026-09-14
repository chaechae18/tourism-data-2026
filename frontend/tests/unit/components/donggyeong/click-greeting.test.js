import * as THREE from 'three';
import { attachClickGreeting } from '../../../../public/models/donggyeong/click-greeting.js';

describe('character click greeting', () => {
  let element, root, camera, greet, detach, mesh;
  function pointer(type, x=100, y=100, id=1, button=0) {
    const event = new MouseEvent(type, { clientX:x, clientY:y, button });
    Object.defineProperty(event, 'pointerId', { value:id });
    element.dispatchEvent(event);
  }
  beforeEach(() => {
    element = document.createElement('canvas');
    element.getBoundingClientRect = () => ({ left:0, top:0, right:200, bottom:200, width:200, height:200 });
    root = new THREE.Group();
    mesh = new THREE.Mesh(new THREE.BoxGeometry(1,1,1), new THREE.MeshBasicMaterial());
    root.add(mesh);
    camera = new THREE.PerspectiveCamera(50,1,.1,100); camera.position.z=5;
    greet = vi.fn();
    detach = attachClickGreeting(element, camera, () => ({ root, greet }));
  });
  afterEach(() => { detach(); mesh.geometry.dispose(); mesh.material.dispose(); });
  it('greets once for a character tap and ignores the background', () => {
    pointer('pointerdown'); pointer('pointerup');
    expect(greet).toHaveBeenCalledOnce();
    pointer('pointerdown',5,5); pointer('pointerup',5,5);
    expect(greet).toHaveBeenCalledOnce();
  });
  it('ignores a drag even when it returns to the starting point', () => {
    pointer('pointerdown'); pointer('pointermove',125); pointer('pointermove'); pointer('pointerup');
    expect(greet).not.toHaveBeenCalled();
  });
  it('ignores a pinch, cancellation and secondary mouse button', () => {
    pointer('pointerdown'); pointer('pointerdown',110,100,2);
    pointer('pointerup',110,100,2); pointer('pointerup');
    pointer('pointerdown'); pointer('pointercancel'); pointer('pointerup');
    pointer('pointerdown',100,100,1,2); pointer('pointerup',100,100,1,2);
    expect(greet).not.toHaveBeenCalled();
  });
  it('does not hit hidden body regions or keep listeners after disposal', () => {
    mesh.visible=false; pointer('pointerdown'); pointer('pointerup');
    mesh.visible=true; detach(); pointer('pointerdown'); pointer('pointerup');
    expect(greet).not.toHaveBeenCalled();
  });
});
