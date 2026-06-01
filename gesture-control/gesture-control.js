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

// Cores presets (modo Cor). H em graus 0–360, S e V em 0–1.
// Faixas pensadas pra iluminação típica de sala (não bate fluorescente
// dura, mas serve pra objeto colorido na mão). Vermelho dá wrap em
// 348..12; matchesHsv lida com isso quando hMin > hMax. Preto ignora H
// (sMax/vMax garantem que só pega pixels cinza-escuros, não saturados).
// Chaves batem com `color_preset` no Blockly e /color/<key> no servidor.
const COLOR_PRESETS = [
  { key: 'red',     label: 'Vermelho', hex: '#e74c3c', range: { hMin: 348, hMax: 12,  sMin: 0.45, vMin: 0.35 } },
  { key: 'orange',  label: 'Laranja',  hex: '#e67e22', range: { hMin: 13,  hMax: 38,  sMin: 0.50, vMin: 0.45 } },
  { key: 'yellow',  label: 'Amarelo',  hex: '#f1c40f', range: { hMin: 39,  hMax: 70,  sMin: 0.40, vMin: 0.55 } },
  { key: 'green',   label: 'Verde',    hex: '#2ecc71', range: { hMin: 71,  hMax: 165, sMin: 0.35, vMin: 0.30 } },
  { key: 'blue',    label: 'Azul',     hex: '#3498db', range: { hMin: 175, hMax: 250, sMin: 0.35, vMin: 0.18 } },
  { key: 'magenta', label: 'Magenta',  hex: '#9b59b6', range: { hMin: 275, hMax: 347, sMin: 0.35, vMin: 0.35 } },
  { key: 'black',   label: 'Preto',    hex: '#1a1a1a', range: { hMin: 0,   hMax: 360, sMin: 0,    vMin: 0,    sMax: 0.30, vMax: 0.22 } },
];

// Poses corporais (MediaPipe Pose, 33 landmarks).
// Chaves batem com `when_pose_detected`/`when_gesture_detected` no Blockly
// e com /pose/<key> ou /gesture/<key> na AMADOBOARD.
const POSES = [
  { key: 'arms_up',        label: 'Braços para cima',     emoji: '🙌' },
  { key: 't_pose',         label: 'Braços abertos (T)',   emoji: '🕴' },
  { key: 'right_arm_up',   label: 'Braço direito',         emoji: '🫱' },
  { key: 'left_arm_up',    label: 'Braço esquerdo',        emoji: '🫲' },
  { key: 'hands_on_head',  label: 'Mãos na cabeça',        emoji: '🙆' },
  { key: 'arms_crossed',   label: 'Braços cruzados',       emoji: '🙅' },
];

// Conexões padrão da mão no MediaPipe (21 landmarks)
const HAND_CONNECTIONS = [
  [0,1],[1,2],[2,3],[3,4],
  [0,5],[5,6],[6,7],[7,8],
  [5,9],[9,10],[10,11],[11,12],
  [9,13],[13,14],[14,15],[15,16],
  [13,17],[0,17],[17,18],[18,19],[19,20],
];

// Esqueleto de pose: tronco + braços + pernas
const POSE_CONNECTIONS = [
  [11,12],[11,23],[12,24],[23,24],
  [11,13],[13,15],
  [12,14],[14,16],
  [23,25],[25,27],
  [24,26],[26,28],
];

// Índices dos landmarks MediaPipe Pose (do ponto de vista do sujeito)
const LM = {
  NOSE: 0,
  L_SHOULDER: 11, R_SHOULDER: 12,
  L_ELBOW: 13,    R_ELBOW: 14,
  L_WRIST: 15,    R_WRIST: 16,
  L_HIP: 23,      R_HIP: 24,
  L_KNEE: 25,     R_KNEE: 26,
};

const KEY_IP             = 'gesture_esp32_ip';
const KEY_MAPPINGS       = 'gesture_mappings';
const KEY_POSE_MAPPINGS  = 'pose_mappings';
const KEY_COLOR_MAPPINGS = 'color_mappings';
const KEY_CAPTURED       = 'vision_captured_colors';   // slots 1..4 com HSV salvo
const KEY_COLOR_ENABLED  = 'color_enabled';            // { red: true, c1: false, ... }
const KEY_MODE           = 'vision_mode';   // 'hands' | 'pose' | 'color'
const DEBOUNCE_MS        = 700;
const CONFIDENCE         = 0.75;
const POSE_HOLD_MS       = 250;             // pose precisa estabilizar antes de disparar
const STREAM_MS          = 100;             // ~10Hz: taxa de envio do estado contínuo (modo Mãos)
const MEDIAPIPE_URL      = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/vision_bundle.mjs';
const POSE_MODEL_URL     = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task';

