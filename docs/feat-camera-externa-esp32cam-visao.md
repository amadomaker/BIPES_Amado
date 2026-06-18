# Câmera externa (ESP32-CAM) na aba Visão

> **Status (2026-06-18):** Parte B (seletor + provedor de frame) **pronta e
> testada**. Firmware da ESP32-CAM (stream MJPEG + CORS + WiFi por portal cativo)
> **pronto e gravando**. Botão "Preparar ESP32-CAM" no front **pronto**. Falta
> resolver **como o usuário descobre o IP da câmera sem abrir a Arduino IDE**
> (ver "Próximos passos"). Branch: `277-feat-camera-externa-esp32cam-visao`.

## Objetivo

Permitir que o usuário escolha **outra câmera** além da câmera principal do
notebook na aba Visão. O caso concreto é uma **ESP32-CAM**: o usuário usa o
vídeo dela como fonte, mas **todo o processamento continua no notebook**
(MediaPipe pose/gesto/cor roda igual, só muda de onde vem o frame).

Não está no ROADMAP da aba Visão (F1/F2/F3a/F3b) — é uma frente nova.

## O que já foi feito

### Parte B — seletor + provedor de frame (PRONTO, testado)

Em `gesture-control/`:
- Seletor **Notebook / ESP32-CAM** na topbar + campo de URL (aparece só quando
  ESP32-CAM). Fonte e URL persistem no localStorage.
- **Provedor de frame** (`frameEl` + `frameW()/frameH()/frameReady()` em
  `gesture-control.js`): abstrai `<video>` (webcam) vs `<img>` (MJPEG da ESP32).
  Pose, mãos, cor e `getCoverRect` leem dele, não mais do `videoEl` direto.
- ESP32-CAM → MJPEG num `<img crossorigin="anonymous">`; classe `.src-ext` no
  wrapper esconde o `<video>`, mostra o `<img>` e **remove o espelhamento** (a
  ESP32 não é espelhada como a webcam).
- `startExtCam(url)`: abre o stream com polling de `naturalWidth` + timeout +
  `onerror` (pega falha de rede/mixed-content).

### Firmware (PRONTO, gravando) — `firmware/esp32cam_visao/`

- `esp32cam_visao.ino`: serve **só** MJPEG em `:81/stream` com header
  `Access-Control-Allow-Origin: *`. Sem web UI nem face detect (isso é o que
  derruba o FPS no `CameraWebServer` padrão). VGA + `grab_mode LATEST` +
  `fb_count 2`. Resolução baixa de propósito (MediaPipe não aproveita mais).
- **WiFi por PORTAL CATIVO (WiFiManager / tzapu)**: no 1º uso cria a rede
  `ESP32CAM-Setup`; o usuário conecta (PC ou celular), abre sozinho a página,
  escolhe a rede dele e digita a senha. Reconecta sozinha nos boots seguintes.
- **mDNS**: responde também em `http://esp32cam-visao.local:81/stream`.
- Bug do probe da câmera (`0x105`) resolvido: `camera_config_t config = {}`
  (zerar a struct; campos com lixo, ex. `sccb_i2c_port`, faziam o probe falhar).

### Front — botão "Preparar ESP32-CAM" (PRONTO)

- Botão no grupo da câmera (aparece só com ESP32-CAM) → modal com:
  - `<esp-web-install-button>` (ESP Web Tools, via CDN) que **só grava** o
    firmware (`manifest.json` com `"improv": false`).
  - Passo a passo do portal cativo + campo de URL (pré-preenchido com a URL mDNS)
    → "Usar esta URL" seleciona ESP32-CAM, salva e fecha.
- `manifest.json` aponta para `esp32cam_visao.merged.bin` (mesma pasta). O `.bin`
  é artefato de build — gerado pela Arduino IDE (Export Compiled Binary já produz
  o `.ino.merged.bin`) e copiado pra `firmware/esp32cam_visao/`.

## Decisões fechadas (2026-06-18)

- **Mixed content:** o envio pro board é só `fetch(http://ip,{mode:'no-cors'})`
  (gesture-control.js linhas ~458/866/906) — fire-and-forget, sem truque. Câmera
  é caso diferente (precisa **ler pixels** → CORS no firmware + `<img crossorigin>`).
  Na prática o navegador tentou o http sem bloquear por mixed content (o erro foi
  timeout de rede, não bloqueio) — então mixed content **não** está sendo o
  empecilho no ambiente testado.
- **Firmware = Arduino**, gravado via **ESP Web Tools** (a UX "direta" vem do ESP
  Web Tools, não da linguagem). MicroPython no ESP32-CAM clássico é frágil.
- **WiFi = portal cativo (WiFiManager), NÃO Improv.** Improv-Serial foi tentado e
  **abandonado**: `"Improv Wi-Fi Serial not detected"` é problema conhecido e
  generalizado em ESP32 (reset timing / boot mode / USB instável — issues
  esp-web-tools #311 e #464, ESPHome, WLED). Falhou tanto no botão quanto no
  improv-wifi.com. Portal cativo é o fallback padrão do mercado e funcionou.
- **CORS confirmado funcionando:** com o header no firmware + `<img crossorigin>`,
  a detecção não dá mais `SecurityError`.

## O problema em aberto: IP fácil sem abrir a Arduino IDE

Depois de configurar o WiFi pelo portal cativo, a câmera entra na rede com um IP
do DHCP. Hoje o usuário **não tem como descobrir esse IP** sem abrir o Monitor
Serial da Arduino IDE — o que **não pode** ser o fluxo final (usuário leigo).

- O **mDNS (`esp32cam-visao.local`)** foi implementado pra resolver isso, mas
  **não resolveu** no ambiente do usuário (Windows). Pré-preenchido no modal, mas
  a câmera não ligou por ele. **Investigar por quê** é o passo nº 1.
- (Daqui do dev não dá pra testar a rede dele: o WSL fica em rede NAT isolada
  `172.31.x` e não enxerga a LAN `192.168.15.x`.)

## Próximos passos (amanhã)

1. **Fazer o usuário obter o IP sem IDE — prioridade.** Opções a avaliar:
   - **Consertar o mDNS** (`esp32cam-visao.local`) — solução ideal, zero IP.
     Investigar por que não resolveu no Windows (mDNS do firmware subiu? Chrome
     resolve `.local`? precisa de `MDNS.update()`/serviço? Bonjour instalado?).
   - **Mostrar o IP na própria página do portal cativo** após conectar
     (WiFiManager `setSaveConfigCallback` / página de sucesso com o IP), pra o
     usuário copiar antes de sair da rede `ESP32CAM-Setup`.
   - Fallback documentado: olhar a lista de dispositivos no roteador
     (`192.168.x.1`).
2. **Hospedar o `.merged.bin`** junto do site em `/firmware/esp32cam_visao/` pra
   o botão funcionar no ar (hoje só testado local). Decidir se versiona o `.bin`
   ou hospeda à parte. Ajustar `ESP_MANIFEST_URL` se o caminho servido mudar.
3. Validar **FPS** na prática (trocar pra `FRAMESIZE_QVGA` se "mais ou menos").
4. Avaliar **toggle de espelho** (a ESP32 não é espelhada; já tratado por CSS no
   `.src-ext`, mas confirmar na detecção de cor/mão).

## Arquivos da feature

- `gesture-control/index.html` / `.css` / `.js` — seletor, modal, provedor de frame.
- `firmware/esp32cam_visao/` — `esp32cam_visao.ino`, `manifest.json`, `README.md`
  e o `esp32cam_visao.merged.bin` (build).
