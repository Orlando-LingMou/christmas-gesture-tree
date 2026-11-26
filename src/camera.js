import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import simdLoader from '../node_modules/@mediapipe/tasks-vision/wasm/vision_wasm_internal.js?url';
import simdBinary from '../node_modules/@mediapipe/tasks-vision/wasm/vision_wasm_internal.wasm?url';
import basicLoader from '../node_modules/@mediapipe/tasks-vision/wasm/vision_wasm_nosimd_internal.js?url';
import basicBinary from '../node_modules/@mediapipe/tasks-vision/wasm/vision_wasm_nosimd_internal.wasm?url';
import { readHand, stabilizePose } from './gestures.js';

const model = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

async function createTracker() {
  const simd = await FilesetResolver.isSimdSupported();
  const files = {
    wasmLoaderPath: simd ? simdLoader : basicLoader,
    wasmBinaryPath: simd ? simdBinary : basicBinary
  };
  return HandLandmarker.createFromOptions(files, {
    baseOptions: { modelAssetPath: model },
    runningMode: 'VIDEO',
    numHands: 1,
    minHandDetectionConfidence: .52,
    minHandPresenceConfidence: .5,
    minTrackingConfidence: .53
  });
}

export function startCamera({ onReady, onHand, onError }) {
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  const usesVideoFrames = typeof video.requestVideoFrameCallback === 'function';
  const scheduleFrame = usesVideoFrames ? video.requestVideoFrameCallback.bind(video) : requestAnimationFrame;
  const cancelFrame = usesVideoFrames ? video.cancelVideoFrameCallback.bind(video) : cancelAnimationFrame;
  let stream;
  let tracker;
  let cancelled = false;
  let frameId;
  let lastFrame = -1;
  let lastScan = -Infinity;
  let wasPinching = false;
  const stabilize = stabilizePose();

  function stop() {
    if (cancelled) return;
    cancelled = true;
    cancelFrame(frameId);
    stream?.getTracks().forEach((track) => track.stop());
    video.srcObject = null;
    tracker?.close();
  }

  function fail(error) {
    if (cancelled) return;
    stop();
    onError(error);
  }

  function scan(now) {
    if (cancelled) return;
    const freshFrame = usesVideoFrames || (video.currentTime !== lastFrame && now - lastScan >= 24);
    if (video.readyState >= 2 && freshFrame) {
      lastScan = now;
      lastFrame = video.currentTime;
      try {
        const hand = readHand(tracker.detectForVideo(video, now).landmarks[0], wasPinching);
        wasPinching = hand?.pose === 'pinch';
        onHand(hand, stabilize(hand?.pose ?? 'neutral', hand?.decisive), now);
      } catch (error) {
        fail(error);
        return;
      }
    }
    frameId = scheduleFrame(scan);
  }

  async function initialize() {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('请在 HTTPS 网页或 localhost 中开启摄像头。');
      }
      stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: 'user', width: { ideal: 480 }, height: { ideal: 360 }, frameRate: { ideal: 30 } }
      });
      if (cancelled) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      for (const track of stream.getVideoTracks()) {
        track.addEventListener('ended', () => fail(new Error('摄像头已断开，请重新开启。')), { once: true });
      }
      video.srcObject = stream;
      await video.play();
      if (cancelled) return;
      tracker = await createTracker();
      if (cancelled) {
        tracker.close();
        return;
      }
      onReady();
      frameId = scheduleFrame(scan);
    } catch (error) {
      fail(error);
    }
  }

  void initialize();
  return stop;
}
