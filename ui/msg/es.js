var MSG = {
  title: "BIPES",
  blocks: "Bloques",
  files: "Files",
  shared: "Shared",
  device: "Device",
  linkTooltip: "Guarda conexión a los bloques.",
  runTooltip: "Ejecute el programa definido por los bloques en el área de trabajo.",
  badCode: "Error del programa:\n%1",
  timeout: "Se excedio el máximo de iteraciones ejecutadas permitidas.",
  trashTooltip: "Descartar todos los bloques.",
  catLogic: "Lógica",
  catLoops: "Secuencias",
  catMath: "Matemáticas",
  catText: "Texto",
  catLists: "Listas",
  catColour: "Color",
  catVariables: "Variables creadas",
  catFunctions: "Funciones creadas",
  listVariable: "lista",
  textVariable: "texto",
  cattextVariable: "Texto",
  catbooleanVariable: "Booleano",
  catnumericVariable: "Numerico",
  catlistVariable: "Lista",
  cattextFuncions: "Texto",
  catlistFunctions: "Listas",
  httpRequestError: "Hubo un problema con la petición.",
  linkAlert: "Comparte tus bloques con este enlace:\n\n%1",
  hashError: "«%1» no corresponde con ningún programa guardado.",
  xmlError: "No se pudo cargar el archivo guardado.  ¿Quizá fue creado con otra versión de Blockly?",
  badXml: "Error de análisis XML:\n%1\n\nSelecciona OK para abandonar tus cambios o Cancelar para seguir editando el XML.",
  saveTooltip: "Save blocks to file.",
  loadTooltip: "Load blocks from file.",
  notificationTooltip: "Notifications panel.",
  ErrorGET: "Unable to load requested file.",
  invalidDevice: "Invalid device.",
  languageTooltip: "Change language.",
  noToolbox: "The device has no toolbox set.",
  networkTooltip: "Connect through network (WebREPL, http).",
  serialTooltip: "Connect through serial/USB or Bluetooth (Web Serial API, https).",
  toolbarTooltip: "Show toolbar",
  wrongDevicePin: "Check pins, target device changed!",
  notDefined: "not defined",
  editAsFileValue: "Edit as a file",
  editAsFileTooltip: "Edit python code and save to device's filesystem.",
  forumTooltip: "Help forum.",
  accountTooltip: "Your projects and settings.",
  blocksLoadedFromFile: "Blocks loaded from file '%1'.",
  deviceUnavailable: "Device '%1' unavailable.",
  notConnected: "No connection to send data.",
  serialFroozen: "Serial connection is unresponsive.",
  notAvailableFlag: "$1 is not available on your browser.\r\nPlease make sure the $1 flag is enabled.",

//Blocks
  block_delay: "retraso",
  seconds: "segundos",
  milliseconds: "milisegundos",
  microseconds: "microsegundos",
  nanoseconds: "nanosegundos",
  cpu_ticks: "ciclos de CPU",
  to: "a",
  setpin: "set output pin",
  pin: "pin",
  read_digital_pin: "read digital input",
  read_analog_pin: "read analog input",
  show_iot: "show on IoT tab",
  data: "value",
  set_rtc: "establecer fecha y hora",
  get_rtc: "obtener fecha y hora",
  year: "año",
  month: "mes",
  day: "día",
  hour: "hora",
  minute: "minuto",
  second: "segundo",
  wifi_scan: "scan wifi networks",
  wifi_connect: "connect to wifi network",
  wifi_name: "network name",
  wifi_key: "key/password",
  easymqtt_start: "EasyMQTT Start",
  easymqtt_publish: "EasyMQTT Publish Data",
  topic: "topic",
  session_id: "session ID",
  file_open: "open File",
  file_name: "file name",
  file_mode: "mode",
  file_binary: "open in binary mode",
  file_close: "close file",
  file_write_line: "write line to file",
  file_line: "line",
  try1: "intentar",
  exp1: "excepto",  
  ntp_sync: "sync date and time with NTP",
  timezone: "timezone",
  project_info: "Project Info",
  project_info_author: "Author",
  project_info_desc: "Description",
  easymqtt_subscribe: "EasyMQTT subscribe to topic",
  when: "when",
  data_received: "is received",
  easymqtt_receive: "EasyMQTT receive data",
  relay: "relay",
  on: "turn on",
  off: "turn off",
  relay_on: "relay on pin",
  yes: "yes",
  no: "no",
  wait_for_data: "wait for data",
  dht_start: "Start DHT Sensor",
  dht_measure: "update DHT11/22 sensor reading",
  dht_temp: "get DHT11/22 temperature",
  dht_humi: "get DHT11/22 humidity",
  type: "type",
  start_thread: "iniciar tarea paralela con la función",
  
  
  //Categoria temporizador
  get: "obtener contador en",
  counter: "contador",
  by: "con",
  by2: "a",
  sum_time: "sumar tiempo",
  diff_time: "diferencia de tiempo de",
  timer: "temporizador n°",
  do_timer: "ejecutar",
  every_timer: "cada",
  once_in: "una vez en",
  until_deadline: "hasta el tiempo límite nº",
  of: "de",
  do: "ejecutar",
  stop_timer: "detener temporizador",
  deep_sleep: "sueño profundo",


  //Categoria Comunicação
  //Bluetooth
  configure_bluetooth: "Configurar e iniciar el Bluetooth con el nombre",
  handle_ble: "Establecer los datos recibidos a través de bluetooth en",
  check_ble: "Verificar los datos recibidos",
  configure_data_plotter: "Configurar el trazador para sensores",
  call_format_plotter: "Enviar datos al trazador",
  bluetooth_name: "miBluetooth",

  //espnow
  initialize_wlan_title: "Inicializar Interfaz WLAN",
  get_mac_address_title: "Obtener Dirección MAC de la Placa Amado",
  set_master_title: "Configurar la Placa Amado como Maestra",
  add_peer_title: "Agregar Dispositivo por Dirección MAC",
  receive_message_title: "Recibir Mensajes de Dispositivos",
  set_peer_title: "Configurar la Placa Amado como Dispositivo Secundario",
  send_message_to_peer_title: "Enviar Mensaje a un Dispositivo por MAC",
  send_message_title: "Enviar Mensaje al Dispositivo Maestro",
  receive_message_master_title: "Recibir Mensajes del Dispositivo Maestro",
  variable_list: "Lista de variables",
  add_variable_container: "Añadir variable",
  variable_name: "Nombre de la variable",
  variable_value: "Valor de la variable",
  if: "Si",
  is_none: "es None, establecer",
  default_value: "a valor predeterminado",

  //Blocos lógica
  math_min_title: "Mínimo entre",
  math_max_title: "Máximo entre",
  and: "y",
  //Blocos operadores
  var_to_int_title: "A entero",
  var_to_float_title: "A decimal",

  //Blocos para funções de texto
  to_string_title: "A texto",

  //Blocos para as funções da categoria Python
  os_error: "Excepto OSError",

  //Blocos para os pinos de entrada/saida
  analog_amado_board: "Leer entrada analógica",
  attenuation: "Atenuación: ",
  width: "Ancho: ",
  frequency: "Frecuencia",
  frequency: "frecuencia",
  Ddty: "Ciclo de trabajo",
  init_pwm: "Iniciar",
  deinit_pwm: "Desactivar PWM #",
  pins: "pinos",
  external_event: "Evento externo (interrupción en el pin de entrada)",
  trigger: "Disparador: ",
  irq_falling: "CAÍDA DE SEÑAL",
  irq_rising: "SUBIDA DE SEÑAL",
  both: "CAÍDA Y SUBIDA (AMBOS)",

  //Sensor ultrassônico
  hcsr04_title: "Iniciar sensor ultrasónico HCSR04",
  get_distance_hcsr04: "Obtener distancia",
  echo_pin: "Pin de eco",
  trigger_pin: "Pin de disparo",
  timeout_hcsr04: "Tiempo límite (μs)",
  //acelerometro e giroscopio
  mpu6050_init: "Iniciar sensor acelerómetro y giroscopio MPU6050",
  mpu6050_read_acc_x: "Leer aceleración en el eje X",
  mpu6050_read_acc_y: "Leer aceleración en el eje Y",
  mpu6050_read_acc_z: "Leer aceleración en el eje Z",
  mpu6050_read_gyro_x: "Leer velocidad angular en el eje X",
  mpu6050_read_gyro_y: "Leer velocidad angular en el eje Y",
  mpu6050_read_gyro_z: "Leer velocidad angular en el eje Z",

  //Leitor RFID
  rfid_rc522_init_title: "Iniciar lector RFID MFRC522",
  rfid_rc522_detect_card_title: "Verificar si la tarjeta RFID está presente",
  rfid_rc522_anticoll_title: "Obtener identificación de la tarjeta (UID)",
  rfid_rc522_read_card_title: "Leer memoria de la tarjeta RFID",
  rfid_rc522_write_card_title: "Escribir en la memoria de la tarjeta RFID",

  //Display OLED
  init_oled_title: "Iniciar pantalla OLED SSD1306 I2C",
  fill_oled_title: "Rellenar pantalla OLED con",
  clear_oled_title: "Limpiar pantalla OLED",
  show_oled_title: "Actualizar pantalla OLED",
  write_oled_title: "Escribir texto en la pantalla",
  write_oled_int_title: "Mostrar valor en la pantalla",
  x_position: "Posición X",
  y_position: "Posición Y",
  value_display: "Valor",

  //Servo motor
  init_servo_title: "Iniciar motor servo",
  init_servo_name: "Nombre del servo:",
  init_servo_pin: "Pin",
  move_servo_title: "Mover servo",
  move_servo_name: "Nombre del servo",
  move_servo_angle: "Ángulo",
  no_servos: "Ningún servo",
  //DC motor
  dc_motor_init_title: "Iniciar motor de CC",
  dc_motor_pwm_label: "PWM",
  dc_motor_dir1_label: "Dirección 1",
  dc_motor_dir2_label: "Dirección 2",
  dc_motor_name_label: "Nombre del motor:",
  dc_motor_power_title: "Establecer potencia del motor de CC  -",
  dc_motor_power_label: "Potencia",
  dc_motor_direction_title: "Establecer dirección del motor de CC  -",
  dc_motor_direction_label: "Dirección",
  dc_motor_stop_title: "Detener motor de CC",
  
  //Buzzer
  tone_title: "Reproducir zumbador en",
  note_title: "Reproducir zumbador en",
  rttl_play_title: "Reproducir música",
  duration_label: "duración (s): ",
  duration_label2: "(0 para duración infinita)",
  note_label: "nota",
  frequency_label: "frecuencia",
  songs_label: "Canción:",
  melody_label: "melodía",







//Network
  net_http_get: "HTTP GET Request",
  net_http_get_status: "HTTP Status code",
  net_http_get_content: "HTTP Response content",

//Splash screen
  splash_welcome: "Bienvenida a BIPES",
  splash_footer: "Do not show this screen again",
  splash_close: "Close",
  splash_message: "<p><b>BIPES: Block based Integrated Platform for Embedded Systems</B> allows text and block based programming for several types of embedded systems and Internet of Things modules using MicroPython, CircuitPython, Python or Snek. You can connect, program, debug and monitor several types of boards using network, USB or Bluetooth. Please check a list of <a href=https://bipes.net.br/wp/boards/>compatible boards here</a>. Compatible boards include STM32, ESP32, ESP8266, Raspberry Pi Pico and even Arduino.  <p><b>BIPES</b> is fully <a href=https://bipes.net.br/wp/development/>open source</a> and based on HTML and JavaScript, so no software install or configuration is needed and you can use it offline! We hope BIPES is useful for you and that you can enjoy using BIPES. If you need help, we now have a <a href=https://github.com/BIPES/BIPES/discussions>discussion forum</a>, where we also post <a href=https://github.com/BIPES/BIPES/discussions/categories/announcements>new features and announcements about BIPES</a>. Feel free to use it! Also, we invite you to use the forum to leave feedbacks and suggestions for BIPES!</p><p>Now you can easily load MicroPython on your ESP32 or ESP8226 to use with BIPES: <a href=https://bipes.net.br/flash/esp-web-tools/>https://bipes.net.br/flash/esp-web-tools/</a></p> <p>Thank you from the BIPES Team!</p>"

  

};

