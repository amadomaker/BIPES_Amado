/*
 * esp32cam_visao — firmware enxuto da ESP32-CAM para a aba Visão do BIPES.
 *
 * Faz SÓ o necessário: serve um stream MJPEG em http://<ip>:81/stream com o
 * header CORS que o navegador exige pra o MediaPipe ler os pixels. Sem página
 * web pesada, sem detecção de rosto — esse peso morto é o que derruba o FPS no
 * exemplo padrão (CameraWebServer).
 *
 * O vídeo é só pra alimentar o MediaPipe, que reduz a imagem internamente, então
 * rodamos de propósito em resolução baixa (QVGA) e bem comprimido: baixa latência
 * e a detecção não perde nada. Para mais nitidez (e mais delay) use FRAMESIZE_VGA.
 *
 * WiFi via PORTAL CATIVO PRÓPRIO (sem WiFiManager): no 1º uso a placa cria a rede
 * "ESP32CAM-Setup". O usuário conecta nela (PC ou celular), a página de config
 * abre sozinha, ele escolhe a rede dele e digita a senha. A placa entra em
 * AP+STA: conecta na rede do usuário MAS mantém a página aberta, que fica
 * "Conectando..." e, ao conectar, MOSTRA O LINK PRONTO COM O IP
 * (http://<ip>:81/stream) + botão Copiar. O usuário copia e cola no BIPES — sem
 * precisar do Monitor Serial nem descobrir IP. Credenciais ficam salvas (NVS);
 * nos boots seguintes a placa conecta direto, sem portal.
 *
 * (WiFiManager foi trocado porque ele fecha o portal ao conectar e não consegue
 *  mostrar o IP resultante. Improv-Serial já tinha sido abandonado antes:
 *  detecção instável em ESP32 — problema conhecido do esp-web-tools.)
 *
 * mDNS (bônus): a câmera responde também em http://esp32cam-visao.local:81/stream
 * pra quem tem mDNS funcionando (Apple/Android/Bonjour). Em Windows pelado pode
 * não resolver — por isso o link com IP do portal é o caminho garantido.
 *
 * Dependências: nenhuma externa (WiFi, WebServer, DNSServer, ESPmDNS e
 * Preferences já vêm no core do ESP32).
 * Placa: AI-Thinker ESP32-CAM (PSRAM habilitada).
 */

#include "esp_camera.h"
#include <WiFi.h>
#include <ESPmDNS.h>
#include <DNSServer.h>
#include <WebServer.h>
#include <Preferences.h>
#include "esp_http_server.h"

// Nome da rede de configuração e nome mDNS
#define SETUP_AP_NAME   "ESP32CAM-Setup"
#define MDNS_HOSTNAME   "esp32cam-visao"

// ── Pinos da AI-Thinker ESP32-CAM ─────────────────────────────
#define PWDN_GPIO_NUM     32
#define RESET_GPIO_NUM    -1
#define XCLK_GPIO_NUM      0
#define SIOD_GPIO_NUM     26
#define SIOC_GPIO_NUM     27
#define Y9_GPIO_NUM       35
#define Y8_GPIO_NUM       34
#define Y7_GPIO_NUM       39
#define Y6_GPIO_NUM       36
#define Y5_GPIO_NUM       21
#define Y4_GPIO_NUM       19
#define Y3_GPIO_NUM       18
#define Y2_GPIO_NUM        5
#define VSYNC_GPIO_NUM    25
#define HREF_GPIO_NUM     23
#define PCLK_GPIO_NUM     22

// ── Estado global ─────────────────────────────────────────────
DNSServer dnsServer;
WebServer server(80);          // portal de configuração (porta 80)
Preferences prefs;
static bool portalActive = false;
static bool streamStarted = false;

