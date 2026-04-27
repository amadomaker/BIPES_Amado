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

// Conexões padrão da mão no MediaPipe (21 landmarks)
const HAND_CONNECTIONS = [
  [0,1],[1,2],[2,3],[3,4],
  [0,5],[5,6],[6,7],[7,8],
  [5,9],[9,10],[10,11],[11,12],
  [9,13],[13,14],[14,15],[15,16],
  [13,17],[0,17],[17,18],[18,19],[19,20],
];

const KEY_IP        = 'gesture_esp32_ip';
const KEY_MAPPINGS  = 'gesture_mappings';
const DEBOUNCE_MS   = 700;
const CONFIDENCE    = 0.75;
const MEDIAPIPE_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/vision_bundle.mjs';

let recognizer           = null;
let stream               = null;
let rafId                = null;
let isRunning            = false;
let lastGesture          = '';
let lastSentAt           = 0;
let GestureRecognizerClass = null;

// ── DOM ──────────────────────────────────────────────────────
const ipInput       = document.getElementById('ipInput');
const btnSave       = document.getElementById('btnSave');
const btnStart      = document.getElementById('btnStart');
const btnStop       = document.getElementById('btnStop');
const statusChip    = document.getElementById('statusChip');
const statusText    = document.getElementById('statusText');
const videoEl       = document.getElementById('videoEl');
const videoWrapper  = document.getElementById('videoWrapper');
const placeholder   = document.getElementById('placeholder');
const liveEmoji     = document.getElementById('liveEmoji');
const liveName      = document.getElementById('liveName');
const liveConf      = document.getElementById('liveConf');
const sendFlash     = document.getElementById('sendFlash');
const cardsGrid     = document.getElementById('cardsGrid');
const overlay       = document.getElementById('overlay');
const overlayMsg    = document.getElementById('overlayMsg');
const canvasEl      = document.getElementById('canvasEl');
const ctx           = canvasEl.getContext('2d');
const hudIpEl       = document.getElementById('hudIp');
const hudCmdEl      = document.getElementById('hudCmd');
const hudSysEl      = document.getElementById('hudSys');
const hudMappedEl   = document.getElementById('hudMapped');
const gcWrap        = document.getElementById('gcWrap');
const confBar       = document.getElementById('confBar');
const recIndicator  = document.getElementById('recIndicator');
const modalBackdrop = document.getElementById('modalBackdrop');
const btnMappings   = document.getElementById('btnMappings');
const btnCloseModal = document.getElementById('btnCloseModal');

// ── Init ─────────────────────────────────────────────────────
function init() {
  ipInput.value = localStorage.getItem(KEY_IP) || '';
  updateStatus();
  buildCards();

  btnSave.addEventListener('click', saveIp);
  btnStart.addEventListener('click', startCamera);
  btnStop.addEventListener('click', window.stopCamera);
  ipInput.addEventListener('change', saveIp);

  btnMappings.addEventListener('click', openModal);
  btnCloseModal.addEventListener('click', closeModal);
  modalBackdrop.addEventListener('click', e => {
    if (e.target === modalBackdrop) closeModal();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeModal();
  });

  // Atualiza canvas quando a janela for redimensionada
  new ResizeObserver(syncCanvasSize).observe(videoWrapper);
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
  hudIpEl.textContent  = ip || '—';

  if (!ip) {
    statusText.textContent = 'IP não configurado';
    return;
  }
  statusText.textContent = ip;
  statusChip.classList.add('warn');
}

function setStatus(state, msg) {
  statusChip.className   = 'status-chip ' + (state || '');
  statusText.textContent = msg;

  const ip = ipInput.value.trim();
  hudIpEl.textContent = ip || '—';

  if (state === 'ok') {
    const m = msg.match(/último:\s*(.+)/);
    if (m) hudCmdEl.textContent = '▸ ' + m[1];
  } else if (state === 'err') {
    hudCmdEl.textContent = '⚠ sem resposta';
  }
}

// ── Modal ─────────────────────────────────────────────────────
function openModal()  { modalBackdrop.classList.remove('hidden'); }
function closeModal() { modalBackdrop.classList.add('hidden'); }

// ── Cards ─────────────────────────────────────────────────────
function getMappings() {
  try { return JSON.parse(localStorage.getItem(KEY_MAPPINGS) || '{}'); }
  catch { return {}; }
}

function setMapping(key, val) {
  const m = getMappings();
  m[key] = val;
  localStorage.setItem(KEY_MAPPINGS, JSON.stringify(m));
  updateMappedCount();
}

function updateMappedCount() {
  const count = Object.values(getMappings()).filter(v => v).length;
  hudMappedEl.textContent = count + '/' + GESTURES.length + ' gestos mapeados';
}

