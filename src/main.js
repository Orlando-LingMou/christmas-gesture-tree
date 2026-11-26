import './style.css';
import { createScene } from './scene.js';

const byId = (id) => document.getElementById(id);
const stage = byId('stage');
const host = byId('scene');
const files = byId('files');
const upload = byId('upload');
const clear = byId('clear');
const thumbs = byId('thumbs');
const toggle = byId('toggle');
const fullscreen = byId('fullscreen');
const cameraButton = byId('camera');
const viewer = byId('viewer');
const viewerPhoto = byId('viewer-photo');
const handIndicator = byId('hand-indicator');
const nameInput = byId('name');
const generate = byId('generate');
const backToEditor = byId('back-to-editor');
const photoTarget = byId('photo-target');

let scene;
let photos = [];
let mode = 'tree';
let loadingPhotos = false;
let activePhoto = 0;
let gestureViewer = false;
let stopCamera;
let cameraRequest = 0;
let cameraState = 'off';
let pointer;
let presenting = false;
let selectedTarget;

function feedback(id, message = '') {
  const element = byId(id);
  element.textContent = message;
  element.hidden = !message;
}

try {
  scene = createScene(host);
} catch (error) {
  console.error(error);
  feedback('stage-error', '当前浏览器无法启动 3D 场景。试试开启硬件加速，或换到最新版 Chrome、Edge 或 Safari。');
  cameraButton.disabled = true;
  toggle.disabled = true;
  generate.disabled = true;
}

function setMode(next) {
  mode = next;
  stage.dataset.mode = mode;
  scene?.setMode(mode);
  if (mode === 'tree') displayTarget();
  const scattered = mode === 'scatter';
  byId('scene-state').textContent = scattered ? '粒子展开' : '树形';
  toggle.textContent = scattered ? '聚合成树' : '散开粒子';
  toggle.setAttribute('aria-pressed', String(scattered));
}

function showPhoto(index, fromGesture = false) {
  if (!photos.length || index === undefined) return;
  activePhoto = (index + photos.length) % photos.length;
  gestureViewer = fromGesture;
  displayTarget();
  viewerPhoto.src = photos[activePhoto].url;
  viewerPhoto.alt = `第 ${activePhoto + 1} 张所选照片`;
  byId('viewer-count').textContent = `${activePhoto + 1} / ${photos.length}`;
  if (!viewer.open) viewer.showModal();
}

function renderPhotos() {
  displayTarget();
  const thumbnails = photos.map((photo, index) => {
    const button = document.createElement('button');
    button.className = 'thumb';
    button.type = 'button';
    button.setAttribute('aria-label', `查看第 ${index + 1} 张照片`);
    const image = document.createElement('img');
    image.src = photo.url;
    image.alt = '';
    button.append(image);
    button.addEventListener('click', () => showPhoto(index));
    return button;
  });
  thumbs.replaceChildren(...thumbnails);
  thumbs.hidden = !photos.length;
  clear.hidden = !photos.length;
  upload.lastChild.textContent = photos.length ? ' 更换照片' : ' 选择照片';
  byId('count').textContent = `${photos.length} / 15`;
}