let recognizer           = null;   // GestureRecognizer (modo Mãos)
let poseLandmarker       = null;   // PoseLandmarker    (modo Corpo)
let stream               = null;
let rafId                = null;
let isRunning            = false;
let lastGesture          = '';     // último gesto OU pose disparado (compartilhado)
let lastSentAt           = 0;
let GestureRecognizerClass = null;
let mode                 = 'hands';  // 'hands' | 'pose' | 'color'
let poseHoldKey          = null;     // pose atualmente "segurada"
let poseHoldSince        = 0;
let lastStreamAt         = 0;        // throttle do estado contínuo
let streamInFlight       = false;    // evita empilhar GETs no servidor listen(1)
let captureSlot          = 0;        // 0 = sem captura ativa; 1..4 = slot alvo do clique

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
const hudContPanel  = document.getElementById('hudContPanel');
const hudHx         = document.getElementById('hudHx');
const hudHy         = document.getElementById('hudHy');
const hudPinch      = document.getElementById('hudPinch');
const gcWrap        = document.getElementById('gcWrap');
const confBar       = document.getElementById('confBar');
const recIndicator  = document.getElementById('recIndicator');
const btnPing       = document.getElementById('btnPing');
const modalBackdrop = document.getElementById('modalBackdrop');
const btnMappings   = document.getElementById('btnMappings');
const btnCloseModal = document.getElementById('btnCloseModal');
const modalTitle    = document.getElementById('modalTitle');
const modalDesc     = document.getElementById('modalDesc');
const btnModeHands  = document.getElementById('modeHands');
const btnModePose   = document.getElementById('modePose');
const btnModeColor  = document.getElementById('modeColor');
const captureBanner = document.getElementById('captureBanner');
const captureBannerText = document.getElementById('captureBannerText');

// ── Init ─────────────────────────────────────────────────────
function init() {
  ipInput.value = localStorage.getItem(KEY_IP) || '';
  const storedMode = localStorage.getItem(KEY_MODE);
  mode = (storedMode === 'pose' || storedMode === 'color') ? storedMode : 'hands';
  applyModeUI();
  updateStatus();
  buildCards();

  btnSave.addEventListener('click', saveIp);
  btnStart.addEventListener('click', startCamera);
  btnStop.addEventListener('click', window.stopCamera);
  ipInput.addEventListener('change', saveIp);

  btnPing.addEventListener('click', pingESP32);
  btnMappings.addEventListener('click', openModal);
  btnCloseModal.addEventListener('click', closeModal);
  modalBackdrop.addEventListener('click', e => {
    if (e.target === modalBackdrop) closeModal();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      if (captureSlot) cancelCapture();
      else             closeModal();
    }
  });

  videoWrapper.addEventListener('click', onCaptureClick);

  btnModeHands.addEventListener('click', () => setMode('hands'));
  btnModePose .addEventListener('click', () => setMode('pose'));
  btnModeColor.addEventListener('click', () => setMode('color'));

  // Libera câmera ao fechar/navegar
  window.addEventListener('beforeunload', () => {
    if (isRunning) window.stopCamera();
  });

  // Atualiza canvas quando a janela for redimensionada
  new ResizeObserver(syncCanvasSize).observe(videoWrapper);
}

// ── Modo (Mãos/Corpo/Cor) ─────────────────────────────────────
function applyModeUI() {
  btnModeHands.classList.toggle('is-active', mode === 'hands');
  btnModePose .classList.toggle('is-active', mode === 'pose');
  btnModeColor.classList.toggle('is-active', mode === 'color');

  // Botão do HUD e cabeçalho do modal refletem o modo
  btnMappings.textContent =
    mode === 'pose'  ? '⚙ Definir Poses'  :
    mode === 'color' ? '⚙ Definir Cores'  :
                       '⚙ Definir Gestos';
  if (modalTitle) modalTitle.textContent =
    mode === 'pose'  ? '⚙ Mapeamento de Poses'  :
    mode === 'color' ? '⚙ Mapeamento de Cores'  :
                       '⚙ Mapeamento de Gestos';
  if (modalDesc) modalDesc.textContent =
    mode === 'pose'  ? 'Configure o endpoint HTTP enviado ao AMADOBOARD para cada pose corporal detectada.' :
    mode === 'color' ? 'Configure o endpoint HTTP por cor — 6 cores prontas + 4 slots de cor capturada pela câmera.' :
                       'Configure o endpoint HTTP enviado ao AMADOBOARD para cada gesto reconhecido.';
}