function buildCards() {
  const mappings = getMappings();
  cardsGrid.innerHTML = '';
  updateMappedCount();
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

// ── Canvas: sincroniza com o tamanho real do wrapper ──────────
function syncCanvasSize() {
  canvasEl.width  = videoWrapper.clientWidth;
  canvasEl.height = videoWrapper.clientHeight;
}

// Calcula o rect real do vídeo dentro do wrapper (object-fit: cover)
function getCoverRect() {
  const cw = canvasEl.width;
  const ch = canvasEl.height;
  const vw = videoEl.videoWidth  || 640;
  const vh = videoEl.videoHeight || 480;
  const scale = Math.min(cw / vw, ch / vh);
  const rw = vw * scale;
  const rh = vh * scale;
  return { ox: (cw - rw) / 2, oy: (ch - rh) / 2, rw, rh };
}

// ── Camera & MediaPipe ────────────────────────────────────────
let _mp = null;
async function loadMP() {
  if (_mp) return _mp;
  _mp = await import(MEDIAPIPE_URL);
  GestureRecognizerClass = _mp.GestureRecognizer;
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

    placeholder.style.display  = 'none';
    videoWrapper.style.display = 'block';
    syncCanvasSize();

    btnStop.disabled = false;
    isRunning = true;

    hudSysEl.textContent = 'SISTEMA ATIVO';
    hudSysEl.classList.add('active');
    hudCmdEl.textContent = '';
    recIndicator.classList.remove('hidden');

    hideOverlay();
    detectLoop();

    const ip = ipInput.value.trim();
    hudIpEl.textContent = ip || '—';
    if (ip) setStatus('ok', ip + ' — câmera ativa');

  } catch (err) {
    hideOverlay();
    btnStart.disabled = false;
    setStatus('err', 'Erro: ' + err.message);
    console.error(err);
  }
}

window.stopCamera = function stopCamera() {
  isRunning = false;
  if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
  if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
  if (recognizer) { recognizer.close(); recognizer = null; }

  videoEl.srcObject = null;
  ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
  videoWrapper.style.display = 'none';
  placeholder.style.display  = 'flex';
  btnStart.disabled = false;
  btnStop.disabled  = true;

  hudSysEl.textContent = 'SISTEMA INATIVO';
  hudSysEl.classList.remove('active');
  hudCmdEl.textContent = '';
  recIndicator.classList.add('hidden');

  updateGestureUI('None', 0);
  updateStatus();
};

function detectLoop() {
  if (!isRunning || !recognizer) return;

  if (videoEl.readyState >= 2) {
    const results = recognizer.recognizeForVideo(videoEl, performance.now());
    ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
    try { drawHandLandmarks(results); } catch (_) { /* erros de desenho não param o loop */ }

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

// Desenho manual para alinhar com object-fit: contain
function drawHandLandmarks(results) {
  if (!results.landmarks?.length) return;

  const { ox, oy, rw, rh } = getCoverRect();

  const toCanvas = lm => ({
    x: ox + lm.x * rw,
    y: oy + lm.y * rh,
  });

  for (const landmarks of results.landmarks) {
    const pts = landmarks.map(toCanvas);

    // Conexões
    ctx.strokeStyle = 'rgba(0,184,148,0.85)';
    ctx.lineWidth   = 2;
    ctx.lineCap     = 'round';
    for (const [s, e] of HAND_CONNECTIONS) {
      ctx.beginPath();
      ctx.moveTo(pts[s].x, pts[s].y);
      ctx.lineTo(pts[e].x, pts[e].y);
      ctx.stroke();
    }

    // Pontos
    for (let i = 0; i < pts.length; i++) {
      const r = [4, 8, 12, 16, 20].includes(i) ? 5 : 3;
      ctx.beginPath();
      ctx.arc(pts[i].x, pts[i].y, r, 0, Math.PI * 2);
      ctx.fillStyle   = '#00cec9';
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth   = 1;
      ctx.stroke();
    }
  }
}

// ── Gesture UI ────────────────────────────────────────────────
function updateGestureUI(key, conf) {
  const g = GESTURES.find(x => x.key === key);

  if (!g) {
    liveEmoji.textContent = '—';
    liveName.textContent  = 'AGUARDANDO';
    liveName.className    = 'live-name none';
    liveConf.textContent  = '';
    confBar.style.width   = '0%';
    gcWrap.classList.remove('active');
  } else {
    liveEmoji.textContent = g.emoji;
    liveName.textContent  = g.label.toUpperCase();
    liveName.className    = 'live-name';
    liveConf.textContent  = 'CONFIANÇA: ' + Math.round(conf * 100) + '%';
    confBar.style.width   = Math.round(conf * 100) + '%';
    confBar.style.background = conf >= CONFIDENCE ? '#00b894' : '#00cec9';
    gcWrap.classList.add('active');
  }

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
    .catch(() => {
      setStatus('err', 'Sem resposta do ESP32');
    });
}

function flashCard(key) {
  const badge = document.getElementById('badge_' + key);
  if (!badge) return;
  badge.classList.remove('show');
  void badge.offsetWidth;
  badge.classList.add('show');

  sendFlash.textContent = '↗ ENVIADO!';
  sendFlash.classList.remove('show');
  void sendFlash.offsetWidth;
  sendFlash.classList.add('show');
}

// ── Overlay ───────────────────────────────────────────────────
function showOverlay(msg) { overlayMsg.textContent = msg; overlay.classList.remove('hidden'); }
function hideOverlay()    { overlay.classList.add('hidden'); }

// ── Boot ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', init);
