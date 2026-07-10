import * as THREE from "three";

const PALETTE = {
  fur: 0xb8661c,
  furLight: 0xc97824,
  cream: 0xfff8ec,
  earInner: 0xfff1de,
  ink: 0x11100f,
  pad: 0x3a2014,
  mouth: 0x2a130b,
  tongue: 0xb9644a,
  collar: 0x321c12,
};

function createFurBump() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  const context = canvas.getContext("2d");
  context.fillStyle = "#808080";
  context.fillRect(0, 0, canvas.width, canvas.height);

  for (let index = 0; index < 3600; index += 1) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    const length = 2 + Math.random() * 5;
    const angle = -0.8 + Math.random() * 1.6;
    const shade = 96 + Math.random() * 74;
    context.strokeStyle = `rgba(${shade}, ${shade}, ${shade}, ${0.10 + Math.random() * 0.14})`;
    context.lineWidth = 0.5 + Math.random() * 0.55;
    context.beginPath();
    context.moveTo(x, y);
    context.lineTo(x + Math.cos(angle) * length, y + Math.sin(angle) * length);
    context.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2.8, 2.8);
  return texture;
}

function roundedEarGeometry() {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0.82);
  shape.bezierCurveTo(0.58, 0.7, 0.78, 0.06, 0.55, -0.58);
  shape.bezierCurveTo(0.34, -0.96, -0.34, -0.96, -0.55, -0.58);
  shape.bezierCurveTo(-0.78, 0.06, -0.58, 0.7, 0, 0.82);

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: 0.2,
    bevelEnabled: true,
    bevelSize: 0.08,
    bevelThickness: 0.08,
    bevelSegments: 7,
  });
  geometry.center();
  return geometry;
}

function createSurfacePatch(columns, rows, pointAt) {
  const positions = [];
  const uvs = [];
  const indices = [];

  for (let row = 0; row <= rows; row += 1) {
    for (let column = 0; column <= columns; column += 1) {
      const u = column / columns;
      const v = row / rows;
      const point = pointAt(u, v);
      positions.push(point.x, point.y, point.z);
      uvs.push(u, v);
    }
  }

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const a = row * (columns + 1) + column;
      indices.push(a, a + 1, a + columns + 1, a + 1, a + columns + 2, a + columns + 1);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function facePatchGeometry() {
  const radiusX = 1.36 * 1.35;
  const radiusY = 1.36 * 1.1;
  const radiusZ = 1.36 * 1.03;

  return createSurfacePatch(42, 22, (u, v) => {
    const normalizedX = u * 2 - 1;
    const side = Math.abs(normalizedX);
    const x = normalizedX * (1.18 + 0.3 * v);
    const top = -0.2 + 0.13 * side ** 1.7;
    const bottom = -1.09 + 0.18 * side ** 2;
    const y = bottom + (top - bottom) * v;
    const zTerm = Math.max(0, 1 - (x ** 2) / (radiusX ** 2) - (y ** 2) / (radiusY ** 2));
    return { x, y, z: radiusZ * Math.sqrt(zTerm) + 0.018 };
  });
}

function bellyPatchGeometry() {
  const bodyCenterY = -1.28;
  const radiusX = 1.18 * 1.08;
  const radiusY = 1.18 * 1.34;
  const radiusZ = 1.18 * 0.86;

  return createSurfacePatch(34, 22, (u, v) => {
    const y = -2.38 + v * 1.53;
    const width = 0.58 + 0.17 * Math.sin(v * Math.PI);
    const x = (u * 2 - 1) * width;
    const yOffset = y - bodyCenterY;
    const zTerm = Math.max(0, 1 - (x ** 2) / (radiusX ** 2) - (yOffset ** 2) / (radiusY ** 2));
    return { x, y, z: radiusZ * Math.sqrt(zTerm) + 0.022 };
  });
}

function mouthGeometry() {
  const shape = new THREE.Shape();
  shape.moveTo(-0.32, 0.03);
  shape.quadraticCurveTo(-0.08, -0.1, 0.25, 0.1);
  shape.quadraticCurveTo(0.3, -0.16, 0.08, -0.34);
  shape.quadraticCurveTo(-0.18, -0.37, -0.32, 0.03);
  return new THREE.ExtrudeGeometry(shape, {
    depth: 0.042,
    bevelEnabled: true,
    bevelSize: 0.014,
    bevelThickness: 0.014,
    bevelSegments: 3,
  });
}

function createTagMaterial() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  const context = canvas.getContext("2d");
  context.fillStyle = "#b9651b";
  context.beginPath();
  context.arc(128, 128, 116, 0, Math.PI * 2);
  context.fill();
  context.lineWidth = 14;
  context.strokeStyle = "#4a2814";
  context.stroke();
  context.lineWidth = 6;
  context.strokeStyle = "#e2a24f";
  context.stroke();
  context.font = "900 96px Arial, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.lineWidth = 6;
  context.strokeStyle = "#6b3514";
  context.save();
  context.translate(128, 128);
  context.rotate(-Math.PI / 2);
  context.translate(-128, -128);
  context.strokeText("S40", 128, 140);
  context.fillStyle = "#fff7ec";
  context.fillText("S40", 128, 140);
  context.restore();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshStandardMaterial({ map: texture, roughness: 0.46, metalness: 0.03 });
}

