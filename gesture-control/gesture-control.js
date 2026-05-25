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

// Poses corporais (MediaPipe Pose, 33 landmarks).
// Chaves batem com `when_pose_detected` no Blockly e com /pose/<key> no ESP32.
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
const KEY_MODE           = 'vision_mode';   // 'hands' | 'pose'
const DEBOUNCE_MS        = 700;
const CONFIDENCE         = 0.75;
const POSE_HOLD_MS       = 250;             // pose precisa estabilizar antes de disparar
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
let mode                 = 'hands';  // 'hands' | 'pose'
let poseHoldKey          = null;     // pose atualmente "segurada"
let poseHoldSince        = 0;

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
const btnPing       = document.getElementById('btnPing');
const modalBackdrop = document.getElementById('modalBackdrop');
const btnMappings   = document.getElementById('btnMappings');
const btnCloseModal = document.getElementById('btnCloseModal');
const modalTitle    = document.getElementById('modalTitle');
const modalDesc     = document.getElementById('modalDesc');
const btnModeHands  = document.getElementById('modeHands');
const btnModePose   = document.getElementById('modePose');

// ── Init ─────────────────────────────────────────────────────
function init() {
  ipInput.value = localStorage.getItem(KEY_IP) || '';
  mode = localStorage.getItem(KEY_MODE) === 'pose' ? 'pose' : 'hands';
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
    if (e.key === 'Escape') closeModal();
  });

  btnModeHands.addEventListener('click', () => setMode('hands'));
  btnModePose .addEventListener('click', () => setMode('pose'));

  // Libera câmera ao fechar/navegar
  window.addEventListener('beforeunload', () => {
    if (isRunning) window.stopCamera();
  });

  // Atualiza canvas quando a janela for redimensionada
  new ResizeObserver(syncCanvasSize).observe(videoWrapper);
}

// ── Modo (Mãos/Corpo) ─────────────────────────────────────────
function applyModeUI() {
  btnModeHands.classList.toggle('is-active', mode === 'hands');
  btnModePose .classList.toggle('is-active', mode === 'pose');

  // Botão do HUD e cabeçalho do modal refletem o modo
  btnMappings.textContent = mode === 'pose' ? '⚙ Definir Poses' : '⚙ Definir Gestos';
  if (modalTitle) modalTitle.textContent = mode === 'pose'
    ? '⚙ Mapeamento de Poses'
    : '⚙ Mapeamento de Gestos';
  if (modalDesc) modalDesc.textContent = mode === 'pose'
    ? 'Configure o endpoint HTTP enviado ao AMADOBOARD para cada pose corporal detectada.'
    : 'Configure o endpoint HTTP enviado ao AMADOBOARD para cada gesto reconhecido.';
}

async function setMode(next) {
  if (mode === next) return;
  mode = next;
  localStorage.setItem(KEY_MODE, mode);
  applyModeUI();
  buildCards();
  resetLiveUI();

  if (!isRunning) return;

  // Câmera ligada: swap de modelo sem desligar a câmera
  try {
    showOverlay('Trocando modelo de detecção...');
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

// ── Mapeamentos (gesto OU pose, escolhido pelo modo atual) ────
function currentMappingKey() {
  return mode === 'pose' ? KEY_POSE_MAPPINGS : KEY_MAPPINGS;
}

function currentItems() {
  return mode === 'pose' ? POSES : GESTURES;
}

function defaultEndpointFor(key) {
  return mode === 'pose' ? '/pose/' + key : '';
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
  const label = mode === 'pose' ? 'poses' : 'gestos';
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

function resetLiveUI() {
  lastGesture = '';
  poseHoldKey = null;
  poseHoldSince = 0;
  updateLiveUI(null, 0);
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

      if (results.gestures?.length) {
        const top = results.gestures[0][0];
        updateLiveUI(top.categoryName, top.score);
        if (top.categoryName !== 'None' && top.score >= CONFIDENCE)
          maybeDispatch(top.categoryName);
      } else {
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

// ── UI ao vivo (compartilhada por gestos e poses) ─────────────
function updateLiveUI(key, conf) {
  const item = currentItems().find(x => x.key === key);

  if (!item) {
    liveEmoji.textContent = '—';
    liveName.textContent  = 'AGUARDANDO';
    liveName.className    = 'live-name none';
    liveConf.textContent  = '';
    confBar.style.width   = '0%';
    gcWrap.classList.remove('active');
  } else {
    liveEmoji.textContent = item.emoji;
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
