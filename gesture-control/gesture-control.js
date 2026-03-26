/**
 * Controle por Gestos — BIPES/dblocks
 * Detecta gestos via MediaPipe e envia comandos HTTP ao ESP32.
 * A câmera permanece ativa ao trocar de aba.
 */

const GESTURES = [
  { key: 'Closed_Fist', label: 'Punho Fechado', emoji: '✊' },
  { key: 'Open_Palm',   label: 'Mão Aberta',    emoji: '🖐' },
  { key: 'Pointing_Up', label: 'Apontar',        emoji: '☝' },
  { key: 'Thumb_Up',    label: 'Polegar ↑',      emoji: '👍' },
  { key: 'Thumb_Down',  label: 'Polegar ↓',      emoji: '👎' },
  { key: 'Victory',     label: 'Vitória',         emoji: '✌' },
  { key: 'ILoveYou',   label: 'Eu te amo',       emoji: '🤟' },
];

const KEY_IP       = 'gesture_esp32_ip';
const KEY_MAPPINGS = 'gesture_mappings';
const DEBOUNCE_MS  = 700;
const CONFIDENCE   = 0.75;
const MEDIAPIPE_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/vision_bundle.mjs';

let recognizer  = null;
let stream      = null;
let rafId       = null;
let isRunning   = false;
let lastGesture = '';
let lastSentAt  = 0;

// ── DOM ──────────────────────────────────────────────────────
const ipInput     = document.getElementById('ipInput');
const btnSave     = document.getElementById('btnSave');
const btnStart    = document.getElementById('btnStart');
const btnStop     = document.getElementById('btnStop');
const statusChip  = document.getElementById('statusChip');
const statusText  = document.getElementById('statusText');
const videoEl     = document.getElementById('videoEl');
const placeholder = document.getElementById('placeholder');
const liveEmoji   = document.getElementById('liveEmoji');
const liveName    = document.getElementById('liveName');
const liveConf    = document.getElementById('liveConf');
const sendFlash   = document.getElementById('sendFlash');
const cardsGrid   = document.getElementById('cardsGrid');
const overlay     = document.getElementById('overlay');
const overlayMsg  = document.getElementById('overlayMsg');

// ── Init ─────────────────────────────────────────────────────
function init() {
  ipInput.value = localStorage.getItem(KEY_IP) || '';
  updateStatus();
  buildCards();

  btnSave.addEventListener('click', saveIp);
  btnStart.addEventListener('click', startCamera);
  btnStop.addEventListener('click', stopCamera);
  ipInput.addEventListener('change', saveIp);
}

function saveIp() {
  localStorage.setItem(KEY_IP, ipInput.value.trim());
  updateStatus();
  btnSave.textContent = '✓ Salvo';
  setTimeout(() => { btnSave.textContent = 'Salvar'; }, 1200);
}

function updateStatus() {
  const ip = ipInput.value.trim();
  statusChip.className = 'status-chip';
  if (!ip) {
    statusText.textContent = 'IP não configurado';
    return;
  }
  statusText.textContent = ip;
  statusChip.classList.add('warn');
}

function setStatus(state, msg) {
  statusChip.className = 'status-chip ' + (state || '');
  statusText.textContent = msg;
}

// ── Cards ─────────────────────────────────────────────────────
function getMappings() {
  try { return JSON.parse(localStorage.getItem(KEY_MAPPINGS) || '{}'); }
  catch { return {}; }
}

function setMapping(key, val) {
  const m = getMappings();
  m[key] = val;
  localStorage.setItem(KEY_MAPPINGS, JSON.stringify(m));
}

function buildCards() {
  const mappings = getMappings();
  cardsGrid.innerHTML = '';
  GESTURES.forEach(g => {
    const card = document.createElement('div');
    card.className = 'g-card' + (mappings[g.key] ? '' : ' empty-hint');
    card.id = 'card_' + g.key;

    const badge = document.createElement('span');
    badge.className = 'g-card-badge';
    badge.id = 'badge_' + g.key;
    badge.textContent = '✓ enviado';

    const emoji = document.createElement('div');
    emoji.className = 'g-card-emoji';
    emoji.textContent = g.emoji;

    const name = document.createElement('div');
    name.className = 'g-card-name';
    name.textContent = g.label;

    const wrap = document.createElement('div');
    wrap.className = 'g-card-input-wrap';

    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = '/comando';
    input.value = mappings[g.key] || '';
    input.title = 'Endpoint HTTP — ex: /led/on';
    input.addEventListener('change', e => {
      setMapping(g.key, e.target.value.trim());
      card.classList.toggle('empty-hint', !e.target.value.trim());
    });

    wrap.appendChild(input);
    card.append(badge, emoji, name, wrap);
    cardsGrid.appendChild(card);
  });
}

