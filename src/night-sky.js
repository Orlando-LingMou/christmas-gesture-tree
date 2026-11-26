const SKY_WIDTH = 400;
const SKY_HEIGHT = 240;
const TAU = 2 * Math.PI;
const RAIN_SPEED = .54;

function texture(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function curtainTexture(top, core, bottom) {
  const canvas = texture(1, 160);
  const context = canvas.getContext('2d');
  const gradient = context.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, top);
  gradient.addColorStop(.32, bottom);
  gradient.addColorStop(.70, core);
  gradient.addColorStop(.81, core);
  gradient.addColorStop(1, top);
  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);
  return canvas;
}

function rainTexture(depth) {
  const canvas = texture(24, 192);
  const context = canvas.getContext('2d');
  const x = 12;
  const head = 178;
  const tail = context.createLinearGradient(0, 0, 0, head);
  tail.addColorStop(0, '#146bff00');
  tail.addColorStop(.26, '#204aff1f');
  tail.addColorStop(.66, '#478fff83');
  tail.addColorStop(.93, '#9cd5ffda');
  tail.addColorStop(1, '#f3faff');
  context.strokeStyle = tail;
  context.shadowColor = '#347fff';
  context.shadowBlur = 7;
  context.lineWidth = [2.1, 2.8, 3.6][depth];
  context.lineCap = 'round';
  context.beginPath();
  context.moveTo(x - 1.15, 2);
  context.quadraticCurveTo(x + 1.1, head * .58, x, head);
  context.stroke();
  context.shadowBlur = 4;
  for (let i = 0; i < 6; i++) {
    context.fillStyle = `rgba(201, 233, 255, ${.13 + i * .10})`;
    context.beginPath();
    context.ellipse(x + Math.sin(i * 2.4) * 1.6, head - (5 - i) ** 2 * 4,
      .65 + i * .12, .9 + i * .17, 0, 0, TAU);
    context.fill();
  }
  context.fillStyle = '#eff8ff';
  context.beginPath();
  context.ellipse(x, head, 1.45 + depth * .28, 1.9 + depth * .28, 0, 0, TAU);
  context.fill();
  return canvas;
}

export function createNightSky() {
  const aurora = texture(SKY_WIDTH, SKY_HEIGHT);
  const glow = aurora.getContext('2d');
  const bands = [
    { texture: curtainTexture('#1744d700', '#2968e897', '#2662d124'), line: .42, size: .48, speed: .18, phase: .5 },
    { texture: curtainTexture('#29b58900', '#60e8acb5', '#217f8a26'), line: .33, size: .34, speed: -.15, phase: 1.9 },
    { texture: curtainTexture('#724cc900', '#7e92ee86', '#6772d928'), line: .64, size: .50, speed: .12, phase: 4.7 }
  ];
  const streaks = Array.from({ length: 3 }, (_, depth) => rainTexture(depth));
  const drops = Array.from({ length: 235 }, (_, i) => {
    const depth = i % 3;
    return {
      x: Math.random(),
      offset: Math.random(),
      speed: RAIN_SPEED * (.21 + Math.random() * .16) * (1 + depth * .46),
      length: (35 + Math.random() * 66) * (1 + depth * .54),
      depth,
      opacity: .38 + Math.random() * .59
    };
  });
  let lastAurora = -Infinity;

  function drawAurora(context, width, height, time, presenting) {
    if (time < lastAurora || time - lastAurora >= .075) {
      glow.clearRect(0, 0, SKY_WIDTH, SKY_HEIGHT);
      glow.globalCompositeOperation = 'lighter';
      for (const band of bands) {
        for (let column = 0; column < SKY_WIDTH; column++) {
          const x = column / SKY_WIDTH;
          const wave = Math.sin(x * 8.5 + band.phase + time * band.speed) * .115
            + Math.sin(x * 15.5 - time * .16 + band.phase * 2) * .034;
          const arch = band.line + wave - .055 * Math.cos(x * Math.PI);
          const fold = .81 + .13 * Math.sin(x * 39 + time * .38 + band.phase);
          const veilHeight = band.size * SKY_HEIGHT * fold;
          const shimmer = .58 + .24 * Math.sin(x * 49 + time * .46 + band.phase)
            + .13 * Math.sin(x * 114 - time * .24);
          const edgeFade = .34 + .66 * Math.sin(x * Math.PI);
          glow.globalAlpha = shimmer * edgeFade;
          glow.drawImage(band.texture, column, arch * SKY_HEIGHT - veilHeight * .8, 1, veilHeight);
        }
      }
      lastAurora = time;
    }
    context.globalAlpha = presenting ? .84 : .55;
    context.drawImage(aurora, 0, 0, width, height);
  }

  function drawRain(context, width, height, time, presenting) {
    const count = Math.min(drops.length, Math.max(65, Math.round(width / (presenting ? 5.9 : 7.5))));
    const size = Math.max(.58, Math.min(1.45, height / 720));
    for (let i = 0; i < count; i++) {
      const drop = drops[i];
      const length = drop.length * size;
      const travel = height + length * 2;
      const y = ((drop.offset + time * drop.speed) % 1) * travel - length;
      if (y < -length * .12 || y > height + length) continue;
      const x = drop.x * width - (y - height * .35) * .024;
      const thickness = (9 + drop.depth * 2.3) * size;
      const centerFade = .60 + .40 * Math.min(1, Math.abs(drop.x - .5) * 4.2);
      context.globalAlpha = drop.opacity * centerFade * (presenting ? 1 : .68);
      context.drawImage(streaks[drop.depth], x - thickness / 2, y - length * .92, thickness, length);
    }
  }

  return { drawAurora, drawRain };
}