async function setMode(next) {
  if (mode === next) return;
  mode = next;
  localStorage.setItem(KEY_MODE, mode);
  applyModeUI();
  buildCards();
  resetLiveUI();
  cancelCapture();   // sair da captura ao trocar de modo

  if (!isRunning) return;

  // Câmera ligada: swap de modelo sem desligar a câmera.
  // Modo Cor não usa MediaPipe — só descarrega os modelos atuais.
  try {
    if (mode !== 'color') showOverlay('Trocando modelo de detecção...');
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    if (recognizer)     { recognizer.close();     recognizer     = null; }
    if (poseLandmarker) { poseLandmarker.close(); poseLandmarker = null; }
    await loadDetectorForMode();
    hideOverlay();
    detectLoop();
  } catch (err) {
    hideOverlay();
    setStatus('err', 'Erro ao trocar modo: ' + err.message);
    console.error(err);
  }
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

// ── Mapeamentos (gesto OU pose OU cor, escolhido pelo modo atual) ────
function currentMappingKey() {
  return mode === 'pose'  ? KEY_POSE_MAPPINGS  :
         mode === 'color' ? KEY_COLOR_MAPPINGS :
                            KEY_MAPPINGS;
}

function currentItems() {
  if (mode === 'pose')  return POSES;
  if (mode === 'color') return getColorItems();
  return GESTURES;
}

// Lista de items pro modo Cor: 6 presets + 4 slots capturados.
// Slots vazios entram com `empty: true` pro card mostrar "Capturar".
function getColorItems() {
  const items = COLOR_PRESETS.map(c => Object.assign({}, c, { capturable: false, empty: false }));
  const captured = getCapturedColors();
  for (let i = 1; i <= 4; i++) {
    const c = captured[i];
    items.push({
      key:        'c' + i,
      label:      'Cor capturada ' + i,
      hex:        c?.hex || '#3a3a3a',
      slot:       i,
      capturable: true,
      empty:      !c,
      range:      c?.range || null,
    });
  }
  return items;
}

function defaultEndpointFor(key) {
  return mode === 'pose'  ? '/pose/'  + key :
         mode === 'color' ? '/color/' + key :
                            '/gesture/' + key;
}

function getMappings() {
  try { return JSON.parse(localStorage.getItem(currentMappingKey()) || '{}'); }
  catch { return {}; }
}

function setMapping(key, val) {
  const m = getMappings();
  m[key] = val;
  localStorage.setItem(currentMappingKey(), JSON.stringify(m));
  updateMappedCount();
}

function updateMappedCount() {
  const items = currentItems();
  const count = Object.values(getMappings()).filter(v => v).length;
  const label =
    mode === 'pose'  ? 'poses'  :
    mode === 'color' ? 'cores'  :
                       'gestos';
  hudMappedEl.textContent = count + '/' + items.length + ' ' + label + ' mapeados';
}

function buildCards() {
  const mappings = getMappings();
  const items    = currentItems();
  cardsGrid.innerHTML = '';
  updateMappedCount();
  items.forEach(g => {
    const card = document.createElement('div');
    card.className = 'g-card' + (mappings[g.key] ? '' : ' empty-hint');
    card.id = 'card_' + g.key;

    const badge = document.createElement('span');
    badge.className = 'g-card-badge';
    badge.id = 'badge_' + g.key;
    badge.textContent = '✓ enviado';

    // Cor: swatch redondo. Gesto/pose: emoji.
    const emoji = document.createElement('div');
    emoji.className = 'g-card-emoji';
    if (mode === 'color') {
      emoji.classList.add('color-swatch');
      emoji.style.background = g.hex;
      if (g.empty) emoji.classList.add('is-empty');
    } else {
      emoji.textContent = g.emoji;
    }

    const name = document.createElement('div');
    name.className = 'g-card-name';
    name.textContent = g.label;

    const wrap = document.createElement('div');
    wrap.className = 'g-card-input-wrap';

    // Cor: toggle "Detectando / Ignorada" pro aluno anular cores que
    // aparecem na parede sem mexer no resto. Slots vazios não levam
    // toggle (nada pra ligar/desligar).
    if (mode === 'color' && !g.empty) {
      const enabled = isColorEnabled(g.key);
      if (!enabled) card.classList.add('is-disabled');
      const tog = document.createElement('button');
      tog.type = 'button';
      tog.className = 'g-card-toggle' + (enabled ? '' : ' is-off');
      tog.textContent = enabled ? '👁 Detectando' : '🚫 Ignorada';
      tog.addEventListener('click', () => {
        setColorEnabled(g.key, !isColorEnabled(g.key));
        buildCards();
      });
      wrap.appendChild(tog);
    }

    // Cor capturada: botão "Capturar" antes do endpoint.
    // Quando o slot já tem cor, adiciona um botão "Limpar" ao lado
    // pra esvaziar (volta a ser um slot disponível pra capturar).
    if (mode === 'color' && g.capturable) {
      const row = document.createElement('div');
      row.className = 'g-card-capture-row';
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'g-card-capture';
      btn.textContent = g.empty ? 'Capturar' : 'Recapturar';
      btn.addEventListener('click', () => startCaptureForSlot(g.slot));
      row.appendChild(btn);
      if (!g.empty) {
        const clr = document.createElement('button');
        clr.type = 'button';
        clr.className = 'g-card-clear';
        clr.textContent = 'Limpar';
        clr.title = 'Esvazia este slot. Volta a mostrar "Capturar".';
        clr.addEventListener('click', () => {
          setCapturedColor(g.slot, null);
          setColorEnabled(g.key, true);   // reseta toggle pra ligado
          buildCards();
        });
        row.appendChild(clr);
      }
      wrap.appendChild(row);
    }

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

function resetLiveUI() {
  lastGesture = '';
  poseHoldKey = null;
  poseHoldSince = 0;
  updateLiveUI(null, 0);
  updateContinuousHud(null);
}

// ── Ping ESP32 ────────────────────────────────────────────────
function pingESP32() {
  const ip = ipInput.value.trim();
  if (!ip) { setStatus('err', 'Configure o IP primeiro'); return; }

  btnPing.disabled    = true;
  btnPing.textContent = '...';
  setStatus('', 'Verificando ' + ip + '...');

  const controller = new AbortController();
  // Servidor ESP32 aceita TCP mas não responde HTTP à rota '/':
  // → AbortError após 3s = porta aberta = servidor ativo
  // → erro imediato (< 3s) = IP inacessível
  setTimeout(() => controller.abort(), 3000);

  const finish = (ok) => {
    setStatus(ok ? 'ok' : 'err', ok ? ip + ' — acessível' : ip + ' — sem resposta');
    btnPing.disabled    = false;
    btnPing.textContent = '⚡ Testar';
  };

  fetch('http://' + ip + '/', { method: 'GET', mode: 'no-cors', cache: 'no-store', signal: controller.signal })
    .then(() => finish(true))
    .catch(e => finish(e.name === 'AbortError'));
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

async function loadDetectorForMode() {
  // Modo Cor não precisa de MediaPipe — só lê pixels do canvas.
  if (mode === 'color') return;

  const mp = await loadMP();
  const { GestureRecognizer, PoseLandmarker, FilesetResolver } = mp;
  const vision = await FilesetResolver.forVisionTasks(
    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm'
  );

  if (mode === 'pose') {
    showOverlay('Carregando modelo de pose...');
    if (!PoseLandmarker) throw new Error('PoseLandmarker indisponível neste bundle MediaPipe');
    try {
      poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: POSE_MODEL_URL, delegate: 'GPU' },
        runningMode: 'VIDEO',
        numPoses: 1,
      });
    } catch (_) {
      showOverlay('GPU indisponível, usando CPU...');
      poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: POSE_MODEL_URL, delegate: 'CPU' },
        runningMode: 'VIDEO',
        numPoses: 1,
      });
    }
  } else {
    showOverlay('Carregando modelo de gestos...');
    const modelAssetPath = 'https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task';
    try {
      recognizer = await GestureRecognizer.createFromOptions(vision, {
        baseOptions: { modelAssetPath, delegate: 'GPU' },
        runningMode: 'VIDEO',
        numHands: 1,
      });
    } catch (_) {
      showOverlay('GPU indisponível, usando CPU...');
      recognizer = await GestureRecognizer.createFromOptions(vision, {
        baseOptions: { modelAssetPath, delegate: 'CPU' },
        runningMode: 'VIDEO',
        numHands: 1,
      });
    }
  }
}

