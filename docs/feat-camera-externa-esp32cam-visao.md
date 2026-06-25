# Câmera externa (ESP32-CAM) na aba Visão

> **Status (2026-06-22):** Parte B (seletor + provedor de frame) **pronta e
> testada**. Firmware da ESP32-CAM (stream MJPEG + CORS) **pronto**. Botão
> "Preparar ESP32-CAM" no front **pronto**. **Problema do IP RESOLVIDO**: portal
> cativo próprio (sem WiFiManager) que, ao conectar, **mostra o link pronto com o
> IP + botão Copiar** — sem serial, sem IDE, funciona no Windows. Falta **testar
> na placa** o novo firmware e **rebuildar o `.merged.bin`**. Branch:
> `277-feat-camera-externa-esp32cam-visao`.

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

## O problema do IP — RESOLVIDO (2026-06-22)

Depois de configurar o WiFi, a câmera entra na rede com um IP do DHCP — único por
placa/rede e variável. Não dá pra fixar IP nenhum; o usuário leigo não pode
depender do Monitor Serial pra descobri-lo.

**Solução implementada: portal cativo próprio (substituiu o WiFiManager).** A placa
fica em **AP+STA**: ao receber a senha, conecta na rede do usuário **mantendo a
página do portal aberta**, que faz polling em `/status` e, ao conectar, **exibe o
link pronto `http://<ip>:81/stream` + botão Copiar**. Funciona em qualquer SO
(inclusive Windows), sem serial, sem IDE, sem instalar Bonjour. Credenciais salvas
em NVS (`Preferences`); boots seguintes conectam direto, sem portal.

- O WiFiManager foi removido porque fecha o portal ao conectar e não consegue
  mostrar o IP resultante. Sem libs externas agora (só o core esp32).
- **mDNS (`esp32cam-visao.local`) mantido como bônus** pra quem ele resolve. Não
  é mais o caminho crítico — o link com IP do portal é o garantido.
- (Daqui do dev não dá pra testar a rede do usuário: o WSL fica em rede NAT
  isolada `172.31.x` e não enxerga a LAN `192.168.15.x` — por isso o teste na
  placa é com o usuário.)

## Próximos passos

1. **Testar o novo firmware na placa** (portal próprio): conectar em
   `ESP32CAM-Setup`, configurar o WiFi, confirmar que a tela mostra o link com IP
   e que o stream abre por ele no BIPES. Depois **rebuildar o `.merged.bin`**
   (Export Compiled Binary + merge — ver README).
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
