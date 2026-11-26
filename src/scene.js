import * as THREE from 'three';

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const TAU = Math.PI * 2;
const clamp = THREE.MathUtils.clamp;
const damp = THREE.MathUtils.damp;

const palette = [
  '#ffd385', '#ffb54d', '#ffecb4', '#c48035', '#ffe3a7', '#a76b31',
  '#36d88d', '#159659', '#70ef9d', '#ff425d', '#d72b42', '#ff7884'
].map((color) => new THREE.Color(color));
const foliage = [6, 7, 8, 9, 6, 7, 10, 0, 8, 9, 7, 11].map((index) => palette[index]);
const COMPACT_SCALE = .78;

function particleField(amount, sample, animated = false) {
  const positions = [];
  const dispersed = [];
  const colors = [];
  const sizes = [];
  const phases = [];
  for (let i = 0; i < amount; i++) {
    const { from, to = from, color, size } = sample(i);
    positions.push(...from);
    dispersed.push(...to);
    colors.push(color.r, color.g, color.b);
    sizes.push(size);
    phases.push(Math.random() * TAU);
  }

  const geometry = new THREE.BufferGeometry();
  for (const [name, array, itemSize] of [
    ['position', positions, 3], ['dispersed', dispersed, 3],
    ['tone', colors, 3], ['size', sizes, 1], ['phase', phases, 1]
  ]) {
    geometry.setAttribute(name, new THREE.Float32BufferAttribute(array, itemSize));
  }

  const material = new THREE.ShaderMaterial({
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    uniforms: {
      time: { value: 0 }, spread: { value: 0 }, pixels: { value: 1 },
      opacity: { value: animated ? 1 : 0.68 }, drift: { value: animated ? 1 : 0 }
    },
    vertexShader: `
      attribute vec3 dispersed, tone;
      attribute float size, phase;
      uniform float time, spread, pixels, drift;
      varying vec3 vTone;
      varying float shimmer;
      void main() {
        vec3 p = mix(position, dispersed, spread);
        p.y += sin(phase + time * .9) * spread * drift * .13;
        p.x += cos(phase + time * .7) * spread * drift * .11;
        shimmer = .78 + .22 * sin(time * 1.7 + phase);
        vTone = tone;
        vec4 mv = modelViewMatrix * vec4(p, 1.);
        gl_Position = projectionMatrix * mv;
        float outlineGlow = (1. - step(.01, distance(position, dispersed))) * drift * .30;
        gl_PointSize = pixels * size * (.9 + shimmer * .17) * (1. + (.24 + outlineGlow) * spread);
      }`,
    fragmentShader: `
      uniform float opacity;
      varying vec3 vTone;
      varying float shimmer;
      void main() {
        float radius = length(gl_PointCoord - vec2(.5)) * 2.;
        float light = .83 * exp(-radius * radius * 12.) + .29 * exp(-radius * radius * 3.);
        light *= 1. - smoothstep(.73, 1., radius);
        gl_FragColor = vec4(vTone, light * shimmer * opacity);
        #include <colorspace_fragment>
      }`
  });

  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  return points;
}

function sampleTree(index) {
  const angle = Math.random() * TAU;
  const height = Math.random();
  const cone = 3.05 * Math.pow(1 - height, .87);
  const tier = 1 - .24 * ((height * 6) % 1);
  const outline = index % 7 === 0;
  const garland = index % 9 === 0;
  const trunk = index % 20 === 1;
  const radius = cone * tier * (outline ? .95 : .35 + .65 * Math.sqrt(Math.random()));
  let from = [Math.cos(angle) * radius, height * 7.6 - 3.7, Math.sin(angle) * radius];
  let color = foliage[index % foliage.length];
  let size = 2 + Math.random() * 2.7;

  if (garland) {
    const ribbon = height * TAU * 5 + (Math.random() - .5) * .19;
    from = [Math.cos(ribbon) * cone, from[1], Math.sin(ribbon) * cone];
    color = palette[index % 2 === 0 ? 0 : 2];
    size *= 1.38;
  }
  if (trunk) {
    const trunkRadius = Math.sqrt(Math.random()) * .36;
    from = [Math.cos(angle) * trunkRadius, -4.28 + height * .8, Math.sin(angle) * trunkRadius];
    color = palette[5];
  }
  if (index % 27 === 2) {
    color = palette[index % 2 === 0 ? 9 : 8];
    size *= 2.2;
  }

  // Keep the outline, trunk, and some garland lights in place while the rest fan out.
  let to = from;
  if (!outline && !trunk && !(garland && index % 2 === 0)) {
    const flight = 1.25 + Math.pow(Math.random(), .72) * 5.4;
    const azimuth = angle + (Math.random() - .5) * 1.3;
    to = [
      from[0] + Math.cos(azimuth) * flight,
      from[1] * .87 + (Math.random() - .5) * (1.6 + .40 * flight),
      from[2] + Math.sin(azimuth) * flight
    ];
  }
  return { from, to, color, size };
}