export function createDonggyeong() {
  const furBump = createFurBump();
  const standard = (color, options = {}) => new THREE.MeshStandardMaterial({
    color,
    roughness: 0.9,
    metalness: 0,
    ...options,
  });
  const plush = (color, bumpScale) => standard(color, {
    roughness: 0.97,
    bumpMap: furBump,
    bumpScale,
    side: THREE.DoubleSide,
  });
  const materials = {
    fur: plush(PALETTE.fur, 0.035),
    furLight: plush(PALETTE.furLight, 0.028),
    cream: plush(PALETTE.cream, 0.018),
    earInner: plush(PALETTE.earInner, 0.012),
    ink: standard(PALETTE.ink, { roughness: 0.2, metalness: 0.02 }),
    pad: standard(PALETTE.pad, { roughness: 0.48 }),
    mouth: standard(PALETTE.mouth, { roughness: 0.36 }),
    tongue: standard(PALETTE.tongue, { roughness: 0.56 }),
    collar: standard(PALETTE.collar, { roughness: 0.4 }),
  };

  const root = new THREE.Group();
  const parts = {};
  const mesh = (geometry, material, x, y, z, cast = true) => {
    const item = new THREE.Mesh(geometry, material);
    item.position.set(x, y, z);
    item.castShadow = cast;
    item.receiveShadow = true;
    return item;
  };

  const bodyBase = { x: 1.08, y: 1.34, z: 0.86 };
  const body = mesh(new THREE.SphereGeometry(1.18, 64, 44), materials.fur, 0, -1.28, 0);
  body.scale.set(bodyBase.x, bodyBase.y, bodyBase.z);
  root.add(body);
  root.add(mesh(bellyPatchGeometry(), materials.cream, 0, 0, 0, false));

  [-0.54, 0.54].forEach((x) => {
    const leg = mesh(new THREE.SphereGeometry(0.46, 32, 24), materials.fur, x, -2.48, 0.06);
    leg.scale.set(0.82, 1.08, 0.72);
    root.add(leg);
    const foot = mesh(new THREE.SphereGeometry(0.48, 36, 24), materials.fur, x, -2.84, 0.46);
    foot.scale.set(1.15, 0.58, 1.28);
    root.add(foot);
    const sole = mesh(new THREE.SphereGeometry(0.42, 24, 14), materials.pad, x, -3.02, 0.54, false);
    sole.scale.set(1.22, 0.16, 1.35);
    root.add(sole);
  });

  [["L", -1, 1], ["R", 1, -1]].forEach(([side, sign, direction]) => {
    const arm = new THREE.Group();
    arm.position.set(sign * 0.96, -1.12, 0.02);
    const upper = mesh(new THREE.SphereGeometry(0.46, 36, 24), materials.fur, sign * 0.12, -0.2, 0.05);
    upper.scale.set(0.74, 1.18, 0.78);
    const paw = mesh(new THREE.SphereGeometry(0.45, 36, 24), materials.fur, sign * 0.28, -0.78, 0.22);
    paw.scale.set(1.06, 0.82, 0.86);
    const pad = mesh(new THREE.SphereGeometry(0.14, 18, 12), materials.pad, -sign * 0.02, -0.08, 0.4, false);
    pad.scale.set(1.18, 1, 0.34);
    paw.add(pad);
    [[-0.16, 0.12], [0, 0.2], [0.16, 0.12], [0.02, -0.26]].forEach(([x, y], index) => {
      const toe = mesh(new THREE.SphereGeometry(index === 3 ? 0.095 : 0.075, 14, 10), materials.pad, x, y, 0.41, false);
      toe.scale.z = 0.34;
      paw.add(toe);
    });
    arm.add(upper, paw);
    arm.rotation.z = direction * 0.24;
    root.add(arm);
    parts[`arm${side}`] = arm;
  });

  const head = new THREE.Group();
  head.position.set(0, 0.98, 0);
  root.add(head);
  parts.head = head;

  const skull = mesh(new THREE.SphereGeometry(1.36, 72, 52), materials.fur, 0, 0, 0);
  skull.scale.set(1.35, 1.1, 1.03);
  head.add(skull);

  [["L", -1.14, 1], ["R", 1.14, -1]].forEach(([side, x, direction]) => {
    const ear = new THREE.Group();
    ear.position.set(x, 1.2, -0.26);
    const outer = mesh(roundedEarGeometry(), materials.furLight, 0, 0, 0);
    outer.scale.set(0.86, 1.05, 1);
    const inner = mesh(roundedEarGeometry(), materials.earInner, 0, -0.03, 0.14, false);
    inner.scale.set(0.56, 0.74, 0.45);
    ear.add(outer, inner);
    ear.rotation.z = direction * 0.52;
    head.add(ear);
    parts[`ear${side}`] = ear;
  });

  head.add(mesh(facePatchGeometry(), materials.cream, 0, 0, 0, false));
  const muzzle = mesh(new THREE.SphereGeometry(0.54, 42, 26), materials.cream, 0, -0.36, 1.48, false);
  muzzle.scale.set(1.04, 0.52, 0.42);
  head.add(muzzle);

  [["L", -0.58], ["R", 0.58]].forEach(([side, x]) => {
    const eye = new THREE.Group();
    eye.position.set(x, 0.05, 1.52);
    const ball = mesh(new THREE.SphereGeometry(0.2, 30, 22), materials.ink, 0, 0, 0, false);
    ball.scale.set(0.88, 1.2, 0.64);
    const highlight = mesh(new THREE.SphereGeometry(0.055, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }), 0.06, 0.1, 0.14, false);
    eye.add(ball, highlight);
    head.add(eye);
    parts[`eye${side}`] = eye;
  });

  const nose = mesh(new THREE.SphereGeometry(0.22, 36, 22), materials.ink, 0, -0.2, 1.67, false);
  nose.scale.set(1.36, 0.78, 0.66);
  head.add(nose);
  const noseHighlight = mesh(new THREE.SphereGeometry(0.04, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.48 }), -0.08, -0.15, 1.78, false);
  noseHighlight.scale.set(1.7, 0.65, 0.5);
  head.add(noseHighlight);

  const mouth = mesh(mouthGeometry(), materials.mouth, 0.1, -0.64, 1.67, false);
  head.add(mouth);
  const tongue = mesh(new THREE.SphereGeometry(0.15, 18, 12), materials.tongue, 0.11, -0.78, 1.72, false);
  tongue.scale.set(1.14, 0.42, 0.2);
  head.add(tongue);

  const collarPoints = [
    new THREE.Vector3(0, -0.45, 1.18),
    new THREE.Vector3(0.82, -0.49, 0.9),
    new THREE.Vector3(1.18, -0.54, 0.16),
    new THREE.Vector3(0.82, -0.57, -0.58),
    new THREE.Vector3(0, -0.58, -0.78),
    new THREE.Vector3(-0.82, -0.57, -0.58),
    new THREE.Vector3(-1.18, -0.54, 0.16),
    new THREE.Vector3(-0.82, -0.49, 0.9),
  ];
  root.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(collarPoints), 112, 0.105, 16, true), materials.collar, 0, 0, 0));

  const tagFace = createTagMaterial();
  const tag = mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.09, 56), [materials.collar, tagFace, tagFace], 0, -0.77, 1.31);
  tag.rotation.x = Math.PI / 2;
  root.add(tag);
  root.add(mesh(new THREE.TorusGeometry(0.36, 0.032, 14, 44), materials.collar, 0, -0.77, 1.316, false));

  function update(time) {
    root.position.y = Math.sin(time * 1.35) * 0.04;
    root.rotation.z = Math.sin(time * 0.9) * 0.012;
    const breathe = 1 + Math.sin(time * 2) * 0.012;
    body.scale.set(bodyBase.x * breathe, bodyBase.y / breathe, bodyBase.z * breathe);
    head.position.y = 0.98 + Math.sin(time * 2) * 0.016;
    parts.armL.rotation.z = 0.24 + Math.sin(time * 1.65) * 0.025;
    parts.armR.rotation.z = -0.24 - Math.sin(time * 1.65 + 0.4) * 0.025;
    parts.earL.rotation.z = 0.52 + Math.sin(time * 0.7) * 0.018;
    parts.earR.rotation.z = -0.52 - Math.sin(time * 0.7) * 0.018;
    const blink = 1 - Math.max(0, Math.sin(time * 0.7 - 1.2)) ** 18 * 0.9;
    parts.eyeL.scale.y = blink;
    parts.eyeR.scale.y = blink;
  }

  function dispose() {
    const disposed = new Set();
    root.traverse((item) => {
      if (!item.isMesh) return;
      item.geometry.dispose();
      const itemMaterials = Array.isArray(item.material) ? item.material : [item.material];
      itemMaterials.forEach((material) => {
        if (!disposed.has(material)) {
          material.map?.dispose();
          material.dispose();
          disposed.add(material);
        }
      });
    });
    furBump.dispose();
  }

  return { root, update, dispose };
}
