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
  var sensorLogTick = 0;

  // Gears usa graus/segundo no speed_sp: RPM × 360/60
  var RPM_TO_DEG_S = 360 / 60;

  // Escala de velocidade do carrinho 3D: o robô simulado é mais sensível que o real,
  // então reduzimos a velocidade física sem mexer no RPM do motor componente.
  // 1.0 = velocidade cheia; 0.4 = padrão (mais lento, dá pra seguir a linha)
  var motorSpeedScale = 0.4;

  this.setSpeedScale = function(scale) {
    motorSpeedScale = Number(scale) || 0.4;
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

    var elA = document.getElementById('dbg-rpm-a');
    var elB = document.getElementById('dbg-rpm-b');
    if (elA) elA.textContent = Math.round(leftRpm) + ' rpm';
    if (elB) elB.textContent = Math.round(rightRpm) + ' rpm';

    if (!isRunning) return;
    self.applyMotorState();
  };

  this.applyMotorState = function () {
    if (!robot || !robot.leftWheel || !robot.rightWheel) return;

    // Escala a velocidade do carrinho 3D (sem mexer no RPM do motor componente)
    var effLeft  = leftRpm  * motorSpeedScale;
    var effRight = rightRpm * motorSpeedScale;

    var leftSpeed  = effLeft  * RPM_TO_DEG_S * (leftDir  || 1);
    var rightSpeed = effRight * RPM_TO_DEG_S * (rightDir || 1);

    robot.leftWheel.speed_sp  = leftSpeed;
    robot.rightWheel.speed_sp = rightSpeed;

    if (effLeft > 1 || effRight > 1) {
      robot.leftWheel.runForever();
      robot.rightWheel.runForever();
    } else {
      robot.leftWheel.stop();
      robot.rightWheel.stop();
    }
  };

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

    // Aplica estado dos motores a cada 50ms
    driveInterval = setInterval(self.applyMotorState, 50);

    // Lê sensor ultrassônico a cada 100ms e envia para o BIPES
    sensorInterval = setInterval(self.sendSensorState, 100);
  };

  this.stopSim = function () {
    isRunning = false;

    clearInterval(driveInterval);
    clearInterval(sensorInterval);
    driveInterval = null;
    sensorInterval = null;

    babylon.engine.stopRenderLoop();

    if (robot && robot.leftWheel) {
      robot.leftWheel.stop();
      robot.rightWheel.stop();
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