function sampleFloor(index) {
  const angle = Math.random() * TAU;
  const radius = 1.0 + Math.random() * 5.7;
  const ring = index % 3 === 0 ? 3.2 + (index % 4) * .56 + (Math.random() - .5) * .09 : radius;
  return {
    from: [Math.cos(angle) * ring, -4.44 + Math.sin(angle) * .035, Math.sin(angle) * ring],
    color: palette[index % 5],
    size: 1.2 + Math.random() * 1.8
  };
}

function sampleSky(index) {
  return {
    from: [(Math.random() - .5) * 34, (Math.random() - .5) * 20, -10 + Math.random() * 7],
    color: palette[index % 6],
    size: index % 63 === 0 ? 6.5 : 1.12 + Math.random() * 2.5
  };
}

function starArtwork() {
  const center = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = center * 2;
  const context = canvas.getContext('2d');
  const vertices = Array.from({ length: 10 }, (_, i) => {
    const angle = i * Math.PI / 5 - Math.PI / 2;
    const radius = i % 2 ? 24 : 60;
    return [center + Math.cos(angle) * radius, center + Math.sin(angle) * radius];
  });
  context.beginPath();
  for (const [x, y] of vertices) context.lineTo(x, y);
  context.closePath();
  context.shadowColor = '#ffc05a';
  context.shadowBlur = 15;
  context.strokeStyle = '#f9a63c';
  context.lineWidth = 4;
  context.stroke();
  context.shadowColor = '#fff1ad';
  context.shadowBlur = 6;
  context.strokeStyle = '#fff4cd';
  context.lineWidth = 1.7;
  context.stroke();
  for (let side = 0; side < vertices.length; side++) {
    const [x, y] = vertices[side];
    const [nextX, nextY] = vertices[(side + 1) % vertices.length];
    for (let i = 0; i < 8; i++) {
      const t = i / 8;
      const sparkle = 1 + 1.5 * Math.abs(Math.sin(side * 11 + i * 7));
      context.fillStyle = i % 3 ? '#ffcf79' : '#fff8d9';
      context.beginPath();
      context.arc(x + (nextX - x) * t, y + (nextY - y) * t, sparkle, 0, TAU);
      context.fill();
    }
  }

  const flare = document.createElement('canvas');
  flare.width = flare.height = canvas.width;
  const glow = flare.getContext('2d');
  const halo = glow.createRadialGradient(center, center, 0, center, center, center);
  halo.addColorStop(0, '#fff1b62c');
  halo.addColorStop(.3, '#ffbd4337');
  halo.addColorStop(.64, '#ff942615');
  halo.addColorStop(1, '#ff942600');
  glow.fillStyle = halo;
  glow.fillRect(0, 0, flare.width, flare.height);
  for (let ray = 0; ray < 8; ray++) {
    const angle = ray * TAU / 8 - Math.PI / 2;
    const x = Math.cos(angle);
    const y = Math.sin(angle);
    const length = ray % 2 ? 79 : 119;
    const gradient = glow.createLinearGradient(center, center, center + x * length, center + y * length);
    gradient.addColorStop(0, '#fff6cc00');
    gradient.addColorStop(.23, ray % 2 ? '#ffdc8c88' : '#fff0aaa5');
    gradient.addColorStop(1, '#ffe09c00');
    glow.fillStyle = gradient;
    glow.beginPath();
    glow.moveTo(center - y * 1.45, center + x * 1.45);
    glow.lineTo(center + x * length, center + y * length);
    glow.lineTo(center + y * 1.45, center - x * 1.45);
    glow.fill();
  }
  return { outline: canvas, flare };
}

function starSprite(image, opacity, size) {
  const map = new THREE.CanvasTexture(image);
  map.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map, opacity, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
  }));
  sprite.position.set(0, 4.25, 0);
  sprite.scale.setScalar(size);
  return sprite;
}

