var MSG = {
  title: "BIPES",
  blocks: "Blocks",
  files: "Files",
  shared: "Shared",
  device: "Device",
  linkTooltip: "Save and link to blocks.",
  runTooltip: "Run the program defined by the blocks in the workspace.",
  badCode: "Program error:\n%1",
  timeout: "Maximum execution iterations exceeded.",
  trashTooltip: "Discard all blocks.",
  catLogic: "Logic",
  catLoops: "Loops",
  catMath: "Math",
  catText: "Text",
  catLists: "Lists",
  catColour: "Colour",
  catVariables: "Created variables",
  catFunctions: "Created functions",
  listVariable: "list",
  textVariable: "text",
  cattextVariable: "Text",
  catbooleanVariable: "Bolean",
  catnumericVariable: "Numeric",
  catlistVariable: "List",
  cattextFuncions: "Text",
  catlistFunctions: "Lists",
  httpRequestError: "There was a problem with the request.",
  linkAlert: "Share your blocks with this link:\n\n%1",
  hashError: "Sorry, '%1' doesn't correspond with any saved program.",
  xmlError: "Could not load your saved file. Perhaps it was created with a different version of Blockly?",
  badXml: "Error parsing XML:\n%1\n\nSelect 'OK' to abandon your changes or 'Cancel' to further edit the XML.",
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
  block_delay: "delay",
  seconds: "seconds",
  milliseconds: "milliseconds",
  microseconds: "microseconds",
  microseconds: "microseconds",
  nanoseconds: "nanoseconds",
  cpu_ticks: "CPU cycles",
  to: "to",
  setpin: "set output pin",
  pin: "pin",
  read_digital_pin: "read digital input",
  read_analog_pin: "read analog input",
  show_iot: "show on IoT tab",
  data: "value",
  set_rtc: "set date and time",
  get_rtc: "get date and time",
  year: "year",
  month: "month",
  day: "day",
  hour: "hour",
  minute: "minute",
  second: "second",
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
  try1: "try",
  exp1: "except",
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
  start_thread: "start parallel task with function",

  //categoria temporizador
  get: "get counter in",
  counter: "counter",
  by: "by",
  by2: "to",
  sum_time: "add time",
  diff_time: "time difference from",
  timer: "timer n°",
  do_timer: "execute",
  every_timer: "every",
  once_in: "once in",
  until_deadline: "until deadline nº",
  of: "of",
  do: "execute",
  stop_timer: "stop timer",
  deep_sleep: "deep sleep",

  //Categoria Comunicação
  //Bluetooth
  configure_bluetooth: "Configure and start Bluetooth with name",
  handle_ble: "Set received bluetooth data to",
  check_ble: "Check received data",
  configure_data_plotter: "Configure plotter for sensors",
  call_format_plotter: "Send data to the plotter",
  bluetooth_name: "myBluetooth",

  //espnow
  initialize_wlan_title: "Initialize WLAN Interface",
  get_mac_address_title: "Get MAC Address of Amado Board",
  set_master_title: "Configure Amado Board as Master",
  add_peer_title: "Add Device by MAC Address",
  receive_message_title: "Receive Messages from Devices",
  set_peer_title: "Set Amado Board as Secondary Device",
  send_message_to_peer_title: "Send Message to Device by MAC",
  send_message_title: "Send Message to Master Device",
  receive_message_master_title: "Receive Messages from Master Device",
  variable_list: "Variable list",
  add_variable_container: "Add variable",
  variable_name: "Variable name",
  variable_value: "Variable value ",
  if: "If",
  is_none: "is None, set",
  default_value: "to default value",

  //Blocos lógica
  math_min_title: "Minimum between",
  math_max_title: "Maximum between",
  and: "and",
  //Blocos operadores
  var_to_int_title: "To int",
  var_to_float_title: "To float",

  //Blocos para funções de texto
  to_string_title: "To text",

  //Blocos para as funções da categoria Python
  os_error: "Except OSError",

  //Blocos para os pinos de entrada/saida
  analog_amado_board: "Read analog input",
  attenuation: "Attenuation: ",
  width: "Width: ",
  frequency: "Frequency",
  frequency2: "frequency",
  duty: "Duty",
  init_pwm: "init",
  deinit_pwm: "Deactivate PWM #",
  pins: "pins",
  external_event: "External event (interrupt on input pin)",
  trigger: "Trigger: ",
  irq_falling: "IRQ_FALLING",
  irq_rising: "IRQ_RISING",
  both: "IRQ_FALLING and IRQ_RISING",

  //Sensor ultrassônico
  hcsr04_title: "Initialize HCSR04 ultrasonic sensor",
  get_distance_hcsr04: "Get distance",
  echo_pin: "Echo pin",
  trigger_pin: "Trigger pin",
  timeout_hcsr04: "Timeout (μs)",
  //acelerometro e giroscopio
  mpu6050_init: "Initialize MPU6050 accelerometer and gyroscope sensor",
  mpu6050_read_acc_x: "Read acceleration on X axis",
  mpu6050_read_acc_y: "Read acceleration on Y axis",
  mpu6050_read_acc_z: "Read acceleration on Z axis",
  mpu6050_read_gyro_x: "Read angular velocity on X axis",
  mpu6050_read_gyro_y: "Read angular velocity on Y axis",
  mpu6050_read_gyro_z: "Read angular velocity on Z axis",


    
//Network
  net_http_get: "HTTP GET Request",
  net_http_get_status: "HTTP Status code",
  net_http_get_content: "HTTP Response content",
  net_http_server_start: "Start HTTP Web Server",
  net_http_server_start_port: "Port",
  net_http_server_wait: "Wait for HTTP Client",
  net_http_server_requested_page: "Requested Web Page",
  net_http_server_send_response: "Send HTTP Response",
  net_http_server_send_html: "HTML",

//Splash screen
  splash_welcome: "Welcome to BIPES!",
  splash_footer: "Do not show this screen again",
  splash_close: "Close",
  splash_message: "<p><b>BIPES: Block based Integrated Platform for Embedded Systems</B> allows text and block based programming for several types of embedded systems and Internet of Things modules using MicroPython, CircuitPython, Python or Snek. You can connect, program, debug and monitor several types of boards using network, USB or Bluetooth. Please check a list of <a href=https://bipes.net.br/wp/boards/>compatible boards here</a>. Compatible boards include STM32, ESP32, ESP8266, Raspberry Pi Pico and even Arduino.  <p><b>BIPES</b> is fully <a href=https://bipes.net.br/wp/development/>open source</a> and based on HTML and JavaScript, so no software install or configuration is needed and you can use it offline! We hope BIPES is useful for you and that you can enjoy using BIPES. If you need help, we now have a <a href=https://github.com/BIPES/BIPES/discussions>discussion forum</a>, where we also post <a href=https://github.com/BIPES/BIPES/discussions/categories/announcements>new features and announcements about BIPES</a>. Feel free to use it! Also, we invite you to use the forum to leave feedbacks and suggestions for BIPES!</p><p>Now you can easily load MicroPython on your ESP32 or ESP8226 to use with BIPES: <a href=https://bipes.net.br/flash/esp-web-tools/>https://bipes.net.br/flash/esp-web-tools/</a></p><p>Checkout BIPES Book at <a href=https://bipes.net.br/wp/book-livro/>https://bipes.net.br/wp/book-livro/</a></p> <p>Thank you from the BIPES Team!</p>"

  

};