// ── Stream MJPEG (porta 81) ───────────────────────────────────
#define PART_BOUNDARY "123456789000000000000987654321"
static const char* STREAM_CONTENT_TYPE = "multipart/x-mixed-replace;boundary=" PART_BOUNDARY;
static const char* STREAM_BOUNDARY     = "\r\n--" PART_BOUNDARY "\r\n";
static const char* STREAM_PART         = "Content-Type: image/jpeg\r\nContent-Length: %u\r\n\r\n";

static httpd_handle_t stream_httpd = NULL;

static esp_err_t stream_handler(httpd_req_t* req) {
  camera_fb_t* fb = NULL;
  esp_err_t res = ESP_OK;
  char part_buf[64];

  res = httpd_resp_set_type(req, STREAM_CONTENT_TYPE);
  if (res != ESP_OK) return res;

  // O header que destrava o MediaPipe de ler os pixels (sem isto: canvas
  // "tainted" / SecurityError no front).
  httpd_resp_set_hdr(req, "Access-Control-Allow-Origin", "*");

  while (true) {
    fb = esp_camera_fb_get();
    if (!fb) { res = ESP_FAIL; break; }

    if (res == ESP_OK)
      res = httpd_resp_send_chunk(req, STREAM_BOUNDARY, strlen(STREAM_BOUNDARY));
    if (res == ESP_OK) {
      size_t hlen = snprintf(part_buf, sizeof(part_buf), STREAM_PART, fb->len);
      res = httpd_resp_send_chunk(req, part_buf, hlen);
    }
    if (res == ESP_OK)
      res = httpd_resp_send_chunk(req, (const char*)fb->buf, fb->len);

    esp_camera_fb_return(fb);
    fb = NULL;
    if (res != ESP_OK) break;   // cliente desconectou
  }
  return res;
}

static void startStreamServer() {
  httpd_config_t config = HTTPD_DEFAULT_CONFIG();
  config.server_port = 81;
  config.ctrl_port   = 81;

  httpd_uri_t stream_uri = {
    .uri      = "/stream",
    .method   = HTTP_GET,
    .handler  = stream_handler,
    .user_ctx = NULL
  };

  if (httpd_start(&stream_httpd, &config) == ESP_OK) {
    httpd_register_uri_handler(stream_httpd, &stream_uri);
  }
}

static bool initCamera() {
  camera_config_t config = {};   // zera a struct: campos não setados (ex. sccb_i2c_port) com lixo fazem o probe falhar (0x105)
  config.ledc_channel = LEDC_CHANNEL_0;
  config.ledc_timer   = LEDC_TIMER_0;
  config.pin_d0       = Y2_GPIO_NUM;
  config.pin_d1       = Y3_GPIO_NUM;
  config.pin_d2       = Y4_GPIO_NUM;
  config.pin_d3       = Y5_GPIO_NUM;
  config.pin_d4       = Y6_GPIO_NUM;
  config.pin_d5       = Y7_GPIO_NUM;
  config.pin_d6       = Y8_GPIO_NUM;
  config.pin_d7       = Y9_GPIO_NUM;
  config.pin_xclk     = XCLK_GPIO_NUM;
  config.pin_pclk     = PCLK_GPIO_NUM;
  config.pin_vsync    = VSYNC_GPIO_NUM;
  config.pin_href     = HREF_GPIO_NUM;
  config.pin_sccb_sda = SIOD_GPIO_NUM;
  config.pin_sccb_scl = SIOC_GPIO_NUM;
  config.pin_pwdn     = PWDN_GPIO_NUM;
  config.pin_reset    = RESET_GPIO_NUM;
  config.xclk_freq_hz = 20000000;
  config.pixel_format = PIXFORMAT_JPEG;

  // Latência baixa de propósito: quadro pequeno + bem comprimido = trafega rápido
  // no WiFi e o navegador não acumula atraso. MediaPipe não aproveita mais que isso.
  // Se quiser mais nitidez (e aceitar mais delay): FRAMESIZE_VGA / jpeg_quality 12.
  config.frame_size   = FRAMESIZE_QVGA;  // 320x240
  config.jpeg_quality = 18;              // leve = real-time neste WiFi. Baixar p/ 12-14 melhora a imagem MAS o delay dispara (3-5s): a vazão do WiFi não escoa o quadro maior e os frames empilham.
  config.grab_mode    = CAMERA_GRAB_LATEST;

  if (psramFound()) {
    config.fb_count     = 2;
    config.fb_location  = CAMERA_FB_IN_PSRAM;
  } else {
    // Sem PSRAM cai a resolução pra não estourar a RAM.
    config.frame_size   = FRAMESIZE_QVGA;
    config.fb_count     = 1;
    config.fb_location  = CAMERA_FB_IN_DRAM;
  }

  esp_err_t err = esp_camera_init(&config);
  if (err != ESP_OK) {
    Serial.printf("Falha ao iniciar a camera: 0x%x\n", err);
    return false;
  }
  return true;
}