function starShimmer(time) {
  return .66 + .29 * Math.sin(time * 2.8) + .05 * Math.sin(time * 5.6);
}

function photoCard(photo, index, amount) {
  const aspect = clamp(photo.width / photo.height, .55, 1.8);
  const width = Math.sqrt(aspect) * 1.17;
  const height = 1.17 / Math.sqrt(aspect);
  const canvas = document.createElement('canvas');
  canvas.width = 384;
  canvas.height = Math.round(canvas.width * (height + .23) / width);
  const context = canvas.getContext('2d', { alpha: false });
  const border = 12;
  const imageHeight = canvas.height - 52;
  const destinationAspect = (canvas.width - border * 2) / imageHeight;
  const sourceWidth = Math.min(photo.width, photo.height * destinationAspect);
  const sourceHeight = sourceWidth / destinationAspect;
  const paper = context.createLinearGradient(0, 0, canvas.width, canvas.height);
  paper.addColorStop(0, '#ffecce');
  paper.addColorStop(1, '#c99857');
  context.fillStyle = paper;
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(photo.image, (photo.width - sourceWidth) / 2, (photo.height - sourceHeight) / 2,
    sourceWidth, sourceHeight, border, border, canvas.width - border * 2, imageHeight);
  context.fillStyle = '#84613d';
  context.font = '15px Georgia';
  context.textAlign = 'center';
  context.fillText(String(index + 1).padStart(2, '0'), canvas.width / 2, canvas.height - 13);

  const angle = index * GOLDEN_ANGLE + .35;
  const heightFraction = 1 - (index + .5) / amount;
  const y = heightFraction * 6.55 - 3.18;
  const branchRadius = .22 + 2.85 * Math.pow(1 - heightFraction, .84);
  const orbit = 3.25 + 2.45 * Math.pow(1 - heightFraction, .88);
  return {
    canvas, width, height: height + .23, index,
    destination: new THREE.Vector3(Math.cos(angle) * orbit, y * 1.12, Math.sin(angle) * orbit),
    origin: new THREE.Vector3(Math.cos(angle) * branchRadius, y, Math.sin(angle) * branchRadius),
    roll: .24 * Math.sin(angle)
  };
}

function photoMesh(photo, index, amount) {
  const { canvas, width, height, ...positioning } = photoCard(photo, index, amount);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.MeshBasicMaterial({ map: texture });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
  mesh.userData = { ...positioning, width, height };
  return mesh;
}

function focusTarget(cards, width, height, previous) {
  let closest;
  let best = Infinity;
  for (const card of cards) {
    if (card.x < 0 || card.x > width || card.y < 0 || card.y > height) continue;
    const distance = Math.hypot(card.x - width / 2, card.y - height / 2);
    const score = distance - card.z * 4 - (card.index === previous ? 12 : 0);
    if (score < best) {
      best = score;
      closest = card;
    }
  }
  return closest;
}

function cardScale(spread, depth) {
  return (.46 + spread * .84) * (1 + clamp(depth * .032, -.16, .16));
}

function stageFraming(width, height, presenting) {
  const aspect = width / height;
  const viewHeight = presenting ? Math.max(11.8, 7 / aspect) : aspect < .93 ? 14.7 : 11.8;
  return {
    units: height / viewHeight,
    offsetX: presenting || aspect <= 1.2 ? 0 : Math.min(2.3, viewHeight * aspect * .10),
    offsetY: presenting ? 0 : aspect < .93 ? -1.25 : -.35,
    spreadScale: Math.min(1, viewHeight * aspect / 14.4)
  };
}

