import * as THREE from 'three';

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const TAU = Math.PI * 2;
const clamp = THREE.MathUtils.clamp;
const damp = THREE.MathUtils.damp;

const palette = ['#ffd385', '#ffb54d', '#ffecb4', '#c48035', '#ffe3a7', '#a76b31', '#598565', '#f08b59']
  .map((color) => new THREE.Color(color));

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
        gl_PointSize = pixels * size * (.9 + shimmer * .17) * (1. + .24 * spread);
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
  const radius = cone * tier * (.35 + .65 * Math.sqrt(Math.random()));
  let from = [Math.cos(angle) * radius, height * 7.6 - 3.7, Math.sin(angle) * radius];
  let color = palette[index % palette.length];
  let size = 1.9 + Math.random() * 2.8;

  if (index % 9 === 0) {
    const ribbon = height * TAU * 5 + (Math.random() - .5) * .19;
    from = [Math.cos(ribbon) * cone, from[1], Math.sin(ribbon) * cone];
    color = palette[index % 3];
    size *= 1.4;
  }
  if (index % 20 === 1) {
    const trunk = Math.sqrt(Math.random()) * .36;
    from = [Math.cos(angle) * trunk, -4.28 + height * .8, Math.sin(angle) * trunk];
    color = palette[5];
  }
  if (index % 27 === 2) {
    color = palette[2];
    size *= 2.35;
  }

  const latitude = Math.asin(Math.random() * 2 - 1);
  const distance = .8 + Math.pow(Math.random(), .62) * 5.2;
  const to = [
    distance * Math.cos(angle) * Math.cos(latitude) * 1.34,
    distance * Math.sin(latitude) * .81,
    distance * Math.sin(angle) * Math.cos(latitude) * 1.06
  ];
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

function starTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext('2d');
  const glow = context.createRadialGradient(128, 128, 0, 128, 128, 126);
  glow.addColorStop(0, '#fffbe5');
  glow.addColorStop(.12, '#ffe8aabf');
  glow.addColorStop(.4, '#eea4424d');
  glow.addColorStop(1, '#bd662400');
  context.fillStyle = glow;
  context.fillRect(0, 0, 256, 256);
  context.beginPath();
  for (let i = 0; i < 10; i++) {
    const angle = i * Math.PI / 5 - Math.PI / 2;
    const radius = i % 2 === 0 ? 54 : 20;
    context.lineTo(128 + Math.cos(angle) * radius, 128 + Math.sin(angle) * radius);
  }
  context.closePath();
  context.strokeStyle = '#fff0c5';
  context.lineWidth = 3;
  context.fillStyle = '#ffd376';
  context.shadowColor = '#fff6c5';
  context.shadowBlur = 21;
  context.fill();
  context.stroke();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
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

  const angle = index * GOLDEN_ANGLE;
  const y = 1 - 2 * (index + .5) / amount;
  const ring = Math.sqrt(1 - y * y);
  return {
    canvas, width, height: height + .23, index,
    destination: new THREE.Vector3(Math.cos(angle) * ring * 5.45, y * 3.55, Math.sin(angle) * ring * 3.6),
    origin: new THREE.Vector3(Math.cos(angle) * .2, y * .9, Math.sin(angle) * .2),
    roll: .24 * Math.sin(angle)
  };
}

