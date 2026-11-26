const fingertips = [8, 12, 16, 20];
const knuckles = [5, 9, 13, 17];

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y, (a.z ?? 0) - (b.z ?? 0));
}

export function readHand(landmarks) {
  if (landmarks?.length !== 21) return null;
  const wrist = landmarks[0];
  const palm = Math.max(distance(wrist, landmarks[9]), .018);
  const extended = fingertips.filter((tip, index) =>
    distance(wrist, landmarks[tip]) > distance(wrist, landmarks[knuckles[index]]) + palm * .29
  ).length;
  const pinch = distance(landmarks[4], landmarks[8]) / palm;
  let pose = 'neutral';
  if (pinch < .32 && extended >= 2) pose = 'pinch';
  else if (extended >= 3) pose = 'open';
  else if (extended === 0) pose = 'fist';

  const center = landmarks[9];
  return {
    pose,
    x: Math.max(-1, Math.min(1, (.5 - center.x) * 2)),
    y: Math.max(-1, Math.min(1, (.5 - center.y) * 2))
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
    if (frames >= 3 && stable !== candidate) {
      stable = candidate;
      return stable;
    }
    return null;
  };
}