// Liga câmera + mDNS + stream uma única vez, depois que o WiFi conectou.
static void startNormalServices() {
  if (streamStarted) return;
  if (!initCamera()) return;

  if (MDNS.begin(MDNS_HOSTNAME)) {
    MDNS.addService("http", "tcp", 81);
  }
  startStreamServer();
  streamStarted = true;

  Serial.print("Stream pronto: http://");
  Serial.print(WiFi.localIP());
  Serial.print(":81/stream   (ou http://");
  Serial.print(MDNS_HOSTNAME);
  Serial.println(".local:81/stream)");
}

// ── Páginas do portal cativo ──────────────────────────────────
static const char* PAGE_STYLE =
  "<style>body{font-family:system-ui,sans-serif;background:#111;color:#eee;margin:0;padding:24px;max-width:480px}"
  "h1{font-size:20px}label{display:block;margin:14px 0 4px}"
  "select,input{width:100%;padding:11px;border-radius:8px;border:1px solid #444;background:#222;color:#eee;box-sizing:border-box;font-size:15px}"
  "button{margin-top:18px;width:100%;padding:13px;border:0;border-radius:8px;background:#2dd17a;color:#08231a;font-weight:700;font-size:16px;cursor:pointer}"
  ".hint{color:#999;font-size:13px;margin-top:16px;line-height:1.5}a{color:#2dd17a}</style>";

static String htmlConfigPage() {
  int n = WiFi.scanNetworks();
  String opts;
  for (int i = 0; i < n; i++) {
    opts += "<option value='" + WiFi.SSID(i) + "'>" + WiFi.SSID(i) +
            " (" + String(WiFi.RSSI(i)) + " dBm)</option>";
  }
  if (opts.length() == 0)
    opts = "<option value=''>(nenhuma rede encontrada)</option>";

  String p = "<!doctype html><html lang=pt><head><meta charset=utf-8>"
             "<meta name=viewport content='width=device-width,initial-scale=1'>"
             "<title>Configurar ESP32-CAM</title>";
  p += PAGE_STYLE;
  p += "</head><body><h1>Conectar a câmera ao seu WiFi</h1>"
       "<form method=POST action=/save>"
       "<label>Rede WiFi</label><select name=ssid>" + opts + "</select>"
       "<label>Senha</label><input type=password name=pass placeholder='senha do WiFi'>"
       "<button type=submit>Conectar</button></form>"
       "<p class=hint>Escolha a sua rede de casa e digite a senha. A câmera vai "
       "conectar e mostrar o <b>link pronto</b> pra você copiar.<br>"
       "Obs.: só aparecem redes de <b>2,4 GHz</b> (a ESP32 não enxerga 5 GHz).</p>"
       "</body></html>";
  return p;
}

