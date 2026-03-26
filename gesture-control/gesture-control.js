/**
 * Controle por Gestos — BIPES/dblocks
 * Usa MediaPipe GestureRecognizer para detectar gestos pela câmera
 * e enviar comandos HTTP para um ESP32 via WiFi.
 */

const GESTURES = [
  { key: 'Closed_Fist', label: 'Punho Fechado', icon: '✊' },
  { key: 'Open_Palm',   label: 'Mão Aberta',    icon: '🖐' },
  { key: 'Pointing_Up', label: 'Apontar',        icon: '☝' },
  { key: 'Thumb_Up',    label: 'Polegar ↑',      icon: '👍' },
  { key: 'Thumb_Down',  label: 'Polegar ↓',      icon: '👎' },
  { key: 'Victory',     label: 'Vitória ✌',      icon: '✌' },
  { key: 'ILoveYou',   label: 'Eu te amo',       icon: '🤟' },
];

const STORAGE_KEY_IP       = 'gesture_esp32_ip';
const STORAGE_KEY_MAPPINGS = 'gesture_mappings';
const DEBOUNCE_MS = 700;
const LOG_MAX = 60;
const CONFIDENCE_THRESHOLD = 0.75;

let recognizer = null;
let cameraStream = null;
let animFrameId = null;
let isRunning = false;

let lastGesture = '';
let lastSentTime = 0;

// ─── DOM refs ────────────────────────────────────────────────
const video         = document.getElementById('videoElement');
const ipInput       = document.getElementById('ipInput');
const btnSaveIp     = document.getElementById('btnSaveIp');
const btnStart      = document.getElementById('btnStart');
const btnStop       = document.getElementById('btnStop');
const gestureNameEl = document.getElementById('gestureName');
const gestureConfEl = document.getElementById('gestureConf');
const statusDot     = document.getElementById('statusDot');
const logContainer  = document.getElementById('logContainer');
const loadingOverlay= document.getElementById('loadingOverlay');
const loadingMsg    = document.getElementById('loadingMsg');

// ─── Init ─────────────────────────────────────────────────────
async function init() {
  loadSavedState();
  renderMappingTable();
  btnStart.addEventListener('click', startCamera);
  btnStop.addEventListener('click', stopCamera);
  btnSaveIp.addEventListener('click', saveIp);
}

function loadSavedState() {
  const ip = localStorage.getItem(STORAGE_KEY_IP) || '';
  ipInput.value = ip;
}

function saveIp() {
  localStorage.setItem(STORAGE_KEY_IP, ipInput.value.trim());
  btnSaveIp.textContent = 'Salvo!';
  setTimeout(() => { btnSaveIp.textContent = 'Salvar'; }, 1200);
}

function getMappings() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY_MAPPINGS) || '{}');
  } catch { return {}; }
}

function setMapping(key, value) {
  const m = getMappings();
  m[key] = value;
  localStorage.setItem(STORAGE_KEY_MAPPINGS, JSON.stringify(m));
}

// ─── Table ────────────────────────────────────────────────────
function renderMappingTable() {
  const mappings = getMappings();
  const tbody = document.getElementById('mappingBody');
  tbody.innerHTML = '';

  GESTURES.forEach(g => {
    const tr = document.createElement('tr');
    tr.id = `row_${g.key}`;

    const tdIcon = document.createElement('td');
    tdIcon.innerHTML = `<span class="gesture-icon">${g.icon}</span>`;

    const tdLabel = document.createElement('td');
    tdLabel.textContent = g.label;

    const tdInput = document.createElement('td');
    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = '/endpoint';
    input.value = mappings[g.key] || '';
    input.dataset.key = g.key;
    input.addEventListener('change', (e) => {
      setMapping(g.key, e.target.value.trim());
    });
    tdInput.appendChild(input);

    const tdBadge = document.createElement('td');
    tdBadge.style.width = '50px';
    const badge = document.createElement('span');
    badge.className = 'send-badge';
    badge.id = `badge_${g.key}`;
    badge.textContent = 'enviado';
    tdBadge.appendChild(badge);

    tr.append(tdIcon, tdLabel, tdInput, tdBadge);
    tbody.appendChild(tr);
  });
}

// ─── Camera & MediaPipe ───────────────────────────────────────
const MEDIAPIPE_CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/vision_bundle.mjs';

let _mpModule = null;
async function loadMediaPipe() {
  if (_mpModule) return _mpModule;
  _mpModule = await import(MEDIAPIPE_CDN);
  return _mpModule;
}

