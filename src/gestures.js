const fingers = [[5, 6, 8], [9, 10, 12], [13, 14, 16], [17, 18, 20]];
const palmPoints = [0, 5, 9, 13, 17];

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y, (a.z ?? 0) - (b.z ?? 0));
}

export function readHand(landmarks, wasPinching = false) {
  if (landmarks?.length !== 21) return null;
  const wrist = landmarks[0];
  const center = landmarks[9];
  const palm = Math.max(distance(wrist, center), distance(landmarks[5], landmarks[17]), .018);
  const extended = fingers.map(([base, joint, tip]) => {
    const reach = distance(landmarks[base], landmarks[tip]);
    const length = distance(landmarks[base], landmarks[joint]) + distance(landmarks[joint], landmarks[tip]);
    return reach > length * .78 && distance(wrist, landmarks[tip]) > distance(wrist, landmarks[joint]) + palm * .08;
  });
  const otherFingers = extended.slice(1).filter(Boolean).length;
  const thumb = landmarks[4];
  const index = landmarks[8];
  const gap2D = Math.hypot(thumb.x - index.x, thumb.y - index.y) / palm;
  const depth = Math.abs((thumb.z ?? 0) - (index.z ?? 0)) / palm;
  let pose = 'neutral';
  if (otherFingers >= 1 && gap2D < (wasPinching ? .4 : .29) && depth < .35) pose = 'pinch';
  else if (extended.filter(Boolean).length >= 3) pose = 'open';
  else if (otherFingers === 0 && !extended[0] && distance(index, wrist) < palm * 1.45) pose = 'fist';

  const palmX = palmPoints.reduce((sum, point) => sum + landmarks[point].x, 0) / palmPoints.length;
  const palmY = palmPoints.reduce((sum, point) => sum + landmarks[point].y, 0) / palmPoints.length;
  return {
    pose,
    x: Math.max(-1, Math.min(1, (.5 - palmX) * 2)),
    y: Math.max(-1, Math.min(1, (.5 - palmY) * 2))
  };
}

export function stabilizePose() {
  let candidate = 'neutral';
  let stable = 'neutral';
  let frames = 0;
  return (pose) => {
    if (pose === candidate) frames++;
    else {
      candidate = pose;
      frames = 1;
    }
    const required = pose === 'pinch' || pose === 'open' ? 2 : 3;
    if (frames >= required && stable !== candidate) {
      stable = candidate;
      return stable;
    }
    return null;
  };
}

export function createHandMotion() {
  const deadZone = .004;
  let anchor;
  let lastOpen = -Infinity;

  function reset() {
    anchor = undefined;
    lastOpen = -Infinity;
  }

  function move(hand, timestamp) {
    if (!hand) return null;
    if (hand.pose === 'pinch' || hand.pose === 'fist') {
      reset();
      return null;
    }
    if (timestamp - lastOpen > 150) anchor = undefined;
    if (hand.pose === 'open') lastOpen = timestamp;
    if (!anchor) {
      if (hand.pose === 'open') anchor = { x: hand.x, y: hand.y };
      return null;
    }

    const dx = hand.x - anchor.x;
    const dy = hand.y - anchor.y;
    if (Math.hypot(dx, dy) > .55) {
      anchor = { x: hand.x, y: hand.y };
      return null;
    }

    // Keep tiny changes buffered, so gradual movement still turns the scene.
    const step = (delta) => Math.sign(delta) * Math.max(0, Math.abs(delta) - deadZone);
    const x = step(dx);
    const y = step(dy);
    anchor.x += x;
    anchor.y += y;
    return x || y ? { x, y } : null;
  }

  return { move, reset };
}