static String htmlWaitPage() {
  String p = "<!doctype html><html lang=pt><head><meta charset=utf-8>"
             "<meta name=viewport content='width=device-width,initial-scale=1'>"
             "<title>Conectando...</title>";
  p += PAGE_STYLE;
  p += "</head><body>"
       "<h1 id=t>Conectando...</h1>"
       "<p id=msg>Aguarde, conectando na sua rede.</p>"
       "<div id=ok style='display:none'>"
       "<p>✅ Conectado! Link da câmera:</p>"
       "<input id=url readonly onclick='this.select()'>"
       "<button onclick='copiar()'>Copiar link</button>"
       "<p class=hint>Cole esse link no campo de URL da ESP32-CAM no BIPES "
       "(aba Visão → fonte ESP32-CAM).</p></div>"
       "<script>"
       "let tries=0;"
       "function copiar(){var u=document.getElementById('url');u.select();"
       "if(navigator.clipboard)navigator.clipboard.writeText(u.value);"
       "else document.execCommand('copy');}"
       "function poll(){fetch('/status').then(r=>r.json()).then(d=>{"
       "if(d.connected){document.getElementById('t').textContent='Pronto!';"
       "document.getElementById('msg').style.display='none';"
       "document.getElementById('url').value='http://'+d.ip+':81/stream';"
       "document.getElementById('ok').style.display='block';return;}"
       "tries++;if(tries>20){document.getElementById('t').textContent='Não conectou';"
       "document.getElementById('msg').innerHTML='Verifique a senha. "
       "<a href=/>Tentar de novo</a>.';return;}"
       "setTimeout(poll,1500);}).catch(e=>setTimeout(poll,1500));}"
       "poll();</script></body></html>";
  return p;
}

// ── Handlers do portal ────────────────────────────────────────
static void handleRoot()  { server.send(200, "text/html", htmlConfigPage()); }

static void handleSave() {
  String ssid = server.arg("ssid");
  String pass = server.arg("pass");
  if (ssid.length()) {
    prefs.putString("ssid", ssid);
    prefs.putString("pass", pass);
    WiFi.begin(ssid.c_str(), pass.c_str());   // conecta sem derrubar o AP (AP+STA)
  }
  server.send(200, "text/html", htmlWaitPage());
}

static void handleStatus() {
  String json = "{";
  if (WiFi.status() == WL_CONNECTED) {
    startNormalServices();   // liga câmera + stream na 1ª vez que conecta
    json += "\"connected\":true,\"ip\":\"" + WiFi.localIP().toString() + "\"";
  } else {
    json += "\"connected\":false";
  }
  json += "}";
  server.send(200, "application/json", json);
}

// Qualquer URL desconhecida devolve a página de config → dispara o popup de
// "fazer login na rede" do sistema (comportamento de portal cativo).
static void handleNotFound() { server.send(200, "text/html", htmlConfigPage()); }

static void startConfigPortal() {
  WiFi.mode(WIFI_AP_STA);
  WiFi.softAP(SETUP_AP_NAME);
  IPAddress apIP = WiFi.softAPIP();
  dnsServer.start(53, "*", apIP);

  server.on("/", handleRoot);
  server.on("/save", HTTP_POST, handleSave);
  server.on("/status", handleStatus);
  server.onNotFound(handleNotFound);
  server.begin();
  portalActive = true;

  Serial.print("Portal aberto: conecte no WiFi '");
  Serial.print(SETUP_AP_NAME);
  Serial.print("' e abra http://");
  Serial.println(apIP);
}

void setup() {
  Serial.begin(115200);
  Serial.setDebugOutput(false);

  prefs.begin("wifi", false);
  String ssid = prefs.getString("ssid", "");
  String pass = prefs.getString("pass", "");

  // Já configurado antes? Tenta conectar direto, sem portal.
  if (ssid.length()) {
    WiFi.mode(WIFI_STA);
    WiFi.begin(ssid.c_str(), pass.c_str());
    unsigned long t0 = millis();
    while (WiFi.status() != WL_CONNECTED && millis() - t0 < 15000) delay(250);
    if (WiFi.status() == WL_CONNECTED) {
      startNormalServices();
      return;
    }
    // Falhou (mudou de rede/senha errada) → cai no portal.
  }

  startConfigPortal();
}

void loop() {
  if (portalActive) {
    dnsServer.processNextRequest();
    server.handleClient();
  } else {
    delay(1000);
  }
}
