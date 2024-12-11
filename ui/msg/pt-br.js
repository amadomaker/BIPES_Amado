var MSG = {
  title: "BIPES Beta",
  blocks: "Blocos",
  files: "Arquivos",
  shared: "Compartilhado",
  device: "Dispositivo",
  linkTooltip: "Salvar e ligar aos blocos.",
  runTooltip: "Execute o programa definido pelos blocos na área de trabalho.",
  badCode: "Erro no programa:\n%1",
  timeout: "Máximo de iterações de execução excedido.",
  trashTooltip: "Descartar todos os blocos.",
  catLogic: "Lógica",
  catLoops: "Laços",
  catMath: "Matemática",
  catText: "Texto",
  catLists: "Listas",
  catColour: "Cor",  listVariable: "lista",
  textVariable: "texto",
  catVariables: "Variáveis criadas",
  catFunctions: "Funções criadas",
  cattextVariable: "Texto",
  catbooleanVariable: "Boleanas",
  catnumericVariable: "Numéricas",
  catlistVariable: "Listas",
  cattextFuncions: "Texto",
  catlistFunctions: "Listas",
  httpRequestError: "Houve um problema com a requisição.",
  linkAlert: "Compartilhe seus blocos com este link:\n\n%1",
  hashError: "Desculpe, '%1' não corresponde a um programa salvo.",
  xmlError: "Não foi possível carregar seu arquivo salvo. Talvez ele tenha sido criado com uma versão diferente do Blockly?",
  badXml: "Erro de análise XML:\n%1\n\nSelecione 'OK' para abandonar suas mudanças ou 'Cancelar' para editar o XML.",
  saveTooltip: "Salvar blocos para arquivo.",
  loadTooltip: "Carregar blocos de arquivo.",
  notificationTooltip: "Painel de notificações.",
  ErrorGET: "O arquivo solicitado não carregou.",
  invalidDevice: "Aparelho inválido.",
  languageTooltip: "Mudar idioma.",
  noToolbox: "O aparelho não possui toolbox definida.",
  networkTooltip: "Conectar via rede (WebREPL, http).",
  serialTooltip: "Conectar via serial/USB ou Bluetooth (Web Serial API, https).",
  toolbarTooltip: "Mostrar barra de ferramentas",
  wrongDevicePin: "Verifique os pinos, o aparelho alvo mudou!",
  notDefined: "não definido",
  editAsFileValue: "Editar como arquivo",
  editAsFileTooltip: "Editar código python e salvar para a memória do aparelho.",
  forumTooltip: "Fórum de ajuda.",
  accountTooltip: "Tus proyectos y escenarios.",
  blocksLoadedFromFile: "Blocos carregados do arquivo '%1'.",
  deviceUnavailable: "Aparelho '%1' indisponível.",
  notConnected: "No connection to send data.",
  serialFroozen: "Serial connection is unresponsive.",
  notAvailableFlag: "$1 is not available on your browser.\r\nPlease make sure the $1 flag is enabled.",

//Blocos
  block_delay: "esperar",
  seconds: "segundos",
  milliseconds: "milisegundos",
  microseconds: "microsegundos",
  nanoseconds: "nanosegundos",
  cpu_ticks: "ciclos de CPU",
  to: "para",
  setpin: "ajustar pino de saida",
  pin: "pino",
  read_digital_pin: "ler entrada digital",
  read_analog_pin: "ler entrada analógica",
  show_iot: "mostrar na aba IoT ",
  data: "valor",
  set_rtc: "ajustar data e hora",
  get_rtc: "obter data e hora",
  year: "ano",
  month: "mês",
  day: "dia",
  hour: "hora",
  minute: "minuto",
  second: "segundo",
  wifi_scan: "listar redes wifi",
  wifi_connect: "conectar na rede wifi",
  wifi_name: "nome da rede",
  wifi_key: "senha/chave",
  easymqtt_start: "iniciar EasyMQTT",
  easymqtt_publish: "publicar dado com EasyMQTT",
  topic: "tópico",
  session_id: "Sessão:",
  file_open: "abrir arquivo",
  file_name: "nome do arquivo",
  file_mode: "modo",
  file_binary: "modo binário",
  file_close: "fechar arquivo",
  file_write_line: "escrever linha no arquivo",
  file_line: "linha",
  try1: "tente",
  exp1: "exceto",
  ntp_sync: "sincronizar data e hora com NTP",
  timezone: "fuso horário",
  project_info: "Dados do projeto",
  project_info_author: "Autor",
  project_info_desc: "Descrição",
  easymqtt_subscribe: "incrição no tópico EasyMQTT",
  easymqtt_receive: "receber dados EasyMQTT",
  when: "quando",
  data_received: "for recebido",
  relay: "rele",
  on: "ligar",
  off: "desligar",
  relay_on: "rele no pino",
  yes: "sim",
  no: "não",
  wait_for_data: "esperar por dados",
  dht_start: "Iniciar sensor DHT11/22",
  dht_measure: "atualizar leitura do sensor DHT11/22",
  dht_temp: "temperatura do DHT11/22",
  dht_humi: "umidade do DHT11/22",
  type: "modelo",
  start_thread: "iniciar tarefa paralela com a função",
  
  //categoria temporizador
  get: "obter contador em",
  counter: "contador",
  by: "com",
  by2: "para",
  sum_time: "somar tempo",
  diff_time: "diferença de tempo de",
  timer: "temporizador n°",
  do_timer: "executar",
  every_timer: "a cada",
  once_in: "uma vez em",
  until_deadline: "até o tempo limite nº",
  of: "de",
  do: "executar",
  stop_timer: "parar temporizador",
  deep_sleep: "sono profundo",

  //Categoria Comunicação
  //Bluetooth
  configure_bluetooth: "Configura e inicia o Bluetooth com o nome",
  handle_ble: "Definir os dados recebidos via bluetooth para",
  check_ble: "Verificar os dados recebidos",
  configure_data_plotter: "Configurar o plotador para sensores",
  call_format_plotter: "Enviar dados para o plotador",
  bluetooth_name: "meuBluetooth",

  //espnow
  initialize_wlan_title: "Preparar para obter endereço MAC",
  get_mac_address_title: "Obter Endereço MAC da Placa Amado",
  set_master_title: "Configurar Placa Amado como Mestre",
  add_peer_title: "Adicionar Dispositivo pelo Endereço MAC",
  receive_message_title: "Receber Mensagens de Dispositivos",
  set_peer_title: "Configurar Placa Amado como Dispositivo Secundário",
  send_message_to_peer_title: "Enviar Mensagem para Dispositivo pelo MAC",
  send_message_title: "Enviar Mensagem para o Dispositivo Mestre",
  receive_message_master_title: "Receber Mensagens do Dispositivo Mestre",
  variable_list: "Lista de variáveis",
  add_variable_container: "Adicionar variável",
  variable_name: "Nome da variável",
  variable_value: "Valor da variável",
  if: "Se",
  is_none: "for None, definir",
  default_value: "para valor padrão",

  //Blocos Lógica
  math_min_title: "Mínimo entre",
  math_max_title: "Máximo entre",
  and: "e",

  //Blocos Operadores
  var_to_int_title: "Para inteiro",
  var_to_float_title: "Para decimal",

  //Blocos funções de texto
  to_string_title: "Para texto",

  //Blocos para as funções da categoria Python
  os_error: "Exceto OSError",

  //Blocos para os pinos de entrada/saida
  analog_amado_board: "Ler entrada analógica",
  attenuation: "Atenuação: ",
  width: "Largura: ",
  frequency: "Frequência",
  frequency2: "frequência",
  duty: "Ciclo de trabalho",
  init_pwm: "Iniciar",
  deinit_pwm: "Desativar PWM #",
  pins: "pinos",
  external_event: "Evento externo (interrupção no  pino de entrada)",
  trigger: "Gatilho: ",
  irq_falling: "QUEDA DE SINAL",
  irq_rising: "SUBIDA DE SINAL",
  both: "QUEDA E SUBIDA(AMBOS)",

 
  //Sensor ultrassônico
  hcsr04_title: "Iniciar sensor ultrassônico HCSR04",
  get_distance_hcsr04: "Obter distancia",
  echo_pin: "Pino echo",
  trigger_pin: "Pino trigger",
  timeout_hcsr04: "Tempo limite (μs)",

  //acelerometro e giroscopio
  mpu6050_init: "Iniciar sensor acelerômetro e giroscópio MPU6050",
  mpu6050_read_acc_x: "Ler aceleração no eixo X",
  mpu6050_read_acc_y: "Ler aceleração no eixo Y",
  mpu6050_read_acc_z: "Ler aceleração no eixo Z",
  mpu6050_read_gyro_x: "Ler velocidade angular no eixo X",
  mpu6050_read_gyro_y: "Ler velocidade angular no eixo Y",
  mpu6050_read_gyro_z: "Ler velocidade angular no eixo Z",
  
  //Leitor RFID
  rfid_rc522_init_title: "Iniciar leitor RFID MFRC522",
  rfid_rc522_detect_card_title: "Verificar se o cartão RFID está presente",
  rfid_rc522_anticoll_title: "Obter identificação do cartão (UID)",
  rfid_rc522_read_card_title: "Ler memória do cartão RFID",
  rfid_rc522_write_card_title: "Escrever na memória do cartão RFID",
  
  //Display OLED
  init_oled_title: "Iniciar display OLED SSD1306 I2C",
  fill_oled_title: "Preencher display OLED com",
  clear_oled_title: "Limpar display OLED",
  show_oled_title: "Atualizar display OLED",
  write_oled_title: "Escrever texto no display",
  write_oled_int_title: "Exibir valor no display",
  x_position: "Posição X",
  y_position: "Posição Y",
  value_display: "Valor",

  //Servo motor
  init_servo_title: "Iniciar servo motor",
  init_servo_name: "Nome do servo: ",
  init_servo_pin: "Pino",
  move_servo_title: "Mover servo",
  move_servo_name: "Nome do servo: ",
  move_servo_angle: "Ângulo",
  no_servos: "Nenhum servo",

  //DC motor
  dc_motor_init_title: "Iniciar motor DC",
  dc_motor_pwm_label: "PWM",
  dc_motor_dir1_label: "Direção 1",
  dc_motor_dir2_label: "Direção 2",
  dc_motor_name_label: "Nome do motor: ",
  dc_motor_power_title: "Definir potência do motor DC  -",
  dc_motor_power_label: "Potência:",
  dc_motor_direction_title: "Definir direção do motor DC  -",
  dc_motor_direction_label: "Direção:",
  dc_motor_stop_title: "Parar motor DC",

  //Buzzer
  tone_title: "Reproduzir buzzer no",
  note_title: "Reproduzir buzzer no",
  rttl_play_title: "Reproduzir música",
  duration_label: "duração (s): ",
  duration_label2: "(0 para duração infinita)",
  note_label: "nota",
  frequency_label: "frequência",
  songs_label: "Música:",
  melody_label: "melodia",

  //Bluetooth REPL
  bluetooth_repl_start_title: "Iniciar REPL via Web Bluetooth",
  bluetooth_repl_setup_title: "Configurar REPL via Web Bluetooth",
  bluetooth_name_label: "Nome Bluetooth:",

  //Wifi
  net_ap_mode_title: "Configurar Modo Ponto de Acesso",
  net_network_name_label: "Nome da rede",
  net_network_key_label: "Senha da rede",
  net_ifconfig_title: "Endereço IP Atual",

  //Cliente HTTP
  Make_HTTP_POST_Request_URL_title: "Fazer requisição HTTP POST -  URL",



//Network
  net_http_get: "Requisição HTTP GET",
  net_http_get_status: "Status da resposta HTTP",
  net_http_get_content: "Conteúdo da resposta HTTP",
  net_http_server_start: "Iniciar servidor HTTP Web",
  net_http_server_start_port: "Porta",
  net_http_server_wait: "Aguarde cliente HTTP",
  net_http_server_requested_page: "Página web solicitada",
  net_http_server_send_response: "Enviar resposta HTTP",
  net_http_server_send_html: "HTML",
  net_http_server_close_title: "Fechar HTTP web server",


//Splash screen
  splash_welcome: "Bem vindo ao BIPES!",
  splash_footer: "Não mostrar esta tela novamente",
  splash_close: "Fechar",
  splash_message: "<p><b>BIPES: Block based Integrated Platform for Embedded Systems</B> permite programar, usando texto ou blocos, diversos tipos de sistemas embarcados e módulos para Internet das Coisas usando MicroPython, CircuitPython, Linux ou Snek. Você pode conectar, programar, depurar e monitorar diversos tipos de placas usando rede, wifi, USB ou Bluetooth. Verifique a lista de placas suportadas <a href=https://bipes.net.br/wp/boards/>aqui</a>. Alguns exemplos de placas compatíveis são: STM32, ESP32, ESP8266, Raspberry Pi (incluindo a Pico) e até mesmo  Arduino. <p>O <b>BIPES</b> é totalmente <a href=https://bipes.net.br/wp/development/>aberto</a> e gratuito e funciona sem a necessidade de instalação de nenhum plugin ou software adicional,  além de funcionar offline, sem conexão com a Internet. Esperamos que o BIPES seja útil para você e que você possa aproveitá-lo. Se precisar de ajuda, temos o <a href=https://github.com/BIPES/BIPES/discussions>fórum de discussões</a>, onde <a href=https://github.com/BIPES/BIPES/discussions/categories/announcements>novidades também são anunciadas</a>. Sinta-se à vontade para participar e também deixar comentários e sugestões para o projeto!</p><p>Grave o MicroPython, a partir do navegador web, na ESP32 ou ESP8266 facilmente para usar o BIPES: <a href=https://amadomaker.github.io/Instalador_Micropython/>https://amadomaker.github.io/Instalador_Micropython/</a></p><p>Conheça o livro do BIPES:<a href=https://bipes.net.br/wp/book-livro/>https://bipes.net.br/wp/book-livro/</a></p> <p>A equipe do projeto BIPES agradece o seu interesse!</p>"

  

};

