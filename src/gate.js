import './style.css';

const AUTH_SALT = 'christmas-constellation:';
const EXPECTED_HASH = '44d6c24c532d5aea7d0481cb357851c88ce1b2bf815561214c8653f80f1496d9';
const SESSION_KEY = 'christmas-tree-auth-v1';

const SHA256_K = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
];

function sha256Fallback(bytes) {
  const bitLen = bytes.length * 8;
  const paddedLen = Math.ceil((bytes.length + 9) / 64) * 64;
  const padded = new Uint8Array(paddedLen);
  padded.set(bytes);
  padded[bytes.length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(paddedLen - 8, Math.floor(bitLen / 0x100000000), false);
  view.setUint32(paddedLen - 4, bitLen >>> 0, false);

  let h0 = 0x6a09e667;
  let h1 = 0xbb67ae85;
  let h2 = 0x3c6ef372;
  let h3 = 0xa54ff53a;
  let h4 = 0x510e527f;
  let h5 = 0x9b05688c;
  let h6 = 0x1f83d9ab;
  let h7 = 0x5be0cd19;

  const w = new Uint32Array(64);
  const rotr = (x, n) => (x >>> n) | (x << (32 - n));

  for (let offset = 0; offset < paddedLen; offset += 64) {
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(offset + i * 4, false);
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }

    let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + SHA256_K[i] + w[i]) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;
      h = g; g = f; f = e; e = (d + temp1) >>> 0;
      d = c; c = b; b = a; a = (temp1 + temp2) >>> 0;
    }

    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
    h5 = (h5 + f) >>> 0;
    h6 = (h6 + g) >>> 0;
    h7 = (h7 + h) >>> 0;
  }

  return [h0, h1, h2, h3, h4, h5, h6, h7]
    .map((n) => n.toString(16).padStart(8, '0'))
    .join('');
}

async function sha256Hex(text) {
  const bytes = new TextEncoder().encode(text);
  if (globalThis.crypto?.subtle) {
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
  }
  return sha256Fallback(bytes);
}

function readSessionToken() {
  try {
    return sessionStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}

function writeSessionToken(token) {
  try {
    sessionStorage.setItem(SESSION_KEY, token);
  } catch {
    // Ignore storage restriction in private browsing modes.
  }
}

const gate = document.getElementById('auth-gate');
const form = document.getElementById('gate-form');
const input = document.getElementById('gate-password');
const toggleVisibility = document.getElementById('gate-toggle');
const submitButton = document.getElementById('gate-submit');
const errorEl = document.getElementById('gate-error');
const card = gate?.querySelector('.gate-card');
const template = document.getElementById('app-template');

let unlocked = false;

async function unlockApp({ instant = false } = {}) {
  if (unlocked) return;
  unlocked = true;

  if (template) {
    document.body.insertBefore(template.content.cloneNode(true), gate);
    template.remove();
  }

  if (instant && gate) {
    gate.remove();
  }

  await import('./main.js');

  if (!instant && gate) {
    gate.classList.add('unlocking');
    const removeGate = () => gate.remove();
    gate.addEventListener('transitionend', removeGate, { once: true });
    setTimeout(removeGate, 420);
  }
}

function showError(message) {
  if (!errorEl) return;
  errorEl.textContent = message;
  errorEl.hidden = false;
  if (card) {
    card.classList.remove('shake');
    void card.offsetWidth;
    card.classList.add('shake');
  }
}

if (readSessionToken() === EXPECTED_HASH) {
  void unlockApp({ instant: true });
} else if (gate) {
  gate.hidden = false;
  requestAnimationFrame(() => input?.focus());

  toggleVisibility?.addEventListener('click', () => {
    const revealing = input.type === 'password';
    input.type = revealing ? 'text' : 'password';
    toggleVisibility.setAttribute('aria-pressed', String(revealing));
    toggleVisibility.setAttribute('aria-label', revealing ? '隐藏密码' : '显示密码');
    toggleVisibility.textContent = revealing ? '隐藏' : '显示';
    input.focus();
  });

  input?.addEventListener('input', () => {
    if (errorEl && !errorEl.hidden) errorEl.hidden = true;
  });

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (unlocked) return;
    const value = input.value.trim();
    if (!value) {
      showError('请输入访问密码。');
      input.focus();
      return;
    }

    submitButton.disabled = true;
    try {
      const digest = await sha256Hex(`${AUTH_SALT}${value}`);
      if (digest === EXPECTED_HASH) {
        writeSessionToken(EXPECTED_HASH);
        if (errorEl) errorEl.hidden = true;
        await unlockApp();
      } else {
        showError('密码不正确，请重新输入。');
        input.select();
        input.focus();
        submitButton.disabled = false;
      }
    } catch (error) {
      console.error(error);
      showError('验证失败，请刷新页面后重试。');
      submitButton.disabled = false;
    }
  });
}
