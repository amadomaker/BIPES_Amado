# Firmware ESP32-CAM — aba Visão

Firmware enxuto que serve **só** o stream MJPEG da ESP32-CAM com header CORS,
pra usar como câmera externa na aba Visão do BIPES (no lugar da webcam do
notebook). Sem página web e sem detecção de rosto — isso é o que pesa no exemplo
padrão e derruba o FPS.

## Gravar

1. Abrir `esp32cam_visao.ino` na Arduino IDE.
2. Instalar o core **esp32** (Espressif) se ainda não tiver.
3. Em **Ferramentas**:
   - Placa: **AI Thinker ESP32-CAM**
   - PSRAM: **Enabled**
4. Gravar (com o ESP32-CAM-MB o reset/boot é automático; com gravador FTDI
   avulso é GPIO0 no GND pra gravar, depois soltar e dar RST).

Sem libs externas: o portal usa só o que vem no core esp32 (`WiFi`, `WebServer`,
`DNSServer`, `ESPmDNS`, `Preferences`). O WiFiManager foi removido.

## Configurar o WiFi (portal cativo) e pegar a URL

O WiFi **não** é hardcoded — é configurado por **portal cativo próprio**. O ponto
forte: ao conectar, a placa **mostra o link pronto com o IP** pra você copiar, sem
precisar do Monitor Serial nem descobrir IP (funciona até no Windows, onde o mDNS
às vezes não resolve). Improv-Serial foi abandonado antes: detecção instável demais
em ESP32 (problema conhecido do esp-web-tools). Fluxo:

1. Ligar a placa. No 1º uso (ou se não houver WiFi salvo) ela cria a rede
   **`ESP32CAM-Setup`**.
2. Conectar o PC/celular nessa rede → abre sozinha a página de configuração.
3. Escolher a rede WiFi (2,4 GHz) + senha → **Conectar**.
4. A placa entra em AP+STA: conecta na sua rede **mantendo a página aberta**, que
   passa de "Conectando..." para **"Pronto!"** e exibe
   **`http://<ip>:81/stream`** + botão **Copiar link**.
5. Copiar o link e colar no campo de URL da ESP32-CAM na aba Visão.

Alternativa (mDNS, bônus): **`http://esp32cam-visao.local:81/stream`** funciona pra
quem tem mDNS (Apple/Android/Bonjour). Já vem pré-preenchido no modal, mas o link
com IP do portal é o caminho garantido.

Nos boots seguintes a placa reconecta sozinha com as credenciais salvas (NVS), sem
abrir o portal.

## Gerar o binário para o botão "Preparar ESP32-CAM" (ESP Web Tools)

O botão na aba Visão usa **ESP Web Tools**, que grava um `.bin` pronto pela serial
no navegador (mesma ideia do instalador de MicroPython). Ele lê o `manifest.json`
desta pasta, que aponta para `esp32cam_visao.merged.bin`. Esse binário **não está
versionado** (é artefato de build) — gere assim:

1. Na Arduino IDE: **Sketch → Export Compiled Binary**. Isso gera, na subpasta
   `build/.../`, três arquivos:
   - `esp32cam_visao.ino.bootloader.bin`
   - `esp32cam_visao.ino.partitions.bin`
   - `esp32cam_visao.ino.bin` (a aplicação)
2. Pegue também o `boot_app0.bin` do core esp32 (vem com o pacote da Espressif).
3. Junte tudo num único binário com o esptool:

   ```bash
   esptool --chip esp32 merge_bin -o esp32cam_visao.merged.bin \
     --flash_mode dio --flash_freq 40m --flash_size 4MB \
     0x1000  esp32cam_visao.ino.bootloader.bin \
     0x8000  esp32cam_visao.ino.partitions.bin \
     0xe000  boot_app0.bin \
     0x10000 esp32cam_visao.ino.bin
   ```

4. Coloque o `esp32cam_visao.merged.bin` **nesta pasta** (ao lado do
   `manifest.json`), e garanta que ela é servida pelo site em
   `/firmware/esp32cam_visao/` (a aba Visão aponta para
   `../firmware/esp32cam_visao/manifest.json` — constante `ESP_MANIFEST_URL` em
   `gesture-control/gesture-control.js`).

Pronto: o botão **só grava** o firmware (`"improv": false`). A configuração de
WiFi é feita depois pelo portal cativo (ver seção acima). A URL via mDNS já vem
pré-preenchida no modal.

> ESP Web Tools exige **https** (ou localhost). Na plataforma no ar funciona; em
> teste local use `http://localhost`, não o IP da LAN.

## Ajuste de FPS

- `config.frame_size` — `FRAMESIZE_VGA` (640x480) é o padrão. Para mais fluidez:
  `FRAMESIZE_QVGA` (320x240). O MediaPipe não aproveita mais que isso.
- `config.jpeg_quality` — 10–15. Número **maior** = mais compressão = frame mais
  leve = mais rápido.