async function startCamera() {
  if (isRunning) return;

  showLoading('Carregando MediaPipe...');
  btnStart.disabled = true;
  btnStop.disabled  = false;

  try {
    const { GestureRecognizer, FilesetResolver } = await loadMediaPipe();

    showLoading('Inicializando reconhecedor...');
    const vision = await FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm'
    );

    recognizer = await GestureRecognizer.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task',
        delegate: 'GPU',
      },
      runningMode: 'VIDEO',
      numHands: 1,
    });

    showLoading('Acessando câmera...');
    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: { width: 640, height: 480, facingMode: 'user' },
    });
    video.srcObject = cameraStream;
    await new Promise(res => { video.onloadeddata = res; });
    video.play();

    isRunning = true;
    statusDot.classList.add('active');
    hideLoading();
    detectLoop();

  } catch (err) {
    hideLoading();
    btnStart.disabled = false;
    btnStop.disabled  = true;
    logEntry(`Erro ao iniciar: ${err.message}`, 'err');
    console.error(err);
  }
}

function detectLoop() {
  if (!isRunning || !recognizer) return;

  if (video.readyState >= 2) {
    const nowMs = performance.now();
    const results = recognizer.recognizeForVideo(video, nowMs);

    if (results.gestures && results.gestures.length > 0) {
      const top = results.gestures[0][0];
      const name = top.categoryName;
      const conf = top.score;

      updateGestureDisplay(name, conf);

      if (name !== 'None' && conf >= CONFIDENCE_THRESHOLD) {
        maybeDispatch(name, conf);
      }
    } else {
      updateGestureDisplay('None', 0);
    }
  }

  animFrameId = requestAnimationFrame(detectLoop);
}

function updateGestureDisplay(name, conf) {
  const g = GESTURES.find(x => x.key === name);
  if (name === 'None' || !g) {
    gestureNameEl.textContent = '—';
    gestureNameEl.className = 'gesture-name none';
    gestureConfEl.textContent = '';
  } else {
    gestureNameEl.textContent = `${g.icon} ${g.label}`;
    gestureNameEl.className = 'gesture-name';
    gestureConfEl.textContent = `Confiança: ${Math.round(conf * 100)}%`;
  }

  // Highlight active row
  document.querySelectorAll('.gesture-table tr').forEach(r => r.classList.remove('active-gesture'));
  if (g) {
    const row = document.getElementById(`row_${name}`);
    if (row) row.classList.add('active-gesture');
  }
}

function maybeDispatch(gesture, conf) {
  const now = Date.now();
  if (gesture === lastGesture && now - lastSentTime < DEBOUNCE_MS) return;
  lastGesture = gesture;
  lastSentTime = now;
  sendCommand(gesture, conf);
}

function sendCommand(gesture, conf) {
  const ip = ipInput.value.trim();
  const mappings = getMappings();
  const endpoint = mappings[gesture] || '';

  if (!endpoint) {
    logEntry(`${gesture} → sem endpoint configurado`, 'skip');
    return;
  }
  if (!ip) {
    logEntry('IP do ESP32 não configurado', 'err');
    return;
  }

  const url = `http://${ip}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;

  fetch(url, { method: 'GET', mode: 'no-cors', cache: 'no-store' })
    .then(() => {
      logEntry(`GET ${url}`, 'ok');
      flashBadge(gesture);
    })
    .catch(err => {
      logEntry(`GET ${url} → ${err.message}`, 'err');
    });
}

function flashBadge(gesture) {
  const badge = document.getElementById(`badge_${gesture}`);
  if (!badge) return;
  badge.classList.remove('show');
  void badge.offsetWidth; // reflow to restart animation
  badge.classList.add('show');
}

// Exposed globally so that code.js can call it when switching tabs
window.stopCamera = function stopCamera() {
  isRunning = false;
  statusDot.classList.remove('active');

  if (animFrameId) {
    cancelAnimationFrame(animFrameId);
    animFrameId = null;
  }
  if (cameraStream) {
    cameraStream.getTracks().forEach(t => t.stop());
    cameraStream = null;
    video.srcObject = null;
  }
  if (recognizer) {
    recognizer.close();
    recognizer = null;
  }

  btnStart.disabled = false;
  btnStop.disabled  = true;
  updateGestureDisplay('None', 0);
  logEntry('Câmera desligada.', 'skip');
};

// ─── Helpers ──────────────────────────────────────────────────
function showLoading(msg) {
  loadingMsg.textContent = msg;
  loadingOverlay.classList.remove('hidden');
}

function hideLoading() {
  loadingOverlay.classList.add('hidden');
}

let logCount = 0;
function logEntry(msg, type) {
  const now = new Date();
  const time = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`;

  const el = document.createElement('div');
  el.className = 'log-entry';
  el.innerHTML = `<span class="log-time">${time}</span><span class="log-${type}">${escapeHtml(msg)}</span>`;
  logContainer.prepend(el);

  logCount++;
  if (logCount > LOG_MAX) {
    logContainer.lastElementChild?.remove();
    logCount--;
  }
}

function escapeHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ─── Boot ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', init);