// ── Camera & MediaPipe ────────────────────────────────────────
let _mp = null;
async function loadMP() {
  if (_mp) return _mp;
  _mp = await import(MEDIAPIPE_URL);
  return _mp;
}

async function startCamera() {
  if (isRunning) return;
  btnStart.disabled = true;

  try {
    showOverlay('Carregando MediaPipe...');
    const { GestureRecognizer, FilesetResolver } = await loadMP();

    showOverlay('Inicializando reconhecedor...');
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

    showOverlay('Acessando câmera...');
    stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 640, height: 480, facingMode: 'user' },
    });
    videoEl.srcObject = stream;
    await new Promise(r => { videoEl.onloadeddata = r; });
    videoEl.play();

    placeholder.style.display = 'none';
    videoEl.style.display     = 'block';
    btnStop.disabled = false;
    isRunning = true;

    hideOverlay();
    detectLoop();

    const ip = ipInput.value.trim();
    if (ip) setStatus('ok', ip + ' — câmera ativa');

  } catch (err) {
    hideOverlay();
    btnStart.disabled = false;
    setStatus('err', 'Erro: ' + err.message);
    console.error(err);
  }
}

// Exposta globalmente — pode ser chamada externamente se necessário,
// mas NÃO é chamada ao trocar de aba (câmera fica ativa em background).
window.stopCamera = function stopCamera() {
  isRunning = false;
  if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
  if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
  if (recognizer) { recognizer.close(); recognizer = null; }

  videoEl.srcObject = null;
  videoEl.style.display     = 'none';
  placeholder.style.display = 'flex';
  btnStart.disabled = false;
  btnStop.disabled  = true;

  updateGestureUI('None', 0);
  updateStatus();
};

function detectLoop() {
  if (!isRunning || !recognizer) return;

  if (videoEl.readyState >= 2) {
    const results = recognizer.recognizeForVideo(videoEl, performance.now());
    if (results.gestures?.length) {
      const top = results.gestures[0][0];
      updateGestureUI(top.categoryName, top.score);
      if (top.categoryName !== 'None' && top.score >= CONFIDENCE)
        maybeDispatch(top.categoryName);
    } else {
      updateGestureUI('None', 0);
    }
  }

  rafId = requestAnimationFrame(detectLoop);
}

// ── Gesture UI ────────────────────────────────────────────────
function updateGestureUI(key, conf) {
  const g = GESTURES.find(x => x.key === key);

  // Live panel
  if (!g) {
    liveEmoji.textContent = '—';
    liveName.textContent  = 'Aguardando...';
    liveName.className    = 'live-name none';
    liveConf.textContent  = '';
  } else {
    liveEmoji.textContent = g.emoji;
    liveName.textContent  = g.label;
    liveName.className    = 'live-name';
    liveConf.textContent  = 'Confiança: ' + Math.round(conf * 100) + '%';
  }

  // Cards highlight
  document.querySelectorAll('.g-card').forEach(c => c.classList.remove('active'));
  if (g) document.getElementById('card_' + key)?.classList.add('active');
}

// ── HTTP dispatch ─────────────────────────────────────────────
function maybeDispatch(gesture) {
  const now = Date.now();
  if (gesture === lastGesture && now - lastSentAt < DEBOUNCE_MS) return;
  lastGesture = gesture;
  lastSentAt  = now;
  sendCommand(gesture);
}

function sendCommand(gesture) {
  const ip      = ipInput.value.trim();
  const mapping = getMappings()[gesture] || '';

  if (!mapping) return;
  if (!ip) { setStatus('err', 'Configure o IP do ESP32'); return; }

  const endpoint = mapping.startsWith('/') ? mapping : '/' + mapping;
  const url = 'http://' + ip + endpoint;

  fetch(url, { method: 'GET', mode: 'no-cors', cache: 'no-store' })
    .then(() => {
      setStatus('ok', ip + ' — último: ' + endpoint);
      flashCard(gesture);
    })
    .catch(err => {
      setStatus('err', 'Sem resposta do ESP32');
    });
}

function flashCard(key) {
  const badge = document.getElementById('badge_' + key);
  if (!badge) return;
  badge.classList.remove('show');
  void badge.offsetWidth;
  badge.classList.add('show');

  sendFlash.textContent = '↗ Comando enviado!';
  sendFlash.classList.remove('show');
  void sendFlash.offsetWidth;
  sendFlash.classList.add('show');
}

// ── Overlay ───────────────────────────────────────────────────
function showOverlay(msg) { overlayMsg.textContent = msg; overlay.classList.remove('hidden'); }
function hideOverlay()    { overlay.classList.add('hidden'); }

// ── Boot ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', init);
