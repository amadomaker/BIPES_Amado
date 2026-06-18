/*
 * esp32cam_visao — firmware enxuto da ESP32-CAM para a aba Visão do BIPES.
 *
 * Faz SÓ o necessário: serve um stream MJPEG em http://<ip>:81/stream com o
 * header CORS que o navegador exige pra o MediaPipe ler os pixels. Sem página
 * web, sem detecção de rosto — esse peso morto é o que derruba o FPS no
 * exemplo padrão (CameraWebServer).
 *
 * O vídeo é só pra alimentar o MediaPipe, que reduz a imagem internamente, então
 * rodamos de propósito em resolução baixa (VGA) e bem comprimido: fica fluido e
 * a detecção não perde nada. Para mais FPS troque FRAMESIZE_VGA por FRAMESIZE_QVGA.
 *
 * WiFi via PORTAL CATIVO (WiFiManager): no 1º uso a placa cria a rede
 * "ESP32CAM-Setup"; o usuário conecta nela (PC ou celular), abre sozinho uma
 * página, escolhe a rede dele e digita a senha. A placa salva, conecta e nos
 * boots seguintes reconecta sozinha. (Improv-Serial foi abandonado: detecção
 * instável demais em ESP32 — problema conhecido do esp-web-tools.)
 *
 * mDNS: a câmera responde também em http://esp32cam-visao.local:81/stream,
 * então a aba Visão não precisa saber o IP.
 *
 * Dependências (Library Manager):
 *   - "WiFiManager" (tzapu)
 * Placa: AI-Thinker ESP32-CAM (PSRAM habilitada).
 */

#include "esp_camera.h"
#include <WiFi.h>
#include <ESPmDNS.h>
#include <WiFiManager.h>
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

// ── Stream MJPEG ──────────────────────────────────────────────
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

  // Resolução baixa de propósito: MediaPipe não aproveita mais que isso e
  // VGA mantém o stream fluido. Use FRAMESIZE_QVGA se quiser ainda mais FPS.
  config.frame_size  = FRAMESIZE_VGA;   // 640x480
  config.jpeg_quality = 12;             // 10–15: maior = mais comprimido = mais leve
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

void setup() {
  Serial.begin(115200);
  Serial.setDebugOutput(false);

  // Portal cativo: conecta com credenciais salvas; se não tiver, abre a rede
  // "ESP32CAM-Setup" e bloqueia até o usuário configurar pelo navegador.
  WiFiManager wm;
  wm.setConfigPortalTimeout(180);   // 3 min; se ninguém configurar, reinicia e tenta de novo
  if (!wm.autoConnect(SETUP_AP_NAME)) {
    Serial.println("Sem WiFi configurado/conectado — reiniciando...");
    delay(2000);
    ESP.restart();
  }

  // Conectado. Inicializa câmera só agora (poupa RAM durante o portal).
  if (!initCamera()) return;

  // mDNS: permite acessar por http://esp32cam-visao.local:81/stream sem saber o IP.
  if (MDNS.begin(MDNS_HOSTNAME)) {
    MDNS.addService("http", "tcp", 81);
  }

  startStreamServer();

  Serial.print("Stream pronto: http://");
  Serial.print(WiFi.localIP());
  Serial.print(":81/stream   (ou http://");
  Serial.print(MDNS_HOSTNAME);
  Serial.println(".local:81/stream)");
}

void loop() {
  delay(1000);
}
