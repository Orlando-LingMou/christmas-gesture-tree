const SKY_WIDTH = 160;
const SKY_HEIGHT = 96;
const SNOW_SPEED = .16;

function texture(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function curtainTexture(top, core, bottom) {
  const canvas = texture(1, 64);
  const context = canvas.getContext('2d');
  const gradient = context.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, top);
  gradient.addColorStop(.32, bottom);
  gradient.addColorStop(.68, core);
  gradient.addColorStop(.82, core);
  gradient.addColorStop(1, top);
  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);
  return canvas;
}

function flakeTexture(depth) {
  const size = [4, 6, 8][depth];
  const canvas = texture(size, size);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  if (depth === 0) {
    ctx.fillStyle = '#dbeeff';
    ctx.fillRect(1, 1, 2, 2);
  } else if (depth === 1) {
    ctx.fillStyle = '#eef7ff';
    ctx.fillRect(2, 0, 2, 6);
    ctx.fillRect(0, 2, 6, 2);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(2, 2, 2, 2);
  } else {
    ctx.fillStyle = '#cbe4ff';
    ctx.fillRect(3, 0, 2, 8);
    ctx.fillRect(0, 3, 8, 2);
    ctx.fillRect(1, 1, 2, 2);
    ctx.fillRect(5, 1, 2, 2);
    ctx.fillRect(1, 5, 2, 2);
    ctx.fillRect(5, 5, 2, 2);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(3, 3, 2, 2);
  }
  return canvas;
}

export function createNightSky() {
  const aurora = texture(SKY_WIDTH, SKY_HEIGHT);
  const glow = aurora.getContext('2d');
  glow.imageSmoothingEnabled = false;
  const bands = [
    { texture: curtainTexture('#1d63b800', '#3d99d678', '#255da320'), line: .40, size: .44, speed: .16, phase: .5 },
    { texture: curtainTexture('#2bb58500', '#63e3a388', '#227c7524'), line: .31, size: .32, speed: -.13, phase: 1.9 },
    { texture: curtainTexture('#c9942c00', '#ffd46b48', '#8a602418'), line: .58, size: .36, speed: .10, phase: 4.3 }
  ];
  const flakes = Array.from({ length: 3 }, (_, depth) => flakeTexture(depth));
  const drops = Array.from({ length: 170 }, (_, i) => {
    const depth = i % 3;
    return {
      x: Math.random(),
      offset: Math.random(),
      drift: (Math.random() - .5) * .045,
      sway: .5 + Math.random() * 1.4,
      phase: Math.random() * Math.PI * 2,
      speed: SNOW_SPEED * (.52 + Math.random() * .42) * (1 + depth * .38),
      depth,
      opacity: .52 + Math.random() * .46
    };
  });
  let lastAurora = -Infinity;

  function drawAurora(context, width, height, time, presenting) {
    if (time < lastAurora || time - lastAurora >= .11) {
      glow.clearRect(0, 0, SKY_WIDTH, SKY_HEIGHT);
      glow.globalCompositeOperation = 'lighter';
      for (const band of bands) {
        for (let column = 0; column < SKY_WIDTH; column += 2) {
          const x = column / SKY_WIDTH;
          const wave = Math.sin(x * 7.8 + band.phase + time * band.speed) * .10
            + Math.sin(x * 14.5 - time * .14 + band.phase * 2) * .03;
          const arch = band.line + wave - .05 * Math.cos(x * Math.PI);
          const fold = .82 + .12 * Math.sin(x * 32 + time * .34 + band.phase);
          const veilHeight = Math.round(band.size * SKY_HEIGHT * fold);
          const shimmer = .58 + .24 * Math.sin(x * 42 + time * .42 + band.phase);
          const edgeFade = .34 + .66 * Math.sin(x * Math.PI);
          glow.globalAlpha = shimmer * edgeFade;
          glow.drawImage(band.texture, column, Math.round(arch * SKY_HEIGHT - veilHeight * .8), 2, veilHeight);
        }
      }
      lastAurora = time;
    }
    const prevSmoothing = context.imageSmoothingEnabled;
    context.imageSmoothingEnabled = false;
    context.globalAlpha = presenting ? .76 : .48;
    context.drawImage(aurora, 0, 0, width, height);
    context.imageSmoothingEnabled = prevSmoothing;
  }

  function drawRain(context, width, height, time, presenting) {
    const prevSmoothing = context.imageSmoothingEnabled;
    context.imageSmoothingEnabled = false;
    const count = Math.min(drops.length, Math.max(48, Math.round(width / (presenting ? 7 : 9.5))));
    const scale = Math.max(.85, Math.min(1.5, Math.min(width, height) / 520));
    for (let i = 0; i < count; i++) {
      const drop = drops[i];
      const travel = height + 32;
      const y = ((drop.offset + time * drop.speed) % 1) * travel - 16;
      const swayX = Math.sin(time * drop.sway + drop.phase) * (8 + drop.depth * 5);
      const x = ((drop.x * width + swayX + time * drop.drift * width) % width + width) % width;
      const flake = flakes[drop.depth];
      const size = Math.max(3, Math.round(flake.width * scale));
      context.globalAlpha = drop.opacity * (presenting ? .95 : .78);
      context.drawImage(flake, Math.round(x), Math.round(y), size, size);
    }
    context.imageSmoothingEnabled = prevSmoothing;
  }

  return { drawAurora, drawRain };
}