//Toolbox categories
Blockly.Msg['CAT_CONTROL'] = "Control";
Blockly.Msg['CAT_LOOPS'] = "Secuencias";
Blockly.Msg['CAT_TIMING'] = "Temporización";
Blockly.Msg['CAT_INOUT'] = "Pines de entrada/salida";
Blockly.Msg['CAT_DISPLAYS'] = "Displays";
Blockly.Msg['CAT_SENSORS'] = "Sensors";
Blockly.Msg['CAT_OUTPUTS'] = "Salidas / Actuadores";
Blockly.Msg['CAT_COMM'] = "Comunicación";
Blockly.Msg['CAT_FILES'] = "Files";
Blockly.Msg['CAT_NET'] = "Red y Internet";
Blockly.Msg['CAT_OPERATORS'] = "Operadores";
Blockly.Msg['CAT_VARIABLES'] = "Variables";
Blockly.Msg['CAT_FUNCTIONS'] = "Funciones";
Blockly.Msg['CAT_DHT11/22'] = "Temperatura y humedad";
Blockly.Msg['CAT_ULTRASONIC'] = "Ultrasónico";
Blockly.Msg['CAT_ACCELEROMETER'] = "Acelerómetro y giroscopio";
Blockly.Msg['CAT_RFID'] = "Lector RFID";
Blockly.Msg['CAT_OLEDDISPLAY'] = "Display OLED";
Blockly.Msg['CAT_RELAY'] = "Módulo relé";
Blockly.Msg['CAT_SERVO'] = "Servo motor";
Blockly.Msg['CAT_DCMOTOR'] = "Motor DC";
Blockly.Msg['CAT_BUZZER'] = "Buzzer";
Blockly.Msg['CAT_WIFI'] = "Wifi";
Blockly.Msg['CAT_HTTPCLIENT'] = "cliente HTTP";
Blockly.Msg['CAT_HTTPSERVER'] = "Servidor HTTP";