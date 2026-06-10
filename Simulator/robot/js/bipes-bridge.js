// Ponte entre o simulador de eletrônica do BIPES e o simulador físico do robô.
// Motor: BIPES → postMessage → robô se move
// Ultrassônico: robô detecta parede → postMessage → BIPES atualiza sensor
var bipesBridge = new function () {
  var self = this;

  var isRunning = false;
  var driveInterval = null;
  var sensorInterval = null;
  var leftRpm = 0;
  var rightRpm = 0;
  var leftDir = 0;
  var rightDir = 0;
  var leftPwm = null;
  var rightPwm = null;
  var sensorLogTick = 0;

  // Modo futebol: 'off' | 'treino' | 'jogo'
  var fbMode = 'off';
  var fbPollInterval = null;
  var fbDriveInterval = null;
  // Últimos valores recebidos do ESP32 (aplicados continuamente pelas rodas)
  var fbStateA = { lSpeed: 0, rSpeed: 0 };
  var fbStateB = { lSpeed: 0, rSpeed: 0 };

  // Gears usa graus/segundo no speed_sp: RPM × 360/60
  var RPM_TO_DEG_S = 360 / 60;

  // === Modelo de PWM fiel ao motor real ===
  // O carrinho 3D responde ao PWM (0–1023) que o código comanda, igual ao carrinho físico:
  // - abaixo de PWM_MIN o motor não gira (zona morta / tensão mínima do motor real)
  // - exatamente em PWM_MIN o motor já parte de MIN_WHEEL_SPEED (vence o atrito, não fica em 0)
  // - de PWM_MIN até 1023 a velocidade sobe linear até MAX_WHEEL_SPEED
  // Ajustar estes números para casar com o carrinho real.
  var PWM_MIN = 700;            // abaixo disso o carrinho fica parado
  var PWM_MAX = 1023;
  var MAX_WHEEL_SPEED = 500;    // graus/segundo na roda em PWM máximo (1023)
  var MIN_WHEEL_SPEED = 130;    // graus/segundo na roda ao cruzar a zona morta (PWM_MIN)

  // Converte o PWM comandado em velocidade da roda (deg/s).
  // Sem PWM (motor ligado direto, sem bloco PWM) → usa o RPM como antes.
  this.pwmToWheelSpeed = function (pwm, rpmFallback) {
    if (pwm === null || pwm === undefined) {
      return Math.abs(Number(rpmFallback) || 0) * RPM_TO_DEG_S * 0.4;
    }
    var p = Math.abs(Number(pwm) || 0);
    if (p < PWM_MIN) return 0;
    var frac = (p - PWM_MIN) / (PWM_MAX - PWM_MIN); // 0..1
    return MIN_WHEEL_SPEED + frac * (MAX_WHEEL_SPEED - MIN_WHEEL_SPEED);
  };

  this.init = function () {
    window.addEventListener('message', self.onMessage);

    var $chevron = $('.console .chevron');
    var $clear = $('.console .clear');
    $chevron.on('click', function () { $('.console').toggleClass('open'); });
    $clear.on('click', function () { $('.console .content').text(''); });

    self.log('Simulador de robô pronto.');

    // Ticker de diagnóstico: mostra quantos sensores 3D foram encontrados (roda sempre)
    setInterval(function () {
      var elC = document.getElementById('dbg-sens-count');
      if (!elC) return;
      if (!robot || !robot.components) {
        elC.textContent = 'robô não carregado';
        return;
      }
      var count = self.findAllSensors(robot.components, 'ColorSensor').length;
      elC.textContent = count + (isRunning ? '' : '  ⬅ clique Iniciar');
    }, 800);
  };

  // Busca recursiva de sensor por tipo (retorna o primeiro encontrado)
  this.findSensor = function (components, type) {
    if (!components) return null;
    for (var i = 0; i < components.length; i++) {
      var c = components[i];
      if (c.type === type) return c;
      if (c.components) {
        var found = self.findSensor(c.components, type);
        if (found) return found;
      }
    }
    return null;
  };

  // Busca recursiva de todos os sensores de um tipo
  this.findAllSensors = function (components, type) {
    var result = [];
    if (!components) return result;
    for (var i = 0; i < components.length; i++) {
      var c = components[i];
      if (c.type === type) result.push(c);
      if (c.components) {
        result = result.concat(self.findAllSensors(c.components, type));
      }
    }
    return result;
  };

  // Lê os sensores do robô 3D e envia para o BIPES via postMessage
  this.sendSensorState = function () {
    if (!robot || !robot.components) return;

    var msg = { type: 'bipes-sensor-state' };

    // Ultrassônico
    var ultrasonic = self.findSensor(robot.components, 'UltrasonicSensor');
    if (ultrasonic) {
      var distanceCm = Math.max(2, Math.min(400, ultrasonic.getDistance()));
      msg.ultrasonicCm = distanceCm;
    }

    // ColorSensors → simulam IR de reflexão para seguidor de linha
    // Ordenados por posição X local do componente (esquerdo x<0, direito x>0)
    // getRGB() retorna [r, g, b] em 0-255; brilho 0=preto (linha), 100=branco
    var colorSensors = self.findAllSensors(robot.components, 'ColorSensor');
    if (colorSensors.length >= 2) {
      // a.position é BABYLON.Vector3 com a posição local relativa ao corpo do robô
      colorSensors.sort(function(a, b) {
        var ax = a.position ? a.position.x : 0;
        var bx = b.position ? b.position.x : 0;
        return ax - bx; // menor x = esquerdo
      });
      var rgbL = colorSensors[0].getRGB();
      var rgbR = colorSensors[1].getRGB();
      msg.irSensorLeft  = Math.round((rgbL[0] + rgbL[1] + rgbL[2]) / (3 * 2.55));
      msg.irSensorRight = Math.round((rgbR[0] + rgbR[1] + rgbR[2]) / (3 * 2.55));
    } else if (colorSensors.length === 1) {
      var rgb = colorSensors[0].getRGB();
      var level = Math.round((rgb[0] + rgb[1] + rgb[2]) / (3 * 2.55));
      msg.irSensorLeft  = level;
      msg.irSensorRight = level;
    }

    // Atualiza painel de debug a ~2Hz (a cada 5 chamadas de 100ms)
    sensorLogTick++;
    if (sensorLogTick >= 5) {
      sensorLogTick = 0;
      var l = msg.irSensorLeft  !== undefined ? msg.irSensorLeft  : '--';
      var r = msg.irSensorRight !== undefined ? msg.irSensorRight : '--';
      var elL = document.getElementById('dbg-ir-left');
      var elR = document.getElementById('dbg-ir-right');
      var elC = document.getElementById('dbg-sens-count');
      if (elL) elL.textContent = l + ' %';
      if (elR) elR.textContent = r + ' %';
      if (elC) elC.textContent = colorSensors.length;
    }

    window.parent.postMessage(msg, '*');
  };

  // Recebe mensagens do BIPES (motor state + comando de parada ao fechar painel)
  this.onMessage = function (event) {
    var data = event.data;
    if (!data) return;

    // BIPES fechou o painel do robô → para os loops do robô
    if (data.type === 'robot-stop') {
      if (isRunning) self.stopSim();
      return;
    }

    if (data.type !== 'bipes-motor-state') return;

    leftRpm  = Math.abs(Number(data.leftRpm)  || 0);
    leftDir  = Math.sign(Number(data.leftDir)  || 0);
    rightRpm = Math.abs(Number(data.rightRpm) || 0);
    rightDir = Math.sign(Number(data.rightDir) || 0);
    leftPwm  = (data.leftPwm  === null || data.leftPwm  === undefined) ? null : Math.abs(Number(data.leftPwm)  || 0);
    rightPwm = (data.rightPwm === null || data.rightPwm === undefined) ? null : Math.abs(Number(data.rightPwm) || 0);

    var elA = document.getElementById('dbg-rpm-a');
    var elB = document.getElementById('dbg-rpm-b');
    if (elA) elA.textContent = (leftPwm  === null ? '— (sem PWM)' : Math.round(leftPwm));
    if (elB) elB.textContent = (rightPwm === null ? '— (sem PWM)' : Math.round(rightPwm));

    if (!isRunning) return;
    self.applyMotorState();
  };

  this.applyMotorState = function () {
    if (!robot || !robot.leftWheel || !robot.rightWheel) return;

    // Carrinho responde ao PWM comandado (zona morta + velocidade máx fiel ao real)
    var leftSpeed  = self.pwmToWheelSpeed(leftPwm,  leftRpm)  * (leftDir  || 1);
    var rightSpeed = self.pwmToWheelSpeed(rightPwm, rightRpm) * (rightDir || 1);

    robot.leftWheel.speed_sp  = leftSpeed;
    robot.rightWheel.speed_sp = rightSpeed;

    if (Math.abs(leftSpeed) > 1 || Math.abs(rightSpeed) > 1) {
      robot.leftWheel.runForever();
      robot.rightWheel.runForever();
    } else {
      robot.leftWheel.stop();
      robot.rightWheel.stop();
    }
  };

  // ── Futebol / ESP32 ──────────────────────────────────────────────────

  this.setFootballMode = function(mode) {
    fbMode = mode;
    if (fbPollInterval)  { clearInterval(fbPollInterval);  fbPollInterval  = null; }
    if (fbDriveInterval) { clearInterval(fbDriveInterval); fbDriveInterval = null; }
    fbStateA = { lSpeed: 0, rSpeed: 0 };
    fbStateB = { lSpeed: 0, rSpeed: 0 };
  };

  // Testa se a placa está acessível. which: 'a' | 'b'
  this.testEsp32 = function(ip, which) {
    var dot = document.getElementById('fb-status-' + which);
    if (!ip) { if (dot) dot.style.color = '#334155'; return; }
    if (dot) dot.style.color = '#f59e0b'; // amarelo = tentando

    var ctrl = new AbortController();
    var tid = setTimeout(function() { ctrl.abort(); }, 3000);
    fetch('http://' + ip + '/robot', { signal: ctrl.signal })
      .then(function(r) {
        clearTimeout(tid);
        if (dot) dot.style.color = r.ok ? '#22c55e' : '#ef4444';
      })
      .catch(function() { if (dot) dot.style.color = '#ef4444'; });
  };

  // Mapeamento linear para futebol: -1023..1023 → -FB_MAX_SPEED..FB_MAX_SPEED
  // Sem zona morta — o usuário controla diretamente via l/r
  var FB_MAX_SPEED = 550; // graus/segundo no máximo (teto do Wheel.MAX_SPEED é 800)

  this.fbValToSpeed = function(val) {
    return (Math.max(-1023, Math.min(1023, Number(val) || 0)) / 1023) * FB_MAX_SPEED;
  };

  // Busca estado do ESP32 e salva em fbStateA/B (não aplica nas rodas diretamente)
  this.fetchEsp32Motors = function(ip, stateRef) {
    var ctrl = new AbortController();
    var tid = setTimeout(function() { ctrl.abort(); }, 1000);
    return fetch('http://' + ip + '/robot', { signal: ctrl.signal })
      .then(function(r) { clearTimeout(tid); return r.json(); })
      .then(function(data) {
        stateRef.lSpeed = self.fbValToSpeed(data.l);
        stateRef.rSpeed = self.fbValToSpeed(data.r);
      })
      .catch(function() { clearTimeout(tid); });
  };

  // Aplica os últimos valores recebidos nas rodas (roda a 30ms, igual ao modo normal)
  this.applyFbState = function() {
    function applyToRobot(robotRef, state) {
      if (!robotRef || !robotRef.leftWheel) return;
      robotRef.leftWheel.speed_sp  = state.lSpeed;
      robotRef.rightWheel.speed_sp = state.rSpeed;
      if (Math.abs(state.lSpeed) > 1 || Math.abs(state.rSpeed) > 1) {
        robotRef.leftWheel.runForever();
        robotRef.rightWheel.runForever();
      } else {
        robotRef.leftWheel.stop();
        robotRef.rightWheel.stop();
      }
    }
    applyToRobot(robot, fbStateA);
    if (fbMode === 'jogo' && window.robotB) applyToRobot(window.robotB, fbStateB);
  };

  // Inicia o polling das placas + loop de acionamento das rodas
  this.startFbPoll = function() {
    if (fbPollInterval)  clearInterval(fbPollInterval);
    if (fbDriveInterval) clearInterval(fbDriveInterval);

    // Aplica estado nas rodas continuamente a 30ms (suave, igual ao modo BIPES)
    fbDriveInterval = setInterval(self.applyFbState, 30);

    // Busca novo estado do ESP32 só quando o request anterior terminou
    var pendingA = false;
    var pendingB = false;
    fbPollInterval = setInterval(function() {
      var ipA = (document.getElementById('fb-ip-a') || {}).value || '';
      var ipB = (document.getElementById('fb-ip-b') || {}).value || '';
      ipA = ipA.trim(); ipB = ipB.trim();
      if (ipA && !pendingA) {
        pendingA = true;
        self.fetchEsp32Motors(ipA, fbStateA)
          .then(function() { pendingA = false; }).catch(function() { pendingA = false; });
      }
      if (fbMode === 'jogo' && ipB && !pendingB && window.robotB) {
        pendingB = true;
        self.fetchEsp32Motors(ipB, fbStateB)
          .then(function() { pendingB = false; }).catch(function() { pendingB = false; });
      }
    }, 200);
  };

  // ── fim Futebol ──────────────────────────────────────────────────────

  this.toggleSim = function () {
    if (isRunning) self.stopSim(); else self.startSim();
  };

  this.startSim = function () {
    if (isRunning) return;
    isRunning = true;

    var btn = document.getElementById('btn-run-sim');
    if (btn) btn.textContent = '⏹ Parar';
    // Avisa o BIPES para começar a enviar o estado dos motores (não toca no Play do BIPES)
    window.parent.postMessage({ type: 'robot-started' }, '*');

    self.log('Simulação iniciada.');

    // Diagnóstico: mostra o que foi encontrado no robot
    if (!robot || !robot.components) {
      self.log('AVISO: robot.components vazio ou indefinido!');
    } else {
      var found = self.findAllSensors(robot.components, 'ColorSensor');
      self.log('ColorSensors encontrados: ' + found.length);
      found.forEach(function(s, i) {
        var px = s.position ? s.position.x.toFixed(1) : '?';
        var hasRGB = typeof s.getRGB === 'function';
        self.log('  [' + i + '] x=' + px + '  getRGB=' + hasRGB);
      });
    }

    babylon.engine.runRenderLoop(function () {
      babylon.render();       // atualiza posição da câmera RTT dos sensores (ColorSensor, etc.)
      babylon.scene.render(); // desenha o frame 3D
    });

    if (fbMode !== 'off') {
      // Modo futebol: polling das placas ESP32
      self.startFbPoll();
    } else {
      // Modo normal: aplica motor state do BIPES e lê sensores
      driveInterval = setInterval(self.applyMotorState, 30);
      sensorInterval = setInterval(self.sendSensorState, 25);
    }
  };

  this.stopSim = function () {
    isRunning = false;

    clearInterval(driveInterval);
    clearInterval(sensorInterval);
    driveInterval = null;
    sensorInterval = null;

    if (fbPollInterval)  { clearInterval(fbPollInterval);  fbPollInterval  = null; }
    if (fbDriveInterval) { clearInterval(fbDriveInterval); fbDriveInterval = null; }
    fbStateA = { lSpeed: 0, rSpeed: 0 };
    fbStateB = { lSpeed: 0, rSpeed: 0 };

    babylon.engine.stopRenderLoop();

    if (robot && robot.leftWheel) {
      robot.leftWheel.stop();
      robot.rightWheel.stop();
    }
    if (window.robotB && window.robotB.leftWheel) {
      window.robotB.leftWheel.stop();
      window.robotB.rightWheel.stop();
    }

    var btn = document.getElementById('btn-run-sim');
    if (btn) btn.textContent = '▶ Iniciar';
    // Avisa o BIPES para parar de enviar o estado dos motores
    window.parent.postMessage({ type: 'robot-stopped' }, '*');

    self.log('Simulação parada.');
  };

  this.resetSim = function () {
    var wasRunning = isRunning;
    if (isRunning) self.stopSim();

    // Labirinto: semente fixa para o mapa não mudar a cada reset
    var worldOpts = babylon.world.name === 'maze' ? { seed: 42 } : {};
    babylon.world.setOptions(worldOpts).then(function () {
      return babylon.resetScene();
    }).then(function () {
      if (wasRunning) self.startSim();
    }).catch(function (e) {
      self.log('Erro ao resetar: ' + e.message);
      if (wasRunning) self.startSim();
    });
  };

  this.log = function (msg) {
    var $content = $('.console .content');
    $content.text($content.text() + msg + '\n');
  };
};