async function startCamera() {
  if (isRunning) return;
  btnStart.disabled = true;

  try {
    showOverlay('Carregando MediaPipe...');
    await loadDetectorForMode();

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
  if (recognizer)     { recognizer.close();     recognizer     = null; }
  if (poseLandmarker) { poseLandmarker.close(); poseLandmarker = null; }

  videoEl.srcObject = null;
  ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
  videoWrapper.style.display = 'none';
  placeholder.style.display  = 'flex';
  btnStart.disabled = false;
  btnStop.disabled  = true;

  hudSysEl.textContent = 'SISTEMA INATIVO';
  hudSysEl.classList.remove('active');
  hudCmdEl.textContent = '';
  updateContinuousHud(null);
  recIndicator.classList.add('hidden');

  updateLiveUI(null, 0);
  poseHoldKey = null;
  poseHoldSince = 0;
  updateStatus();
};

function detectLoop() {
  if (!isRunning) return;

  if (videoEl.readyState >= 2) {
    ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);

    if (mode === 'pose' && poseLandmarker) {
      try {
        const results = poseLandmarker.detectForVideo(videoEl, performance.now());
        drawPoseLandmarks(results);
        const lm = results.landmarks?.[0];
        const detected = lm ? evaluatePose(lm) : null;

        if (detected) {
          // exige hold para evitar pisca-pisca
          if (poseHoldKey !== detected) {
            poseHoldKey = detected;
            poseHoldSince = performance.now();
          }
          const held = performance.now() - poseHoldSince;
          updateLiveUI(detected, Math.min(1, held / POSE_HOLD_MS));
          if (held >= POSE_HOLD_MS) maybeDispatch(detected);
        } else {
          poseHoldKey = null;
          poseHoldSince = 0;
          updateLiveUI(null, 0);
        }
      } catch (err) { console.error('Pose detect:', err); }

    } else if (mode === 'hands' && recognizer) {
      const results = recognizer.recognizeForVideo(videoEl, performance.now());
      try { drawHandLandmarks(results); } catch (_) { /* erros de desenho não param o loop */ }

      // F1 — valores contínuos: posição da mão e abertura da pinça.
      const hlm = results.landmarks?.[0];
      if (hlm) maybeStreamState(hlm);
      else updateContinuousHud(null);

      if (results.gestures?.length) {
        const top = results.gestures[0][0];
        updateLiveUI(top.categoryName, top.score);
        if (top.categoryName !== 'None' && top.score >= CONFIDENCE)
          maybeDispatch(top.categoryName);
      } else {
        updateLiveUI(null, 0);
      }

    } else if (mode === 'color') {
      // F3a — detecção de cor: sem MediaPipe, só pixel-scan HSV.
      // score do detectColors é fração do frame; multiplica pra
      // encher a barra de confiança (3-10% já dá barra cheia).
      const result = detectColors();
      if (result) {
        drawColorMarker(result);
        updateLiveUI(result.color.key, Math.min(1, result.score * 10));
        maybeDispatch(result.color.key);
      } else {
        markerHas = false;
        updateLiveUI(null, 0);
      }
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

// Desenho do esqueleto de pose
function drawPoseLandmarks(results) {
  const lm = results.landmarks?.[0];
  if (!lm) return;
  const { ox, oy, rw, rh } = getCoverRect();
  const pts = lm.map(p => ({ x: ox + p.x * rw, y: oy + p.y * rh }));

  ctx.strokeStyle = 'rgba(155, 89, 182, 0.9)';
  ctx.lineWidth   = 3;
  ctx.lineCap     = 'round';
  for (const [s, e] of POSE_CONNECTIONS) {
    if (!pts[s] || !pts[e]) continue;
    ctx.beginPath();
    ctx.moveTo(pts[s].x, pts[s].y);
    ctx.lineTo(pts[e].x, pts[e].y);
    ctx.stroke();
  }
  const keyPoints = [0, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26];
  for (const i of keyPoints) {
    if (!pts[i]) continue;
    ctx.beginPath();
    ctx.arc(pts[i].x, pts[i].y, 5, 0, Math.PI * 2);
    ctx.fillStyle   = '#a29bfe';
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth   = 1.5;
    ctx.stroke();
  }
}

// Avalia regras simples sobre os 33 landmarks e devolve a chave da
// pose ativa (ou null). Coordenadas são normalizadas [0..1]; y cresce
// para BAIXO, então "para cima" = y menor.
function evaluatePose(lm) {
  if (!lm || lm.length < 17) return null;

  const ls = lm[LM.L_SHOULDER], rs = lm[LM.R_SHOULDER];
  const lw = lm[LM.L_WRIST],    rw = lm[LM.R_WRIST];
  const nose = lm[LM.NOSE];

  // Precisamos pelo menos dos dois ombros e do nariz pra ter referencial.
  const vis = p => (p.visibility ?? 1);
  if (vis(ls) < 0.5 || vis(rs) < 0.5 || vis(nose) < 0.5) return null;

  // Visibilidade dos pulsos avaliada por LADO — assim um pulso oculto
  // do outro lado não derruba a detecção do lado bom.
  const leftWristVisible  = vis(lw) > 0.4;
  const rightWristVisible = vis(rw) > 0.4;

  // Unidade de referência: largura entre ombros (proporcional ao tamanho
  // do corpo na imagem; funciona perto e longe da câmera).
  const shoulderW = Math.hypot(ls.x - rs.x, ls.y - rs.y) || 0.1;
  const upMargin  = shoulderW * 0.15;
  const tolY      = shoulderW * 0.30;

  const leftWristUp  = leftWristVisible  && lw.y < ls.y - upMargin;
  const rightWristUp = rightWristVisible && rw.y < rs.y - upMargin;

  const leftAtShoulder  = leftWristVisible  && Math.abs(lw.y - ls.y) < tolY && Math.abs(lw.x - ls.x) > shoulderW * 0.7;
  const rightAtShoulder = rightWristVisible && Math.abs(rw.y - rs.y) < tolY && Math.abs(rw.x - rs.x) > shoulderW * 0.7;

  // "Mãos na cabeça": pulso PERTO do nariz (raio ~ largura da cabeça)
  // E não muito acima dele — se estiver muito acima, é "braços pra cima".
  const HEAD_RADIUS = shoulderW * 0.55;
  const HEAD_ABOVE_LIMIT = shoulderW * 0.25; // o quanto o pulso pode ficar acima do nariz
  const handOnHead = (w, visible) =>
    visible &&
    Math.hypot(w.x - nose.x, w.y - nose.y) < HEAD_RADIUS &&
    w.y > nose.y - HEAD_ABOVE_LIMIT;
  const leftHandOnHead  = handOnHead(lw, leftWristVisible);
  const rightHandOnHead = handOnHead(rw, rightWristVisible);

  // "Braços cruzados no peito": cada pulso fica mais perto do ombro OPOSTO
  // (sinal claro de cruzamento) e ambos estão na altura do peito (abaixo
  // dos ombros, mas não muito abaixo).
  const dist2 = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const lwCrossed = leftWristVisible  && dist2(lw, rs) < dist2(lw, ls);
  const rwCrossed = rightWristVisible && dist2(rw, ls) < dist2(rw, rs);
  const chestLevel = (w, s) => w.y > s.y - upMargin && w.y < s.y + shoulderW * 1.2;
  const armsCrossed =
    lwCrossed && rwCrossed &&
    chestLevel(lw, ls) && chestLevel(rw, rs);

  // Ordem importa: poses mais específicas antes das genéricas.
  if (leftHandOnHead && rightHandOnHead) return 'hands_on_head';
  if (armsCrossed) return 'arms_crossed';
  if (leftWristUp && rightWristUp) return 'arms_up';
  if (leftAtShoulder && rightAtShoulder) return 't_pose';
  // do ponto de vista do sujeito: braço direito = R_WRIST (16)
  if (rightWristUp && !leftWristUp) return 'right_arm_up';
  if (leftWristUp && !rightWristUp) return 'left_arm_up';

  return null;
}

// ── UI ao vivo (compartilhada por gestos, poses e cores) ──────
function updateLiveUI(key, conf) {
  const item = currentItems().find(x => x.key === key);

  if (!item) {
    liveEmoji.textContent = '—';
    liveEmoji.style.background = '';
    liveEmoji.classList.remove('color-swatch');
    liveName.textContent  = 'AGUARDANDO';
    liveName.className    = 'live-name none';
    liveConf.textContent  = '';
    confBar.style.width   = '0%';
    gcWrap.classList.remove('active');
  } else {
    // No modo Cor, troca o emoji por um swatch da cor detectada.
    if (mode === 'color') {
      liveEmoji.textContent = '';
      liveEmoji.style.background = item.hex;
      liveEmoji.classList.add('color-swatch');
    } else {
      liveEmoji.textContent = item.emoji || '—';
      liveEmoji.style.background = '';
      liveEmoji.classList.remove('color-swatch');
    }
    liveName.textContent  = item.label.toUpperCase();
    liveName.className    = 'live-name';
    liveConf.textContent  = 'CONFIANÇA: ' + Math.round(conf * 100) + '%';
    confBar.style.width   = Math.round(conf * 100) + '%';
    confBar.style.background = conf >= (mode === 'pose' ? 1 : CONFIDENCE)
      ? '#00b894' : '#00cec9';
    gcWrap.classList.add('active');
  }

  document.querySelectorAll('.g-card').forEach(c => c.classList.remove('active'));
  if (item) document.getElementById('card_' + key)?.classList.add('active');
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
  // No modo "pose", o endpoint padrão é /pose/<key> (bate com o
  // bloco when_pose_detected no ESP32); o aluno pode sobrescrever
  // no modal. No modo "hands", sem mapeamento = nada a enviar.
  const userMapping = getMappings()[gesture] || '';
  const mapping = userMapping || defaultEndpointFor(gesture);

  if (!mapping) return;
  if (!ip) { setStatus('err', 'Configure o IP do AMADOBOARD'); return; }

  const endpoint = mapping.startsWith('/') ? mapping : '/' + mapping;
  const url = 'http://' + ip + endpoint;

  fetch(url, { method: 'GET', mode: 'no-cors', cache: 'no-store' })
    .then(() => {
      setStatus('ok', ip + ' — último: ' + endpoint);
      flashCard(gesture);
    })
    .catch(() => {
      setStatus('err', 'Sem resposta do AMADOBOARD');
    });
}

// ── Estado contínuo (F1) ──────────────────────────────────────
// Modo Mãos: deriva valores 0–100 dos landmarks e envia ~10Hz à
// AMADOBOARD em /vision/state?hx=..&hy=..&pd=.. (lido pelos blocos
// vision_hand_position / vision_pinch_distance no ESP32).
//
// Landmarks da mão (MediaPipe Hands, 21 pontos): 0=pulso, 4=ponta do
// polegar, 8=ponta do indicador, 9=base do dedo médio.
function maybeStreamState(lm) {
  const now = Date.now();
  if (now - lastStreamAt < STREAM_MS) return;
  lastStreamAt = now;

  const clamp = v => Math.max(0, Math.min(100, Math.round(v)));
  const wrist = lm[0];
  // Espelhado (selfie): mão p/ a direita do aluno = hx maior;
  // mão p/ cima = hy maior.
  const hx = clamp((1 - wrist.x) * 100);
  const hy = clamp((1 - wrist.y) * 100);
  // Pinça normalizada pelo tamanho da palma (pulso→base do médio) para
  // ficar menos sensível à distância da câmera. Calibração fina fica
  // como evolução futura (ver ROADMAP).
  const ref = Math.hypot(lm[0].x - lm[9].x, lm[0].y - lm[9].y) || 0.1;
  const pinchRaw = Math.hypot(lm[4].x - lm[8].x, lm[4].y - lm[8].y);
  const pd = clamp((pinchRaw / ref) * 100);

  updateContinuousHud(hx, hy, pd);

  const ip = ipInput.value.trim();
  if (!ip || streamInFlight) return;
  streamInFlight = true;
  fetch('http://' + ip + '/vision/state?hx=' + hx + '&hy=' + hy + '&pd=' + pd,
        { method: 'GET', mode: 'no-cors', cache: 'no-store' })
    .finally(() => { streamInFlight = false; });
}

function updateContinuousHud(hx, hy, pd) {
  if (!hudContPanel) return;
  if (hx == null) {
    hudContPanel.classList.remove('show');
    return;
  }
  hudContPanel.classList.add('show');
  if (hudHx)    hudHx.textContent    = hx;
  if (hudHy)    hudHy.textContent    = hy;
  if (hudPinch) hudPinch.textContent = pd;
}

// ── Captura de cor por clique (F3a) ──────────────────────────
// Fluxo: usuário clica "Capturar" no slot N do modal → modal fecha,
// banner aparece, cursor vira crosshair sobre o vídeo. Próximo clique
// no vídeo amostra HSV de uma vizinhança de 3x3 pixels do canvas de
// detecção (que já está rodando em 80x60), gera um range com
// tolerância e salva no slot. ESC cancela.
function startCaptureForSlot(slot) {
  if (!isRunning) {
    setStatus('err', 'Ligue a câmera antes de capturar uma cor');
    return;
  }
  captureSlot = slot;
  closeModal();
  captureBannerText.textContent =
    'Clique na câmera para capturar a Cor capturada ' + slot;
  captureBanner.classList.remove('hidden');
  videoWrapper.classList.add('capturing');
}

function cancelCapture() {
  captureSlot = 0;
  captureBanner.classList.add('hidden');
  videoWrapper.classList.remove('capturing');
}

function onCaptureClick(e) {
  if (!captureSlot) return;
  // Coordenadas relativas ao wrapper → ao retângulo real do vídeo
  // (que está em object-fit cover dentro do wrapper).
  // O vídeo é CSS-mirrored (scaleX(-1)); o frame-fonte não é. Flip
  // horizontal no X pra ler o pixel certo, senão capturava o lado
  // oposto do que o aluno via.
  const rect = videoWrapper.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  const { ox, oy, rw, rh } = getCoverRect();
  const relX = 1 - (x - ox) / rw;
  const relY = (y - oy) / rh;
  if (relX < 0 || relX > 1 || relY < 0 || relY > 1) return;

  // Amostra 3x3 do _detectCanvas (80x60) em torno do clique.
  const cx = Math.floor(relX * _detectCanvas.width);
  const cy = Math.floor(relY * _detectCanvas.height);
  const sx = Math.max(0, Math.min(_detectCanvas.width  - 3, cx - 1));
  const sy = Math.max(0, Math.min(_detectCanvas.height - 3, cy - 1));
  const data = _detectCtx.getImageData(sx, sy, 3, 3).data;

  let r = 0, g = 0, b = 0, n = 0;
  for (let i = 0; i < data.length; i += 4) {
    r += data[i]; g += data[i+1]; b += data[i+2]; n++;
  }
  r = Math.round(r / n); g = Math.round(g / n); b = Math.round(b / n);
  const hsv = rgbToHsv(r, g, b);

  // Range com tolerância. Pra cores coloridas: H ± 18°, S/V mínimos
  // permissivos. Pra cores escuras (V baixo) ou cinzas (S baixo) o H
  // perde significado — uso sMax/vMax pra travar dentro da "faixa
  // escura/cinza" sem depender de hue.
  const isGray = hsv.s < 0.20;
  const isDark = hsv.v < 0.25;
  let range;
  if (isDark && isGray) {
    // Preto / cinza-muito-escuro: ignora H, exige S baixo e V baixo.
    range = {
      hMin: 0, hMax: 360,
      sMin: 0, sMax: Math.max(0.30, hsv.s + 0.18),
      vMin: 0, vMax: Math.max(0.25, hsv.v + 0.15),
    };
  } else if (isGray) {
    // Cinza médio/claro: ignora H, S baixo, V em torno do capturado.
    range = {
      hMin: 0, hMax: 360,
      sMin: 0, sMax: 0.30,
      vMin: Math.max(0.10, hsv.v - 0.22),
      vMax: Math.min(1.00, hsv.v + 0.22),
    };
  } else {
    const hTol = 18;
    let hMin = hsv.h - hTol;
    let hMax = hsv.h + hTol;
    if (hMin < 0)   hMin += 360;
    if (hMax > 360) hMax -= 360;
    range = {
      hMin, hMax,
      sMin: Math.max(0.20, hsv.s - 0.30),
      vMin: Math.max(0.12, hsv.v - 0.30),
    };
  }

  const hex = '#' + [r, g, b].map(c => c.toString(16).padStart(2, '0')).join('');
  setCapturedColor(captureSlot, { hex, range });

  cancelCapture();
  buildCards();
  openModal();
}

// ── Detecção de cor (F3a) ─────────────────────────────────────
// Estratégia: desenhar o frame de vídeo num canvas off-screen baixo
// (80x60 ~ 4.8k pixels) e varrer pixel a pixel convertendo pra HSV.
// Pra cada cor "vigiada" (presets + slots capturados não vazios), conta
// hits. A cor com maior cobertura acima do limiar (3% do frame) ganha.
//
// Por que canvas baixo: detecção de cor não precisa de detalhe, e 80x60
// roda fácil até em laptop fraco — mantém compatibilidade com a regra
// de "MediaPipe pesado não roda junto" sem onerar a CPU.
const _detectCanvas = document.createElement('canvas');
_detectCanvas.width  = 80;
_detectCanvas.height = 60;
const _detectCtx = _detectCanvas.getContext('2d', { willReadFrequently: true });
const COLOR_THRESHOLD_PCT = 0.005;  // blob da cor ≥ 0.5% do frame conta como "presente"

// EMA pra suavizar a bounding box (evita pisca-pisca em quadro ruidoso)
let markerBox = null;   // { x0, y0, x1, y1 } em coords normalizadas do detect canvas
let markerHas = false;

function rgbToHsv(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const d = max - min;
  let h;
  if (d === 0)       h = 0;
  else if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else                h = (r - g) / d + 4;
  h = h * 60;
  if (h < 0) h += 360;
  const s = max === 0 ? 0 : d / max;
  const v = max;
  return { h, s, v };
}

function matchesHsv(hsv, range) {
  if (hsv.s < range.sMin || hsv.v < range.vMin) return false;
  if (range.sMax != null && hsv.s > range.sMax) return false;
  if (range.vMax != null && hsv.v > range.vMax) return false;
  // hMin > hMax indica wrap em 360° (vermelho).
  return range.hMin <= range.hMax
    ? (hsv.h >= range.hMin && hsv.h <= range.hMax)
    : (hsv.h >= range.hMin || hsv.h <= range.hMax);
}

function getCapturedColors() {
  try { return JSON.parse(localStorage.getItem(KEY_CAPTURED) || '{}'); }
  catch { return {}; }
}

function setCapturedColor(slot, color) {
  const all = getCapturedColors();
  if (color) all[slot] = color; else delete all[slot];
  localStorage.setItem(KEY_CAPTURED, JSON.stringify(all));
}

// Liga/desliga cores na detecção (default: todas ligadas). Útil pra
// anular cores que aparecem no fundo da sala sem precisar mexer no
// código do aluno.
function getColorEnabledMap() {
  try { return JSON.parse(localStorage.getItem(KEY_COLOR_ENABLED) || '{}'); }
  catch { return {}; }
}

function isColorEnabled(key) {
  const m = getColorEnabledMap();
  return m[key] !== false;   // undefined ou true → ligada
}

function setColorEnabled(key, enabled) {
  const m = getColorEnabledMap();
  if (enabled) delete m[key]; else m[key] = false;
  localStorage.setItem(KEY_COLOR_ENABLED, JSON.stringify(m));
}

// Lista de cores "vigiadas" agora: presets + slots capturados não vazios,
// menos as marcadas como "ignoradas" pelo aluno no modal.
// Slot key vira 'c1'..'c4' pra bater com o bloco color_captured.
function getActiveColorWatchlist() {
  const enabled = getColorEnabledMap();
  const passes = k => enabled[k] !== false;
  const list = COLOR_PRESETS.filter(c => passes(c.key)).slice();
  const captured = getCapturedColors();
  for (let i = 1; i <= 4; i++) {
    const c = captured[i];
    const key = 'c' + i;
    if (c && c.range && passes(key)) list.push({
      key,
      label: 'Cor capturada ' + i,
      hex:   c.hex,
      range: c.range,
    });
  }
  return list;
}

// Pra cada cor "vigiada", encontra o MAIOR blob (componente conectado)
// que NÃO toca a borda do frame. Blob na borda = quase sempre parede/
// fundo, então é descartado. Vence a cor cujo blob interior é maior.
function detectColors() {
  if (!videoEl.videoWidth) return null;
  const W = _detectCanvas.width, H = _detectCanvas.height;
  _detectCtx.drawImage(videoEl, 0, 0, W, H);
  const data = _detectCtx.getImageData(0, 0, W, H).data;
  const total = W * H;
  const minHits = total * COLOR_THRESHOLD_PCT;

  const watched = getActiveColorWatchlist();
  if (!watched.length) return null;

  let bestResult = null;
  const mask = new Uint8Array(total);

  for (let c = 0; c < watched.length; c++) {
    // Constrói máscara binária pra essa cor.
    let any = false;
    for (let i = 0, j = 0; i < data.length; i += 4, j++) {
      const hsv = rgbToHsv(data[i], data[i+1], data[i+2]);
      const hit = matchesHsv(hsv, watched[c].range) ? 1 : 0;
      mask[j] = hit;
      if (hit) any = true;
    }
    if (!any) continue;

    const blob = largestInteriorBlob(mask, W, H);
    if (!blob || blob.count < minHits) continue;

    if (!bestResult || blob.count > bestResult.blobCount) {
      bestResult = {
        color:     watched[c],
        score:     blob.count / total,
        blobCount: blob.count,
        // bbox em coords normalizadas (0..1)
        bbox: {
          x0: blob.minX / W,
          y0: blob.minY / H,
          x1: (blob.maxX + 1) / W,
          y1: (blob.maxY + 1) / H,
        },
      };
    }
  }

  return bestResult;
}

// Flood-fill iterativo (4-vizinhos) em mask binária. Retorna o maior
// componente conectado que NÃO encosta na borda. mask é consumida
// (pixels visitados viram 2) — chamador descarta depois.
function largestInteriorBlob(mask, W, H) {
  let bestCount = 0;
  let bestMinX = 0, bestMinY = 0, bestMaxX = 0, bestMaxY = 0;
  const stack = [];

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const start = y * W + x;
      if (mask[start] !== 1) continue;

      stack.length = 0;
      stack.push(start);
      mask[start] = 2;
      let count = 0, touchesEdge = false;
      let minX = x, minY = y, maxX = x, maxY = y;

      while (stack.length) {
        const cur = stack.pop();
        const cx  = cur % W;
        const cy  = (cur / W) | 0;
        count++;
        if (cx === 0 || cx === W - 1 || cy === 0 || cy === H - 1) touchesEdge = true;
        if (cx < minX) minX = cx;
        if (cy < minY) minY = cy;
        if (cx > maxX) maxX = cx;
        if (cy > maxY) maxY = cy;

        const up = cur - W, dn = cur + W, lf = cur - 1, rt = cur + 1;
        if (cy > 0     && mask[up] === 1) { mask[up] = 2; stack.push(up); }
        if (cy < H - 1 && mask[dn] === 1) { mask[dn] = 2; stack.push(dn); }
        if (cx > 0     && mask[lf] === 1) { mask[lf] = 2; stack.push(lf); }
        if (cx < W - 1 && mask[rt] === 1) { mask[rt] = 2; stack.push(rt); }
      }

      if (touchesEdge) continue;
      if (count > bestCount) {
        bestCount = count;
        bestMinX = minX; bestMinY = minY;
        bestMaxX = maxX; bestMaxY = maxY;
      }
    }
  }

  // Limpa máscara pra próxima cor (2 → 0; 1 que sobrou também → 0)
  mask.fill(0);
  return bestCount === 0 ? null : {
    count: bestCount,
    minX: bestMinX, minY: bestMinY,
    maxX: bestMaxX, maxY: bestMaxY,
  };
}

// Bounding box em volta do blob detectado, com pad e cantos redondos.
// O canvas é CSS-mirrored junto com o vídeo, então coords do frame-fonte
// caem no lugar visual certo. EMA suaviza a transição.
function drawColorMarker(result) {
  const { ox, oy, rw, rh } = getCoverRect();
  const b = result.bbox;

  if (!markerHas) {
    markerBox = Object.assign({}, b);
    markerHas = true;
  } else {
    const a = 0.65;
    markerBox.x0 = markerBox.x0 * a + b.x0 * (1 - a);
    markerBox.y0 = markerBox.y0 * a + b.y0 * (1 - a);
    markerBox.x1 = markerBox.x1 * a + b.x1 * (1 - a);
    markerBox.y1 = markerBox.y1 * a + b.y1 * (1 - a);
  }

  // Padding visual ~10% pra dar respiro.
  const padX = (markerBox.x1 - markerBox.x0) * 0.10;
  const padY = (markerBox.y1 - markerBox.y0) * 0.10;
  const x = ox + (markerBox.x0 - padX) * rw;
  const y = oy + (markerBox.y0 - padY) * rh;
  const w = (markerBox.x1 - markerBox.x0 + 2 * padX) * rw;
  const h = (markerBox.y1 - markerBox.y0 + 2 * padY) * rh;
  const r = Math.min(12, w / 4, h / 4);

  ctx.save();
  ctx.strokeStyle = result.color.hex;
  ctx.lineWidth   = 3;
  ctx.shadowColor = result.color.hex;
  ctx.shadowBlur  = 14;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
  ctx.stroke();
  ctx.restore();
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
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