export function createScene(host) {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('webgl2', { alpha: true, antialias: true });
  if (!context) return createCanvasScene(host);

  const renderer = new THREE.WebGLRenderer({ canvas, context, alpha: true, antialias: true });
  renderer.setClearColor(0x000000, 0);
  host.append(renderer.domElement);

  const scene = new THREE.Scene();
  const tableau = new THREE.Group();
  const cloud = new THREE.Group();
  const photoGroup = new THREE.Group();
  cloud.add(photoGroup);
  tableau.add(cloud);
  scene.add(tableau);

  const camera = new THREE.OrthographicCamera(-8, 8, 6, -6, .1, 80);
  camera.position.z = 27;
  const sky = particleField(460, sampleSky);
  const floor = particleField(780, sampleFloor);
  floor.rotation.x = .22;
  floor.position.y = 4.44 * (1 - COMPACT_SCALE);
  const tree = particleField(11500, sampleTree, true);
  const crown = starArtwork();
  const star = starSprite(crown.outline, 1, 2.35);
  const starFlare = starSprite(crown.flare, .72, 3.3);
  scene.add(sky);
  tableau.add(floor);
  cloud.add(tree, starFlare, star);
  const raycaster = new THREE.Raycaster();
  const cardDepth = new THREE.Vector3();
  const inverseRotation = new THREE.Quaternion();
  const photoRotation = new THREE.Quaternion();
  const faceAxis = new THREE.Vector3(0, 0, 1);
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let mode = 'tree';
  let presenting = false;
  let spread = 0;
  let targetX = 0;
  let targetY = 0;
  let homeX = 0;
  let homeY = 0;
  let cloudScale = 1;
  let clock = 0;
  let previousTime;

  function resize() {
    const { width, height } = host.getBoundingClientRect();
    if (!width || !height) return;
    const aspect = width / height;
    const pixelRatio = Math.min(devicePixelRatio, width <= 690 ? 1.4 : 1.65);
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(width, height, false);
    const framing = stageFraming(width, height, presenting);
    const viewHeight = height / framing.units;
    camera.left = -viewHeight * aspect / 2;
    camera.right = viewHeight * aspect / 2;
    camera.top = viewHeight / 2;
    camera.bottom = -viewHeight / 2;
    camera.updateProjectionMatrix();
    homeX = framing.offsetX;
    homeY = framing.offsetY;
    cloudScale = framing.spreadScale;
    for (const field of [sky, floor, tree]) field.material.uniforms.pixels.value = pixelRatio;
  }
  new ResizeObserver(resize).observe(host);
  resize();
  tableau.position.set(homeX, homeY, 0);

  function setMode(next) {
    mode = next;
    targetX = 0;
    if (mode === 'scatter') cloud.rotation.x = 0;
  }

  function setPhotos(photos) {
    const cards = photos.map((photo, index) => photoMesh(photo, index, photos.length));
    for (const mesh of [...photoGroup.children]) {
      photoGroup.remove(mesh);
      mesh.geometry.dispose();
      mesh.material.map.dispose();
      mesh.material.dispose();
    }
    for (const card of cards) photoGroup.add(card);
  }

  function drag(dx, dy) {
    targetY += dx * .009;
    if (mode === 'tree') targetX = clamp(targetX + dy * .007, -.55, .55);
  }

  function steer(dx) {
    targetY += dx * 4.6;
  }

  function pick(clientX, clientY) {
    const bounds = host.getBoundingClientRect();
    raycaster.setFromCamera(new THREE.Vector2(
      (clientX - bounds.left) / bounds.width * 2 - 1,
      1 - (clientY - bounds.top) / bounds.height * 2
    ), camera);
    return raycaster.intersectObjects(photoGroup.children)[0]?.object.userData.index;
  }

  function targetPhoto(previous) {
    if (mode !== 'scatter' || spread < .45) return undefined;
    const width = host.clientWidth;
    const height = host.clientHeight;
    const position = new THREE.Vector3();
    const units = height / (camera.top - camera.bottom) * cloud.scale.x;
    const cards = photoGroup.children.map((mesh) => {
      mesh.getWorldPosition(position);
      const z = position.z;
      position.project(camera);
      const { index, width: cardWidth, height: cardHeight, roll } = mesh.userData;
      return { index, z, roll, x: (position.x + 1) * width / 2, y: (1 - position.y) * height / 2,
        screenWidth: cardWidth * units * mesh.scale.x, screenHeight: cardHeight * units * mesh.scale.y };
    });
    return focusTarget(cards, width, height, previous);
  }

  function setPresentation(enabled) {
    presenting = enabled;
    sky.visible = floor.visible = !enabled;
    resize();
  }

  renderer.setAnimationLoop((frameTime) => {
    const elapsed = previousTime === undefined ? 0 : Math.min((frameTime - previousTime) / 1000, .05);
    previousTime = frameTime;
    if (document.hidden) return;
    const duration = reducedMotion.matches ? .05 : elapsed;
    const isScatter = mode === 'scatter';
    const motion = reducedMotion.matches ? 24 : isScatter ? 7.5 : 6;
    if (!reducedMotion.matches) {
      clock += elapsed;
      if (!isScatter) targetY += elapsed * .19;
    }
    spread = damp(spread, isScatter ? 1 : 0, motion, duration);
    tableau.position.x = damp(tableau.position.x, isScatter ? 0 : homeX, motion, duration);
    tableau.position.y = damp(tableau.position.y, isScatter ? 0 : homeY, motion, duration);
    cloud.scale.setScalar(COMPACT_SCALE + (cloudScale - COMPACT_SCALE) * spread);
    floor.material.uniforms.opacity.value = .68 * (1 - spread * .77);
    const shimmer = starShimmer(clock);
    starFlare.material.opacity = shimmer;
    starFlare.scale.setScalar(3.08 + .61 * shimmer);
    const turnSpeed = isScatter ? 15 : 6;
    cloud.rotation.y = damp(cloud.rotation.y, targetY, turnSpeed, duration);
    cloud.rotation.x = damp(cloud.rotation.x, targetX, turnSpeed, duration);
    inverseRotation.copy(cloud.quaternion).invert();
    for (const field of [sky, floor, tree]) field.material.uniforms.time.value = clock;
    tree.material.uniforms.spread.value = spread;
    for (const photo of photoGroup.children) {
      const { origin, destination, roll } = photo.userData;
      photo.position.lerpVectors(origin, destination, spread);
      photo.position.y += Math.sin(clock * 1.1 + roll * 10) * .12 * spread;
      const depth = cardDepth.copy(photo.position).applyQuaternion(cloud.quaternion).z;
      photo.scale.setScalar(cardScale(spread, depth));
      photo.quaternion.copy(inverseRotation).multiply(photoRotation.setFromAxisAngle(faceAxis, roll));
    }
    renderer.render(scene, camera);
  });

  return { setMode, setPhotos, setPresentation, drag, steer, pick, targetPhoto };
}