function photoMesh(photo, index, amount) {
  const { canvas, width, height, ...positioning } = photoCard(photo, index, amount);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.MeshBasicMaterial({ map: texture });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
  mesh.userData = positioning;
  return mesh;
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
  const tree = particleField(11500, sampleTree, true);
  const star = new THREE.Sprite(new THREE.SpriteMaterial({
    map: starTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
  }));
  star.position.set(0, 4.25, 0);
  star.scale.setScalar(2.45);
  scene.add(sky);
  tableau.add(floor);
  cloud.add(tree, star);
  const raycaster = new THREE.Raycaster();
  const inverseRotation = new THREE.Quaternion();
  const photoRotation = new THREE.Quaternion();
  const faceAxis = new THREE.Vector3(0, 0, 1);
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let mode = 'tree';
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
    const viewHeight = aspect < .93 ? 14.7 : 11.8;
    camera.left = -viewHeight * aspect / 2;
    camera.right = viewHeight * aspect / 2;
    camera.top = viewHeight / 2;
    camera.bottom = -viewHeight / 2;
    camera.updateProjectionMatrix();
    homeX = aspect > 1.2 ? Math.min(2.3, viewHeight * aspect * .10) : 0;
    homeY = aspect < .93 ? -1.25 : -.35;
    cloudScale = Math.min(1, viewHeight * aspect / 13.2);
    for (const field of [sky, floor, tree]) field.material.uniforms.pixels.value = pixelRatio;
  }
  new ResizeObserver(resize).observe(host);
  resize();
  tableau.position.set(homeX, homeY, 0);

  function setMode(next) {
    mode = next;
    if (mode === 'tree') targetX = 0;
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
    targetX = clamp(targetX + dy * .007, -.55, .55);
  }

  // Adapted from the scatter-mode hand-to-rotation mapping in Grand Luxury Tree.
  function steer(x, y) {
    const angle = x * Math.PI * .9;
    targetY = angle + TAU * Math.round((cloud.rotation.y - angle) / TAU);
    targetX = y * Math.PI * .25;
  }

  function pick(clientX, clientY) {
    if (spread < .28 || mode !== 'scatter') return undefined;
    const bounds = host.getBoundingClientRect();
    raycaster.setFromCamera(new THREE.Vector2(
      (clientX - bounds.left) / bounds.width * 2 - 1,
      1 - (clientY - bounds.top) / bounds.height * 2
    ), camera);
    return raycaster.intersectObjects(photoGroup.children)[0]?.object.userData.index;
  }

  function closestPhoto() {
    const position = new THREE.Vector3();
    let closest;
    let distance = Infinity;
    for (const mesh of photoGroup.children) {
      mesh.getWorldPosition(position).project(camera);
      const score = position.x ** 2 + position.y ** 2 + position.z * .10;
      if (score < distance) {
        closest = mesh.userData.index;
        distance = score;
      }
    }
    return closest;
  }

  renderer.setAnimationLoop((frameTime) => {
    const elapsed = previousTime === undefined ? 0 : Math.min((frameTime - previousTime) / 1000, .05);
    previousTime = frameTime;
    if (document.hidden) return;
    const duration = reducedMotion.matches ? .05 : elapsed;
    const isScatter = mode === 'scatter';
    const motion = reducedMotion.matches ? 24 : 4.6;
    if (!reducedMotion.matches) {
      clock += elapsed;
      if (!isScatter) targetY += elapsed * .19;
    }
    spread = damp(spread, isScatter ? 1 : 0, motion, duration);
    tableau.position.x = damp(tableau.position.x, isScatter ? 0 : homeX, motion, duration);
    tableau.position.y = damp(tableau.position.y, homeY, motion, duration);
    cloud.scale.setScalar(1 + (cloudScale - 1) * spread);
    floor.material.uniforms.opacity.value = .68 * (1 - spread * .77);
    star.material.opacity = Math.pow(1 - spread, 2);
    cloud.rotation.y = damp(cloud.rotation.y, targetY, 4, duration);
    cloud.rotation.x = damp(cloud.rotation.x, targetX, 4, duration);
    inverseRotation.copy(cloud.quaternion).invert();
    for (const field of [sky, floor, tree]) field.material.uniforms.time.value = clock;
    tree.material.uniforms.spread.value = spread;
    for (const photo of photoGroup.children) {
      const { origin, destination, roll } = photo.userData;
      photo.visible = spread > .08;
      photo.position.lerpVectors(origin, destination, spread);
      photo.position.y += Math.sin(clock * 1.1 + roll * 10) * .12 * spread;
      photo.scale.setScalar(clamp((spread - .08) / .52, .001, 1));
      photo.quaternion.copy(inverseRotation).multiply(photoRotation.setFromAxisAngle(faceAxis, roll));
    }
    renderer.render(scene, camera);
  });

  return { setMode, setPhotos, drag, steer, pick, closestPhoto };
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
  const star = starTexture().image;
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
    spread = damp(spread, mode === 'scatter' ? 1 : 0, still ? 22 : 4.6, duration);
    x = damp(x, targetX, 4, duration);
    y = damp(y, targetY, 4, duration);
    rotation.set(x, y, 0);
    quaternion.setFromEuler(rotation);
    const aspect = width / height;
    const units = height / (aspect < .93 ? 14.7 : 11.8);
    const centerX = width / 2 + (aspect > 1.2 ? Math.min(2.3 * units, width * .10) : 0) * (1 - spread);
    const centerY = height / 2 + (aspect < .93 ? 1.25 : .35) * units;
    const scale = units + (Math.min(units, width / 13.2) - units) * spread;

    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, width, height);
    context.globalCompositeOperation = 'lighter';
    context.globalAlpha = .55;
    function dot(particle, px, py, size) {
      context.drawImage(dots.get(particle.color), px - size / 2, py - size / 2, size, size);
    }
    for (const particle of sky) {
      dot(particle, width / 2 + particle.from[0] * units, height / 2 - particle.from[1] * units, particle.size);
    }
    context.globalAlpha = .65 * (1 - .77 * spread);
    for (const particle of floor) {
      const [fx, fy, fz] = particle.from;
      dot(particle, centerX + fx * units, centerY - (fy * .97 - fz * .22) * units, particle.size);
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
      dot(particle, centerX + point.x * scale, centerY - point.y * scale, particle.size * (1.1 + .20 * spread));
    }
    context.globalAlpha = (1 - spread) ** 2;
    context.drawImage(star, centerX - 1.23 * units, centerY - 5.48 * units, 2.46 * units, 2.46 * units);
    context.globalCompositeOperation = 'source-over';
    context.globalAlpha = 1;

    positionedCards = spread > .08 ? cards.map((card) => {
      point.lerpVectors(card.origin, card.destination, spread);
      point.y += Math.sin(clock * 1.1 + card.roll * 10) * .12 * spread;
      point.applyQuaternion(quaternion);
      const size = clamp((spread - .08) / .52, .001, 1) * scale;
      return { ...card, x: centerX + point.x * scale, y: centerY - point.y * scale,
        z: point.z, screenWidth: card.width * size, screenHeight: card.height * size };
    }).sort((first, second) => first.z - second.z) : [];
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
      if (mode === 'tree') targetX = 0;
    },
    setPhotos(photos) {
      cards = photos.map((photo, index) => photoCard(photo, index, photos.length));
      positionedCards = [];
    },
    drag(dx, dy) {
      targetY += dx * .009;
      targetX = clamp(targetX + dy * .007, -.55, .55);
    },
    steer(handX, handY) {
      const angle = handX * Math.PI * .9;
      targetY = angle + TAU * Math.round((y - angle) / TAU);
      targetX = handY * Math.PI * .25;
    },
    pick(clientX, clientY) {
      if (mode !== 'scatter' || spread < .28) return undefined;
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
    closestPhoto() {
      if (!positionedCards.length) return cards[0]?.index;
      const distance = (card) => (card.x - width / 2) ** 2 + (card.y - height / 2) ** 2 - card.z * 12;
      return positionedCards.reduce((closest, card) => distance(card) < distance(closest) ? card : closest).index;
    }
  };
}