async function loadPhoto(file) {
  const url = URL.createObjectURL(file);
  const image = new Image();
  image.src = url;
  try {
    await image.decode();
    return { url, image, width: image.naturalWidth, height: image.naturalHeight };
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
}

async function loadPhotos(selected) {
  if (loadingPhotos) return;
  const chosen = [...selected];
  if (!chosen.length) return;
  if (chosen.length < 5 || chosen.length > 15) {
    feedback('photo-feedback', `选中了 ${chosen.length} 个文件，请一次选择 5–15 张照片。`);
    return;
  }
  loadingPhotos = true;
  upload.disabled = true;
  clear.disabled = true;
  feedback('photo-feedback', '正在读取照片…');
  const results = await Promise.allSettled(chosen.map(loadPhoto));
  const decoded = results.flatMap((item) => item.status === 'fulfilled' ? [item.value] : []);
  if (decoded.length === chosen.length) {
    try {
      scene?.setPhotos(decoded);
      photos.forEach((photo) => URL.revokeObjectURL(photo.url));
      photos = decoded;
      renderPhotos();
      feedback('photo-feedback', `已添加 ${photos.length} 张。张开手掌或点「散开粒子」查看。`);
    } catch (error) {
      decoded.forEach((photo) => URL.revokeObjectURL(photo.url));
      console.error(error);
      feedback('photo-feedback', '3D 场景无法加载这批照片，请试试分辨率较低的图片。');
    }
  } else {
    decoded.forEach((photo) => URL.revokeObjectURL(photo.url));
    feedback('photo-feedback', '有照片无法读取，请选择浏览器支持的图片，例如 JPG、PNG 或 WebP。');
  }
  upload.disabled = false;
  clear.disabled = false;
  loadingPhotos = false;
}

function setCameraState(next) {
  cameraState = next;
  cameraButton.lastChild.textContent = {
    off: ' 开启摄像头', loading: ' 取消开启', on: ' 关闭摄像头'
  }[next];
  handIndicator.hidden = next !== 'on';
  if (next !== 'on') displayTarget();
}

function displayTarget(target) {
  selectedTarget = target;
  photoTarget.hidden = !target;
  if (!target) return;
  const { x, y, screenWidth, screenHeight, roll } = target;
  photoTarget.style.width = `${screenWidth + 5}px`;
  photoTarget.style.height = `${screenHeight + 5}px`;
  photoTarget.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%) rotate(${-roll}rad)`;
}

function updateHand(hand, change) {
  if (change === 'fist') {
    if (viewer.open) viewer.close();
    setMode('tree');
  }
  if (change === 'open') {
    if (gestureViewer && viewer.open) viewer.close();
    setMode('scatter');
  }

  const canSelect = hand && mode === 'scatter' && !viewer.open;
  if (canSelect && hand.pose === 'open' && !pointer) scene.steer(hand.x, hand.y);
  if (!canSelect) {
    displayTarget();
  } else if (hand.pose !== 'pinch' || !selectedTarget) {
    displayTarget(scene.targetPhoto(selectedTarget?.index));
  }

  const labels = { open: '张开手掌', fist: '握拳', pinch: '捏合', neutral: '已识别手部' };
  const label = hand ? labels[hand.pose] : '等待手势';
  const hint = selectedTarget ? `${label} · 已选中第 ${selectedTarget.index + 1} 张` : label;
  if (handIndicator.textContent !== hint) handIndicator.textContent = hint;
  if (change === 'pinch' && canSelect) showPhoto(selectedTarget?.index, true);
}

function cameraError(error) {
  stopCamera = undefined;
  setCameraState('off');
  const messages = {
    NotAllowedError: '摄像头权限未开启。允许权限后重试，或使用手动控制。',
    NotFoundError: '没有找到摄像头，可以使用手动控制。',
    NotReadableError: '无法读取摄像头，请检查它是否正在被其他应用使用。'
  };
  feedback('camera-feedback', messages[error.name] ??
    (error.message.includes('摄像头') ? error.message : '手势模型加载或运行失败。请检查网络后重试，或使用手动控制。'));
  console.error(error);
}

async function toggleCamera() {
  const request = ++cameraRequest;
  if (cameraState !== 'off') {
    stopCamera?.();
    stopCamera = undefined;
    setCameraState('off');
    feedback('camera-feedback');
    return;
  }
  setCameraState('loading');
  feedback('camera-feedback', '正在启动摄像头并加载手势模型…');
  try {
    const { startCamera } = await import('./camera.js');
    if (request !== cameraRequest) return;
    stopCamera = startCamera({
      onReady: () => {
        handIndicator.textContent = '等待手势';
        setCameraState('on');
        feedback('camera-feedback');
      },
      onHand: updateHand,
      onError: cameraError
    });
  } catch (error) {
    if (request === cameraRequest) cameraError(error);
  }
}

function setImmersive(enabled) {
  stage.classList.toggle('immersive', enabled);
  fullscreen.setAttribute('aria-pressed', String(enabled));
  fullscreen.setAttribute('aria-label', enabled ? '退出沉浸模式' : '沉浸模式');
  fullscreen.title = fullscreen.getAttribute('aria-label');
}

function updateName() {
  const name = nameInput.value.trim();
  for (const id of ['editor-name', 'presentation-name']) {
    const label = byId(id);
    label.textContent = name;
    label.hidden = !name;
  }
}

function setPresentation(enabled) {
  presenting = enabled;
  setImmersive(false);
  document.body.classList.toggle('presentation', enabled);
  stage.classList.toggle('presentation-view', enabled);
  backToEditor.hidden = !enabled;
  scene?.setPresentation(enabled);
  displayTarget();
  if (enabled) {
    setMode('tree');
    generate.blur();
  } else {
    generate.focus({ preventScroll: true });
  }
}

nameInput.addEventListener('input', updateName);
generate.addEventListener('click', () => setPresentation(true));
backToEditor.addEventListener('click', () => setPresentation(false));

upload.addEventListener('click', () => files.click());
files.addEventListener('change', () => {
  void loadPhotos(files.files);
  files.value = '';
});
clear.addEventListener('click', () => {
  scene?.setPhotos([]);
  photos.forEach((photo) => URL.revokeObjectURL(photo.url));
  photos = [];
  renderPhotos();
  feedback('photo-feedback', '照片已清除。');
});

stage.addEventListener('dragover', (event) => {
  if (!event.dataTransfer.types.includes('Files')) return;
  event.preventDefault();
  stage.classList.add('drag-over');
});
stage.addEventListener('dragleave', (event) => {
  if (!stage.contains(event.relatedTarget)) stage.classList.remove('drag-over');
});
stage.addEventListener('drop', (event) => {
  event.preventDefault();
  stage.classList.remove('drag-over');
  void loadPhotos(event.dataTransfer.files);
});

host.addEventListener('pointerdown', (event) => {
  if (pointer || event.button !== 0) return;
  host.setPointerCapture(event.pointerId);
  pointer = { id: event.pointerId, x: event.clientX, y: event.clientY, distance: 0 };
});
host.addEventListener('pointermove', (event) => {
  if (pointer?.id !== event.pointerId) return;
  const dx = event.clientX - pointer.x;
  const dy = event.clientY - pointer.y;
  pointer.distance += Math.hypot(dx, dy);
  pointer.x = event.clientX;
  pointer.y = event.clientY;
  if (pointer.distance > 4) scene?.drag(dx, dy);
});
host.addEventListener('pointerup', (event) => {
  if (pointer?.id !== event.pointerId) return;
  if (pointer.distance <= 4) showPhoto(scene?.pick(event.clientX, event.clientY));
  pointer = undefined;
});
host.addEventListener('lostpointercapture', (event) => {
  if (pointer?.id === event.pointerId) pointer = undefined;
});

cameraButton.addEventListener('click', toggleCamera);
toggle.addEventListener('click', () => setMode(mode === 'tree' ? 'scatter' : 'tree'));
fullscreen.addEventListener('click', () => setImmersive(!stage.classList.contains('immersive')));
byId('close-viewer').addEventListener('click', () => viewer.close());
byId('previous').addEventListener('click', () => showPhoto(activePhoto - 1));
byId('next').addEventListener('click', () => showPhoto(activePhoto + 1));
viewer.addEventListener('close', () => {
  gestureViewer = false;
  viewerPhoto.removeAttribute('src');
});
viewer.addEventListener('click', (event) => {
  if (event.target === viewer) viewer.close();
});
document.addEventListener('keydown', (event) => {
  if (viewer.open) {
    if (event.key === 'ArrowLeft') showPhoto(activePhoto - 1);
    if (event.key === 'ArrowRight') showPhoto(activePhoto + 1);
    return;
  }
  if (event.defaultPrevented || event.target instanceof HTMLInputElement) return;
  if (event.key === 'Escape') {
    if (presenting) setPresentation(false);
    else setImmersive(false);
  }
  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
    if (!scene) return;
    event.preventDefault();
    scene.drag(event.key === 'ArrowLeft' ? -24 : 24, 0);
  }
});
window.addEventListener('pagehide', () => {
  cameraRequest++;
  stopCamera?.();
  stopCamera = undefined;
  setCameraState('off');
  feedback('camera-feedback');
});

setMode('tree');

updateName();
