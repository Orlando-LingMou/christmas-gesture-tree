import { createNightSky } from './night-sky.js';

const TAU = Math.PI * 2;
const starColors = ['#ffe8b8', '#efbd80', '#b1c6ff', '#b3f1de', '#e9b8ff'];

export function createPresentationEffects(canvas, greeting) {
  const context = canvas.getContext('2d');
  if (!context) return { setPresentation() {}, burstGreeting() {} };

  const night = createNightSky();
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const stars = Array.from({ length: 250 }, (_, i) => {
    const x = Math.random();
    const inBand = i % 3 !== 0;
    return {
      x,
      y: inBand ? .18 + x * .58 + (Math.random() + Math.random() - 1) * .35 : Math.random(),
      size: .42 + Math.pow(Math.random(), 2.5) * 1.8,
      phase: Math.random() * TAU,
      color: starColors[i % starColors.length],
      inBand,
      sparkle: i % 19 === 0
    };
  });
  let presenting = false;
  let width = 0;
  let height = 0;
  let ratio = 1;
  let frame;
  let lastDraw = -Infinity;
  const skyFrameInterval = 1000 / 30;
  let sparks = [];
  let burstTime = 0;

  function resize() {
    const bounds = canvas.getBoundingClientRect();
    width = bounds.width;
    height = bounds.height;
    ratio = Math.min(devicePixelRatio || 1, 1.6);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    draw(performance.now());
  }
  new ResizeObserver(resize).observe(canvas);

  function draw(now) {
    const still = reducedMotion.matches;
    const time = still ? 0 : now / 1000;
    context.clearRect(0, 0, width, height);
    context.globalCompositeOperation = 'lighter';
    night.drawAurora(context, width, height, time, presenting);

    for (const star of stars) {
      const x = star.x * width;
      const y = star.y * height + Math.sin(time * .19 + star.phase) * (star.inBand ? 8 : 3);
      const light = .33 + .35 * (.5 + .5 * Math.sin(time * 1.6 + star.phase));
      const size = star.size;
      context.fillStyle = star.color;
      context.globalAlpha = light * .17;
      context.beginPath();
      context.arc(x, y, size * 2.9, 0, TAU);
      context.fill();
      context.globalAlpha = light;
      context.beginPath();
      context.arc(x, y, size, 0, TAU);
      context.fill();
      if (star.sparkle) {
        const ray = size * (3.6 + light * 2);
        context.globalAlpha = light * .52;
        context.fillRect(x - ray, y - .42, ray * 2, .84);
        context.fillRect(x - .42, y - ray, .84, ray * 2);
      }
    }

    night.drawRain(context, width, height, time, presenting);

    const age = (now - burstTime) / 1000;
    if (age < 1.28) {
      const travel = 1 - Math.exp(-age * 4);
      for (const spark of sparks) {
        context.globalAlpha = (1 - age / 1.28) ** 1.5 * spark.opacity;
        context.fillStyle = spark.color;
        context.beginPath();
        context.arc(spark.x + spark.dx * travel, spark.y + spark.dy * travel + 20 * age ** 2,
          spark.size, 0, TAU);
        context.fill();
      }
    }
    context.globalAlpha = 1;
    context.globalCompositeOperation = 'source-over';
  }

  function tick(now) {
    if (now - lastDraw >= skyFrameInterval - 1) {
      lastDraw = now;
      draw(now);
    }
    frame = requestAnimationFrame(tick);
  }

  function setPresentation(enabled) {
    presenting = enabled;
    sparks = [];
    resize();
  }

  resize();
  if (!reducedMotion.matches) frame = requestAnimationFrame(tick);
  reducedMotion.addEventListener('change', () => {
    cancelAnimationFrame(frame);
    draw(performance.now());
    if (!reducedMotion.matches) frame = requestAnimationFrame(tick);
  });

  function burstGreeting() {
    if (!presenting || reducedMotion.matches || !width || !height) return;
    const overlay = canvas.getBoundingClientRect();
    const mask = document.createElement('canvas');
    mask.width = Math.ceil(width);
    mask.height = Math.ceil(height);
    const ink = mask.getContext('2d', { willReadFrequently: true });
    ink.textAlign = 'center';
    ink.textBaseline = 'middle';

    for (const line of greeting.children) {
      if (line.hidden) continue;
      const bounds = line.getBoundingClientRect();
      const style = getComputedStyle(line);
      ink.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
      ink.fillText(line.textContent, bounds.left + bounds.width / 2 - overlay.left,
        bounds.top + bounds.height / 2 - overlay.top, bounds.width);
    }

    const { data } = ink.getImageData(0, 0, mask.width, mask.height);
    const spacing = Math.max(4, Math.round(width / 220));
    sparks = [];
    for (let y = 0; y < mask.height; y += spacing) {
      for (let x = 0; x < mask.width; x += spacing) {
        if (data[(y * mask.width + x) * 4 + 3] < 125 || Math.random() < .4) continue;
        const angle = Math.random() * TAU;
        const speed = 27 + Math.random() * Math.min(180, width * .27);
        sparks.push({
          x, y, dx: Math.cos(angle) * speed + (x - width / 2) * .33,
          dy: Math.sin(angle) * speed * .72,
          size: .62 + Math.random() * 1.45, opacity: .38 + Math.random() * .60,
          color: Math.random() < .53 ? '#fff1b4' : '#ffb93f'
        });
      }
    }
    burstTime = performance.now();
  }

  return { setPresentation, burstGreeting };
}