//Toolbox categories
Blockly.Msg['CAT_CONTROL'] = "Control";
Blockly.Msg['CAT_LOOPS'] = "Loops";
Blockly.Msg['CAT_TIMING'] = "Timing";
Blockly.Msg['CAT_INOUT'] = "Input/output pins";
Blockly.Msg['CAT_DISPLAYS'] = "Displays";
Blockly.Msg['CAT_SENSORS'] = "Sensors";
Blockly.Msg['CAT_OUTPUTS'] = "Outputs / Actuators";
Blockly.Msg['CAT_COMM'] = "Communication";
Blockly.Msg['CAT_FILES'] = "Files";
Blockly.Msg['CAT_NET'] = "Network and Internet";
Blockly.Msg['CAT_OPERATORS'] = "Operators";
Blockly.Msg['CAT_VARIABLES'] = "Variables";
Blockly.Msg['CAT_FUNCTIONS'] = "Functions";
Blockly.Msg['CAT_DHT11/22'] = "Temperature and humidity";
Blockly.Msg['CAT_ULTRASONIC'] = "Ultrasonic";
Blockly.Msg['CAT_ACCELEROMETER'] = "Accelerometer and Gyroscope";
Blockly.Msg['CAT_RFID'] = "RFID reader";
Blockly.Msg['CAT_OLEDDISPLAY'] = "OLED display";
Blockly.Msg['CAT_RELAY'] = "Relay module";
Blockly.Msg['CAT_SERVO'] = "Servo motor";
Blockly.Msg['CAT_DCMOTOR'] = "DC motor";
Blockly.Msg['CAT_BUZZER'] = "Buzzer";
Blockly.Msg['CAT_WIFI'] = "Wifi";
Blockly.Msg['CAT_HTTPCLIENT'] = "HTTP client";
Blockly.Msg['CAT_HTTPSERVER'] = "HTTP server";