function createCanvasScene(host) {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas 2D is unavailable.');
  host.append(canvas);

  const makeField = (amount, sample) => Array.from({ length: amount }, (_, index) => sample(index));
  const sky = makeField(220, sampleSky);
  const floor = makeField(350, sampleFloor);
  const tree = makeField(3800, sampleTree);
  const rotation = new THREE.Euler(0, 0, 0, 'XYZ');
  const quaternion = new THREE.Quaternion();
  const point = new THREE.Vector3();
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const crown = starArtwork();
  const dots = new Map(palette.map((color) => {
    const dot = document.createElement('canvas');
    dot.width = dot.height = 24;
    const ctx = dot.getContext('2d');
    const hex = color.getHexString();
    const light = ctx.createRadialGradient(12, 12, 0, 12, 12, 12);
    light.addColorStop(0, `#${hex}ff`);
    light.addColorStop(.38, `#${hex}77`);
    light.addColorStop(1, `#${hex}00`);
    ctx.fillStyle = light;
    ctx.fillRect(0, 0, 24, 24);
    return [color, dot];
  }));

  let width = 0;
  let height = 0;
  let ratio = 1;
  let mode = 'tree';
  let presenting = false;
  let x = 0;
  let y = 0;
  let targetX = 0;
  let targetY = 0;
  let spread = 0;
  let lastFrame = 0;
  let clock = 0;
  let cards = [];
  let positionedCards = [];

  function resize() {
    const bounds = host.getBoundingClientRect();
    width = bounds.width;
    height = bounds.height;
    ratio = Math.min(devicePixelRatio, 1.5);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
  }
  new ResizeObserver(resize).observe(host);
  resize();

  function render(now) {
    requestAnimationFrame(render);
    const elapsed = Math.min((now - lastFrame) / 1000, .05);
    lastFrame = now;
    if (!width || !height || document.hidden) return;
    const still = reducedMotion.matches;
    const duration = still ? .05 : elapsed;
    if (!still) {
      clock += elapsed;
      if (mode === 'tree') targetY += elapsed * .19;
    }
    const isScatter = mode === 'scatter';
    spread = damp(spread, isScatter ? 1 : 0, still ? 22 : isScatter ? 7.5 : 6, duration);
    const turnSpeed = isScatter ? 15 : 6;
    x = damp(x, targetX, turnSpeed, duration);
    y = damp(y, targetY, turnSpeed, duration);
    rotation.set(x, y, 0);
    quaternion.setFromEuler(rotation);
    const { units, offsetX, offsetY, spreadScale } = stageFraming(width, height, presenting);
    const centerX = width / 2 + offsetX * units * (1 - spread);
    const centerY = height / 2 - offsetY * units * (1 - spread);
    const scale = units * (COMPACT_SCALE + (spreadScale - COMPACT_SCALE) * spread);

    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, width, height);
    context.globalCompositeOperation = 'lighter';
    context.globalAlpha = .55;
    function dot(particle, px, py, size) {
      context.drawImage(dots.get(particle.color), px - size / 2, py - size / 2, size, size);
    }
    if (!presenting) {
      for (const particle of sky) {
        dot(particle, width / 2 + particle.from[0] * units, height / 2 - particle.from[1] * units, particle.size);
      }
      context.globalAlpha = .65 * (1 - .77 * spread);
      for (const particle of floor) {
        const [fx, fy, fz] = particle.from;
        dot(particle, centerX + fx * units, centerY - (fy * .97 * COMPACT_SCALE - fz * .22) * units, particle.size);
      }
    }

    for (let i = 0; i < tree.length; i++) {
      const particle = tree[i];
      const { from, to } = particle;
      point.set(
        from[0] + (to[0] - from[0]) * spread,
        from[1] + (to[1] - from[1]) * spread + Math.sin(i * 2.37 + clock) * spread * .12,
        from[2] + (to[2] - from[2]) * spread
      ).applyQuaternion(quaternion);
      context.globalAlpha = .64 + .28 * Math.sin(i * 5.31 + clock * 2);
      const outlineGlow = from === to ? .30 : 0;
      const size = particle.size * (1.1 + (.20 + outlineGlow) * spread);
      dot(particle, centerX + point.x * scale, centerY - point.y * scale, size);
    }
    context.globalAlpha = 1;
    point.set(0, 4.25, 0).applyQuaternion(quaternion);
    const starX = centerX + point.x * scale;
    const starY = centerY - point.y * scale;
    const shimmer = starShimmer(clock);
    const haloSize = (3.08 + .61 * shimmer) * scale;
    const starSize = 2.35 * scale;
    context.globalAlpha = shimmer;
    context.drawImage(crown.flare, starX - haloSize / 2, starY - haloSize / 2, haloSize, haloSize);
    context.globalAlpha = 1;
    context.drawImage(crown.outline, starX - starSize / 2, starY - starSize / 2, starSize, starSize);
    context.globalCompositeOperation = 'source-over';
    context.globalAlpha = 1;

    positionedCards = cards.map((card) => {
      point.lerpVectors(card.origin, card.destination, spread);
      point.y += Math.sin(clock * 1.1 + card.roll * 10) * .12 * spread;
      point.applyQuaternion(quaternion);
      const size = cardScale(spread, point.z) * scale;
      return { ...card, x: centerX + point.x * scale, y: centerY - point.y * scale,
        z: point.z, screenWidth: card.width * size, screenHeight: card.height * size };
    }).sort((first, second) => first.z - second.z);
    for (const card of positionedCards) {
      context.save();
      context.translate(card.x, card.y);
      context.rotate(-card.roll);
      context.drawImage(card.canvas, -card.screenWidth / 2, -card.screenHeight / 2, card.screenWidth, card.screenHeight);
      context.restore();
    }
  }
  requestAnimationFrame(render);

  return {
    setMode(next) {
      mode = next;
      targetX = 0;
      if (mode === 'scatter') x = 0;
    },
    setPresentation(enabled) {
      presenting = enabled;
    },
    setPhotos(photos) {
      cards = photos.map((photo, index) => photoCard(photo, index, photos.length));
      positionedCards = [];
    },
    drag(dx, dy) {
      targetY += dx * .009;
      if (mode === 'tree') targetX = clamp(targetX + dy * .007, -.55, .55);
    },
    steer(dx) {
      targetY += dx * 4.6;
    },
    pick(clientX, clientY) {
      const bounds = canvas.getBoundingClientRect();
      const px = clientX - bounds.left;
      const py = clientY - bounds.top;
      return positionedCards.findLast((card) => {
        const dx = px - card.x;
        const dy = py - card.y;
        const cos = Math.cos(card.roll);
        const sin = Math.sin(card.roll);
        return Math.abs(dx * cos - dy * sin) < card.screenWidth / 2 &&
          Math.abs(dx * sin + dy * cos) < card.screenHeight / 2;
      })?.index;
    },
    targetPhoto(previous) {
      if (mode !== 'scatter' || spread < .45) return undefined;
      return focusTarget(positionedCards, width, height, previous);
    }
  };
}
