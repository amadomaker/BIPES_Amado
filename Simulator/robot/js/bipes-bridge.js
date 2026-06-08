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

  // Gears usa graus/segundo no speed_sp: RPM × 360/60
  var RPM_TO_DEG_S = 360 / 60;

  this.init = function () {
    window.addEventListener('message', self.onMessage);

    var $chevron = $('.console .chevron');
    var $clear = $('.console .clear');
    $chevron.on('click', function () { $('.console').toggleClass('open'); });
    $clear.on('click', function () { $('.console .content').text(''); });

    self.log('Simulador de robô pronto.');
  };

  // Busca recursiva do sensor ultrassônico nos componentes do robô
  this.findUltrasonicSensor = function (components) {
    if (!components) return null;
    for (var i = 0; i < components.length; i++) {
      var c = components[i];
      if (c.type === 'UltrasonicSensor') return c;
      if (c.components) {
        var found = self.findUltrasonicSensor(c.components);
        if (found) return found;
      }
    }
    return null;
  };

  // Lê o sensor do robô 3D e envia para o BIPES via postMessage
  this.sendSensorState = function () {
    if (!robot || !robot.components) return;
    var sensor = self.findUltrasonicSensor(robot.components);
    if (!sensor) return;

    var distanceCm = sensor.getDistance();
    // Gears usa a mesma escala de cm (1 unidade ≈ 1 cm)
    // HC-SR04 real: 2–400 cm
    distanceCm = Math.max(2, Math.min(400, distanceCm));

    window.parent.postMessage({
      type: 'bipes-sensor-state',
      ultrasonicCm: distanceCm,
    }, '*');
  };

  // Recebe estado dos motores do BIPES
  this.onMessage = function (event) {
    var data = event.data;
    if (!data || data.type !== 'bipes-motor-state') return;

    leftRpm  = Math.abs(Number(data.leftRpm)  || 0);
    leftDir  = Math.sign(Number(data.leftDir)  || 0);
    rightRpm = Math.abs(Number(data.rightRpm) || 0);
    rightDir = Math.sign(Number(data.rightDir) || 0);

    var status = document.getElementById('sim-status');
    if (status) {
      status.textContent = 'A=' + Math.round(leftRpm) + 'rpm  B=' + Math.round(rightRpm) + 'rpm';
    }

    if (!isRunning) return;
    self.applyMotorState();
  };

  this.applyMotorState = function () {
    if (!robot || !robot.leftWheel || !robot.rightWheel) return;

    var leftSpeed  = leftRpm  * RPM_TO_DEG_S * (leftDir  || 1);
    var rightSpeed = rightRpm * RPM_TO_DEG_S * (rightDir || 1);

    robot.leftWheel.speed_sp  = leftSpeed;
    robot.rightWheel.speed_sp = rightSpeed;

    if (leftRpm > 1 || rightRpm > 1) {
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

    document.getElementById('btn-run-sim').textContent = '⏹ Parar';
    document.getElementById('sim-status').textContent = 'Aguardando motores...';
    self.log('Simulação iniciada.');

    babylon.engine.runRenderLoop(function () {
      babylon.scene.render();
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

    document.getElementById('btn-run-sim').textContent = '▶ Iniciar';
    document.getElementById('sim-status').textContent = 'Simulação parada';
    self.log('Simulação parada.');
  };

  this.resetSim = function () {
    var wasRunning = isRunning;
    if (isRunning) self.stopSim();

    try {
      var result = simPanel.resetSim();
      if (result && typeof result.then === 'function') {
        result.then(function () { if (wasRunning) self.startSim(); });
      } else {
        if (wasRunning) self.startSim();
      }
    } catch (e) {
      self.log('Erro ao resetar: ' + e.message);
      if (wasRunning) self.startSim();
    }
  };

  this.log = function (msg) {
    var $content = $('.console .content');
    $content.text($content.text() + msg + '\n');
  };
};