//Categorias da caixa de ferramentas

Blockly.Msg['CAT_CONTROL'] = "Controle";
Blockly.Msg['CAT_LOOPS'] = "Laços";
Blockly.Msg['CAT_TIMING'] = "Temporização";
Blockly.Msg['CAT_INOUT'] = "Pinos entrada/saída";
Blockly.Msg['CAT_DISPLAYS'] = "Telas";
Blockly.Msg['CAT_SENSORS'] = "Sensores";
Blockly.Msg['CAT_OUTPUTS'] = "Saídas e atuadores";
Blockly.Msg['CAT_COMM'] = "Comunicação";
Blockly.Msg['CAT_FILES'] = "Arquivos";
Blockly.Msg['CAT_NET'] = "Rede e Internet";
Blockly.Msg['CAT_OPERATORS'] = "Operadores";
Blockly.Msg['CAT_VARIABLES'] = "Variáveis";
Blockly.Msg['CAT_FUNCTIONS'] = "Funções";
Blockly.Msg['CAT_DHT11/22'] = "Temperatura e umidade";
Blockly.Msg['CAT_ULTRASONIC'] = "Ultrassônico";
Blockly.Msg['CAT_ACCELEROMETER'] = "Acelerômetro e giroscópio";
Blockly.Msg['CAT_RFID'] = "Leitor RFID";
Blockly.Msg['CAT_OLEDDISPLAY'] = "Display OLED";
Blockly.Msg['CAT_RELAY'] = "Módulo relé";
Blockly.Msg['CAT_SERVO'] = "Servo motor";
Blockly.Msg['CAT_DCMOTOR'] = "Motor DC";
Blockly.Msg['CAT_BUZZER'] = "Campainha";
Blockly.Msg['CAT_WIFI'] = "WiFi";
Blockly.Msg['CAT_HTTPCLIENT'] = "Cliente HTTP";
Blockly.Msg['CAT_HTTPSERVER'] = "Servidor HTTP"


