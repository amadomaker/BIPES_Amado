import { amadoBoardPins } from './components.js';
import { showAlert } from './ui.js';

let blocksRegistered = false;

function createWaitShadowBlock(Blockly) {
  const shadow = Blockly.utils.xml.createElement('shadow');
  shadow.setAttribute('type', 'math_number');

  const field = Blockly.utils.xml.createElement('field');
  field.setAttribute('name', 'NUM');
  field.textContent = '1000';

  shadow.appendChild(field);
  return shadow;
}

function createNumberShadowBlock(Blockly, defaultValue = '0') {
  const shadow = Blockly.utils.xml.createElement('shadow');
  shadow.setAttribute('type', 'math_number');

  const field = Blockly.utils.xml.createElement('field');
  field.setAttribute('name', 'NUM');
  field.textContent = String(defaultValue);

  shadow.appendChild(field);
  return shadow;
}

function createTextShadowBlock(Blockly) {
  const shadow = Blockly.utils.xml.createElement('shadow');
  shadow.setAttribute('type', 'text');

  const field = Blockly.utils.xml.createElement('field');
  field.setAttribute('name', 'TEXT');
  field.textContent = 'Mensagem';

  shadow.appendChild(field);
  return shadow;
}

function createPinSelectorShadow(Blockly) {
  const shadow = Blockly.utils.xml.createElement('shadow');
  shadow.setAttribute('type', 'amado_pin_selector');
  return shadow;
}

function createLevelSelectorShadow(Blockly) {
  const shadow = Blockly.utils.xml.createElement('shadow');
  shadow.setAttribute('type', 'amado_pin_level');
  return shadow;
}

function createServoNameField(Blockly, defaultValue = 'Servo 1') {
  const FieldTextInput = Blockly.FieldTextInput ?? Blockly.FieldInput ?? null;
  if (!FieldTextInput) {
    return null;
  }
  const field = new FieldTextInput(defaultValue);
  if (typeof field.setSpellcheck === 'function') {
    field.setSpellcheck(false);
  }
  return field;
}

function buildPinOptions() {
  const labels = [
    ['D2 / LED AZUL', 'D2'],
    ['D4 / BUZZER', 'D4'],
    ['D5 / CS', 'D5'],
    ['D12 / PWM J1', 'D12'],
    ['D13 / DIR1 J1', 'D13'],
    ['D14 / DIR2 J1', 'D14'],
    ['D15 / SERVO A', 'D15'],
    ['D16 / SERVO B', 'D16'],
    ['D17', 'D17'],
    ['D18 / CLK', 'D18 / CLK'],
    ['D19 / MISO', 'D19 / MISO'],
    ['D21 / SDA', 'D21 / SDA'],
    ['D22 / SCL', 'D22 / SCL'],
    ['D23 / MOSI', 'D23 / MOSI'],
    ['D25 / PWM J3', 'D25'],
    ['D26 / DIR1 J3', 'D26'],
    ['D27 / DIR2 J3', 'D27'],
    ['D32 / LED VERMELHO', 'D32'],
    ['D33 / LED VERDE', 'D33'],
    ['D34', 'D34'],
    ['D35', 'D35'],
    ['D36', 'D36'],
    ['D39', 'D39'],
  ];

  return labels;
}

function createMotorNameField(Blockly, defaultValue = 'Motor A') {
  const FieldTextInput = Blockly.FieldTextInput ?? Blockly.FieldInput ?? null;
  if (!FieldTextInput) {
    return null;
  }
  const field = new FieldTextInput(defaultValue);
  if (typeof field.setSpellcheck === 'function') {
    field.setSpellcheck(false);
  }
  return field;
}

const LOOP_BLOCK_TYPES = new Set([
  'controls_repeat_ext',
  'controls_repeat',
  'controls_whileUntil',
  'controls_for',
  'controls_forEach',
  'amado_for_each_item',
]);

function isBlockInsideLoop(block) {
  if (!block?.getSurroundParent) return false;
  let parent = block.getSurroundParent();
  while (parent) {
    if (LOOP_BLOCK_TYPES.has(parent.type)) return true;
    parent = parent.getSurroundParent ? parent.getSurroundParent() : null;
  }
  return false;
}

export function registerAmadoBlocks(Blockly) {
  if (blocksRegistered || !Blockly) return;
  blocksRegistered = true;

  const pinOptions = buildPinOptions();

  // Blocos de controle adicionais (cor #d9a600)
  Blockly.Blocks.amado_for_each_item = {
    init() {
      this.appendDummyInput()
        .appendField('para cada item')
        .appendField(new (Blockly.FieldVariable ?? Blockly.FieldInput)('item'), 'VAR')
        .appendField('na lista');
      this.appendValueInput('LIST').setCheck('Array').setAlign(Blockly.ALIGN_RIGHT);
      this.appendStatementInput('DO').setCheck(null).appendField('faça');
      this.setInputsInline(false);
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour('#d9a600');
      this.setTooltip('Itera sobre cada item de uma lista e executa o bloco interno.');
      this.setHelpUrl('');
    },
  };

  Blockly.Blocks.amado_break_loop = {
    init() {
      this.appendDummyInput().appendField('encerra o laço');
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour('#d9a600');
      this.setTooltip('Interrompe imediatamente o laço atual.');
      this.setHelpUrl('');
    },
  };

  // Blocos personalizados para lógica/matemática (cor #008000)
  Blockly.Blocks.amado_logic_ternary = {
    init() {
      this.appendValueInput('COND').setCheck(null).appendField('teste');
      this.appendValueInput('IF_TRUE').setCheck(null).appendField('se verdadeiro');
      this.appendValueInput('IF_FALSE').setCheck(null).appendField('se falso');
      this.setOutput(true, null);
      this.setColour('#008000');
      this.setTooltip('Retorna o valor em "se verdadeiro" ou "se falso" conforme a condição.');
      this.setHelpUrl('');
    },
  };

  Blockly.Blocks.amado_map_range = {
    init() {
      this.appendValueInput('VALUE').setCheck(null).appendField('mapear');
      this.appendValueInput('IN_MIN').setCheck(null).appendField('entrada mínima');
      this.appendValueInput('IN_MAX').setCheck(null).appendField('entrada máxima');
      this.appendValueInput('OUT_MIN').setCheck(null).appendField('saída mínima');
      this.appendValueInput('OUT_MAX').setCheck(null).appendField('saída máxima');
      this.setOutput(true, null);
      this.setColour('#008000');
      this.setTooltip('Faz o mapeamento linear de um valor de um intervalo de entrada para um intervalo de saída.');
      this.setHelpUrl('');
    },
  };

  Blockly.Blocks.amado_min_between = {
    init() {
      this.appendValueInput('A').setCheck(null).appendField('Mínimo entre');
      this.appendValueInput('B').setCheck(null).appendField('e');
      this.setInputsInline(true);
      this.setOutput(true, null);
      this.setColour('#008000');
      this.setTooltip('Retorna o menor valor entre as duas entradas.');
      this.setHelpUrl('');
    },
  };

  Blockly.Blocks.amado_max_between = {
    init() {
      this.appendValueInput('A').setCheck(null).appendField('Máximo entre');
      this.appendValueInput('B').setCheck(null).appendField('e');
      this.setInputsInline(true);
      this.setOutput(true, null);
      this.setColour('#008000');
      this.setTooltip('Retorna o maior valor entre as duas entradas.');
      this.setHelpUrl('');
    },
  };

  // Conversões numéricas simples
  Blockly.Blocks.amado_to_int = {
    init() {
      this.appendValueInput('VALUE').setCheck(null).appendField('Para inteiro');
      this.setOutput(true, 'Number');
      this.setColour('#008000');
      this.setTooltip('Converte o valor para inteiro (trunca).');
      this.setHelpUrl('');
    },
  };

  Blockly.Blocks.amado_to_float = {
    init() {
      this.appendValueInput('VALUE').setCheck(null).appendField('Para decimal');
      this.setOutput(true, 'Number');
      this.setColour('#008000');
      this.setTooltip('Converte o valor para número decimal.');
      this.setHelpUrl('');
    },
  };

  // Bloco de texto simples (cor #1c1f7a)
  Blockly.Blocks.amado_text_literal = {
    init() {
      this.appendDummyInput()
        .appendField('"')
        .appendField(new (Blockly.FieldTextInput ?? Blockly.FieldInput)(''), 'TEXT')
        .appendField('"');
      this.setOutput(true, 'String');
      this.setColour('#1c1f7a');
      this.setTooltip('Texto literal.');
      this.setHelpUrl('');
    },
  };

  Blockly.Blocks.amado_text_join = {
    init() {
      if (Blockly.Blocks.text_join?.init) {
        Blockly.Blocks.text_join.init.call(this);
        this.setColour('#1c1f7a');
      } else {
        // Fallback simples com duas entradas sem mutator
        this.appendValueInput('ADD0').appendField('criar texto com');
        this.appendValueInput('ADD1');
        this.setOutput(true, 'String');
        this.setColour('#1c1f7a');
      }
      this.setTooltip('Concatena vários textos em uma única string.');
      this.setHelpUrl('');
    },
  };

  // Blocos personalizados para variáveis (cor #1c1f7a)
  Blockly.Blocks.variable_boolean_const = {
    init() {
      this.appendDummyInput().appendField(
        new (Blockly.FieldDropdown || Blockly.FieldChoice)([
          ['true', 'TRUE'],
          ['false', 'FALSE'],
        ]),
        'BOOL',
      );
      this.setOutput(true, 'Boolean');
      this.setColour('#1c1f7a');
      this.setTooltip('Valor booleano verdadeiro ou falso.');
      this.setHelpUrl('');
    },
  };

  Blockly.Blocks.amado_null_const = {
    init() {
      this.appendDummyInput().appendField('nulo');
      this.setOutput(true, null);
      this.setColour('#1c1f7a');
      this.setTooltip('Retorna o valor nulo.');
      this.setHelpUrl('');
    },
  };

  Blockly.Blocks.variable_number_const = {
    init() {
      const FieldNumber = Blockly.FieldNumber ?? Blockly.FieldInput;
      this.appendDummyInput().appendField(new FieldNumber(0), 'NUM');
      this.setOutput(true, 'Number');
      this.setColour('#1c1f7a');
      this.setTooltip('Número constante.');
      this.setHelpUrl('');
    },
  };

  Blockly.Blocks.variable_pi_const = {
    init() {
      this.appendDummyInput().appendField(
        new (Blockly.FieldDropdown || Blockly.FieldChoice)([
          ['π', 'PI'],
          ['e', 'E'],
          ['φ', 'PHI'],
          ['sqrt(2)', 'SQRT2'],
          ['sqrt(½)', 'SQRT1_2'],
          ['∞', 'INF'],
        ]),
        'CONST',
      );
      this.setOutput(true, 'Number');
      this.setColour('#1c1f7a');
      this.setTooltip('Constantes matemáticas (π, e, φ, sqrt(2), sqrt(½), ∞).');
      this.setHelpUrl('');
    },
  };

  Blockly.Blocks.variable_random_int = {
    init() {
      this.appendValueInput('FROM').setCheck('Number').appendField('número aleatório de');
      this.appendValueInput('TO').setCheck('Number').appendField('até');
      this.setOutput(true, 'Number');
      this.setColour('#1c1f7a');
      this.setTooltip('Gera um inteiro aleatório dentro do intervalo informado (inclusive).');
      this.setHelpUrl('');

      this.getInput('FROM')?.connection?.setShadowDom(createNumberShadowBlock(Blockly, '1'));
      this.getInput('TO')?.connection?.setShadowDom(createNumberShadowBlock(Blockly, '10'));
    },
  };

  Blockly.Blocks.variable_random_float = {
    init() {
      this.appendDummyInput().appendField('decimal aleatório');
      this.setOutput(true, 'Number');
      this.setColour('#1c1f7a');
      this.setTooltip('Gera um número decimal aleatório entre 0 (inclusive) e 1 (exclusivo).');
      this.setHelpUrl('');
    },
  };

  Blockly.defineBlocksWithJsonArray([
    {
      type: 'amado_ultrasonic_read',
      message0: 'obter distância (cm)',
      args0: [],
      output: 'Number',
      colour: '#708090',
      tooltip: 'Lê a distância usando o sensor ultrassônico já iniciado.',
      helpUrl: '',
    },
    {
      type: 'motor_dc_init',
    },
    {
      type: 'servo_init',
      message0: '%1 Iniciar servo motor',
      args0: [
        {
          type: 'field_image',
          src: 'ui/media/servo.png',
          width: 50,
          height: 50,
          alt: 'Servo',
        },
      ],
      message1: 'Nome do servo: %1',
      args1: [
        {
          type: 'field_input',
          name: 'NAME',
          text: 'servo1',
        },
      ],
      message2: 'pino %1',
      args2: [
        {
          type: 'input_value',
          name: 'PIN',
          check: 'String',
        },
      ],
      previousStatement: null,
      nextStatement: null,
      colour: '#708090',
      inputsInline: false,
      tooltip: 'Inicializa um servo motor indicando um nome e o pino de sinal (PWM).',
      helpUrl: '',
    },
  ]);

  Blockly.Blocks.amado_set_pin = {
    init() {
      const pinInput = this.appendValueInput('PIN')
        .setCheck('String')
        .appendField('ajustar pino de saída');
      const levelInput = this.appendValueInput('LEVEL')
        .setCheck('Boolean')
        .appendField('para');
      this.setInputsInline(false);
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour('#708090');
      this.setTooltip('Configura o nível lógico de um pino digital da placa Amado ESP32.');
      this.setHelpUrl('');

      pinInput?.connection?.setShadowDom(createPinSelectorShadow(Blockly));
      if (levelInput?.connection) {
        const shadow = Blockly.utils.xml.createElement('shadow');
        shadow.setAttribute('type', 'logic_boolean');
        const field = Blockly.utils.xml.createElement('field');
        field.setAttribute('name', 'BOOL');
        field.textContent = 'TRUE';
        shadow.appendChild(field);
        levelInput.connection.setShadowDom(shadow);
      }
    },
  };

  Blockly.Blocks.amado_serial_log = {
    init() {
      const input = this.appendValueInput('VALUE')
        .setCheck(null)
        .appendField('Print');
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour('#1c1f7a');
      this.setTooltip('Envia dados para o monitor serial.');
      this.setHelpUrl('');

      const shadow = createTextShadowBlock(Blockly);
      input?.connection?.setShadowDom(shadow);
    },
  };

  Blockly.Blocks.amado_wait = {
    init() {
      const input = this.appendValueInput('MS').setCheck('Number').appendField('aguardar');
      this.appendDummyInput().appendField('ms');
      this.setInputsInline(true);
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour('#d9a600');
      this.setTooltip('Pausa a execução do programa pelo tempo indicado (em milissegundos).');
      this.setHelpUrl('');

      const connection = input?.connection;
      if (connection) {
        const shadow = createWaitShadowBlock(Blockly);
        connection.setShadowDom(shadow);
      }
    },
  };

  Blockly.Blocks.amado_pin_selector = {
    init() {
      this.appendDummyInput()
        .appendField('pino')
        .appendField(new Blockly.FieldDropdown(pinOptions), 'PIN');
      this.setOutput(true, 'String');
      this.setColour('#708090');
      this.setTooltip('Seleciona um pino digital da placa.');
      this.setHelpUrl('');
    },
  };

  Blockly.Blocks.amado_pin_level = {
    init() {
      this.appendDummyInput().appendField(
        new Blockly.FieldDropdown([
          ['HIGH (3V3)', "'HIGH'"],
          ['LOW (GND)', "'LOW'"],
        ]),
        'LEVEL',
      );
      this.setOutput(true, 'String');
      this.setColour('#708090');
      this.setTooltip('Seleciona o nível lógico (HIGH/LOW).');
      this.setHelpUrl('');
    },
  };

  Blockly.Blocks.amado_read_digital = {
    init() {
      const pinInput = this.appendValueInput('PIN')
        .setCheck('String')
        .appendField('ler entrada digital');
      const pullupInput = this.appendValueInput('PULLUP')
        .setCheck('Boolean')
        .appendField('Pull-up');
      this.setInputsInline(false);
      this.setOutput(true, 'Boolean');
      this.setColour('#708090');
      this.setTooltip('Lê o nível lógico (HIGH/LOW) do pino selecionado.');
      this.setHelpUrl('');

      pinInput?.connection?.setShadowDom(createPinSelectorShadow(Blockly));
      // Compat: alguns workspaces antigos salvam o pino como campo 'PIN'; criamos um field oculto para evitar warnings.
      this.appendDummyInput('_PIN_COMPAT').appendField(new Blockly.FieldLabel(''), 'PIN').setVisible(false);
      if (pullupInput?.connection) {
        const shadow = Blockly.utils.xml.createElement('shadow');
        shadow.setAttribute('type', 'logic_boolean');
        const field = Blockly.utils.xml.createElement('field');
        field.setAttribute('name', 'BOOL');
        field.textContent = 'TRUE';
        shadow.appendChild(field);
        pullupInput.connection.setShadowDom(shadow);
      }
    },
  };

  Blockly.Blocks.amado_read_analog = {
    init() {
      this.appendDummyInput().appendField('Ler entrada analógica');
      this.appendDummyInput()
        .appendField(
          new Blockly.FieldDropdown([
            ['ATTN_0DB', 'ATTN_0DB'],
            ['ATTN_2_5DB', 'ATTN_2_5DB'],
            ['ATTN_6DB', 'ATTN_6DB'],
            ['ATTN_11DB', 'ATTN_11DB'],
          ]),
          'ATTN',
        );
      this.appendDummyInput()
        .appendField(
          new Blockly.FieldDropdown([
            ['WIDTH_9BIT', 'WIDTH_9BIT'],
            ['WIDTH_10BIT', 'WIDTH_10BIT'],
            ['WIDTH_11BIT', 'WIDTH_11BIT'],
            ['WIDTH_12BIT', 'WIDTH_12BIT'],
          ]),
          'WIDTH',
        );
      const pinInput = this.appendValueInput('PIN')
        .setCheck('String')
        .appendField('pino');
      this.setInputsInline(false);
      this.setOutput(true, 'Number');
      this.setColour('#708090');
      this.setTooltip('Lê o valor analógico do pino selecionado (0 a 4095 nos pinos ADC).');
      this.setHelpUrl('');

      pinInput?.connection?.setShadowDom(createPinSelectorShadow(Blockly));
    },
  };

  const pwmChannelField = () =>
    new (Blockly.FieldNumber ?? Blockly.FieldInput)(0, 0, 15, 1);

  Blockly.Blocks.amado_pwm_setup = {
    init() {
      this.appendDummyInput()
        .appendField('PWM #')
        .appendField(pwmChannelField(), 'CHANNEL');
      const pinInput = this.appendValueInput('PIN')
        .setCheck('String')
        .setAlign(Blockly.ALIGN_RIGHT)
        .appendField('pino');
      const freqInput = this.appendValueInput('FREQ')
        .setCheck('Number')
        .setAlign(Blockly.ALIGN_RIGHT)
        .appendField('Frequência');
      const dutyInput = this.appendValueInput('DUTY')
        .setCheck('Number')
        .setAlign(Blockly.ALIGN_RIGHT)
        .appendField('Ciclo de trabalho');
      this.setInputsInline(false);
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour('#708090');
      this.setTooltip('Configura um canal PWM (pino, frequência e ciclo de trabalho).');
      this.setHelpUrl('');

      pinInput?.connection?.setShadowDom(createPinSelectorShadow(Blockly));
      freqInput?.connection?.setShadowDom(createNumberShadowBlock(Blockly, '1000'));
      dutyInput?.connection?.setShadowDom(createNumberShadowBlock(Blockly, '50'));
    },
  };

  Blockly.Blocks.amado_pwm_set_frequency = {
    init() {
      const freqInput = this.appendValueInput('FREQ')
        .setCheck('Number')
        .appendField('PWM #')
        .appendField(pwmChannelField(), 'CHANNEL')
        .appendField('Frequência');
      this.setInputsInline(false);
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour('#708090');
      this.setTooltip('Ajusta a frequência de um canal PWM.');
      this.setHelpUrl('');

      freqInput?.connection?.setShadowDom(createNumberShadowBlock(Blockly, '1000'));
    },
  };

  Blockly.Blocks.amado_pwm_set_duty = {
    init() {
      const dutyInput = this.appendValueInput('DUTY')
        .setCheck('Number')
        .appendField('PWM #')
        .appendField(pwmChannelField(), 'CHANNEL')
        .appendField('Ciclo de trabalho');
      this.setInputsInline(false);
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour('#708090');
      this.setTooltip('Ajusta o ciclo de trabalho (duty) de um canal PWM (0 a 100%).');
      this.setHelpUrl('');

      dutyInput?.connection?.setShadowDom(createNumberShadowBlock(Blockly, '50'));
    },
  };

  Blockly.Blocks.amado_pwm_start = {
    init() {
      this.appendDummyInput()
        .appendField('PWM #')
        .appendField(pwmChannelField(), 'CHANNEL')
        .appendField('Iniciar');
      const pinInput = this.appendValueInput('PIN')
        .setCheck('String')
        .setAlign(Blockly.ALIGN_RIGHT)
        .appendField('pino');
      this.setInputsInline(true);
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour('#708090');
      this.setTooltip('Inicia a saída PWM em um pino usando o canal informado.');
      this.setHelpUrl('');

      pinInput?.connection?.setShadowDom(createPinSelectorShadow(Blockly));
    },
  };

  Blockly.Blocks.amado_pwm_stop = {
    init() {
      this.appendDummyInput()
        .appendField('Desativar PWM #')
        .appendField(pwmChannelField(), 'CHANNEL');
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour('#708090');
      this.setTooltip('Desativa o canal PWM e desliga a saída.');
      this.setHelpUrl('');
    },
  };

  Blockly.Blocks.motor_dc_set_power = {
    init() {
      this.appendDummyInput()
        .appendField('Definir potência do motor DC  -  Potência:');

      const powerInput = this.appendValueInput('POWER').setCheck('Number');

      this.appendDummyInput()
        .appendField(createMotorNameField(Blockly) ?? 'Motor A', 'NAME');

      this.setInputsInline(true);
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour('#708090');
      this.setTooltip('Define o PWM aplicado ao motor DC (0 a 1023).');
      this.setHelpUrl('');

      const connection = powerInput?.connection;
      if (connection) {
        const shadow = createNumberShadowBlock(Blockly, '70');
        connection.setShadowDom(shadow);
      }
    },
  };

  Blockly.Blocks.motor_dc_set_direction = {
    init() {
      this.appendDummyInput()
        .appendField('Definir direção do motor DC  -  Direção:');

      const dirInput = this.appendValueInput('DIRECTION_NUM')
        .setCheck('Number')
        .setAlign(Blockly.ALIGN_RIGHT);

      this.appendDummyInput()
        .appendField(createMotorNameField(Blockly) ?? 'Motor A', 'NAME');

      this.setInputsInline(true);
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour('#708090');
      this.setTooltip('Define o sentido de rotação do motor: horário ou anti-horário.');
      this.setHelpUrl('');

      const dirConn = dirInput?.connection;
      if (dirConn) {
        const shadow = createNumberShadowBlock(Blockly, '1');
        dirConn.setShadowDom(shadow);
      }
    },
  };

  Blockly.Blocks.motor_dc_init = {
    init() {
      const FieldImage = Blockly.FieldImage || Blockly.FieldImageSvg || Blockly.FieldImageHtml;
      this.appendDummyInput()
        .appendField(
          FieldImage
            ? new FieldImage('/ui/media/dcmotor.png', 32, 32, 'Motor DC')
            : 'Iniciar motor DC',
        )
        .appendField(FieldImage ? 'Iniciar motor DC' : '');

      const pwmInput = this.appendValueInput('PWM')
        .setCheck('String')
        .setAlign(Blockly.ALIGN_RIGHT)
        .appendField('PWM');
      const dir1Input = this.appendValueInput('DIR1')
        .setCheck('String')
        .setAlign(Blockly.ALIGN_RIGHT)
        .appendField('Direção 1');
      const dir2Input = this.appendValueInput('DIR2')
        .setCheck('String')
        .setAlign(Blockly.ALIGN_RIGHT)
        .appendField('Direção 2');

      this.appendDummyInput()
        .appendField('Nome do motor:')
        .appendField(createMotorNameField(Blockly) ?? 'Motor A', 'NAME');

      pwmInput?.connection?.setShadowDom(createPinSelectorShadow(Blockly));
      dir1Input?.connection?.setShadowDom(createPinSelectorShadow(Blockly));
      dir2Input?.connection?.setShadowDom(createPinSelectorShadow(Blockly));

      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour('#708090');
      this.setTooltip('Configura o motor DC mapeando os pinos PWM, DIR1 e DIR2 da placa Amado.');
      this.setHelpUrl('');
      this.setInputsInline(false);
    },
  };

  Blockly.Blocks.motor_dc_stop = {
    init() {
      this.appendDummyInput()
        .appendField('Parar motor DC')
        .appendField(createMotorNameField(Blockly) ?? 'Motor A', 'NAME');

      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour('#708090');
      this.setTooltip('Desliga o motor DC e coloca os pinos de direção em LOW.');
      this.setHelpUrl('');
    },
  };

  Blockly.Blocks.servo_init = {
    init() {
      const FieldImage = Blockly.FieldImage || Blockly.FieldImageSvg || Blockly.FieldImageHtml;
      this.appendDummyInput()
        .appendField(
          FieldImage
            ? new FieldImage('/ui/media/servo.png', 50, 50, 'Servo')
            : 'Iniciar servo motor',
        )
        .appendField(FieldImage ? 'Iniciar servo motor' : '');

      this.appendDummyInput()
        .appendField('Nome do servo:')
        .appendField(createServoNameField(Blockly, 'servo1') ?? 'servo1', 'NAME');

      const pin = this.appendValueInput('PIN')
        .setCheck('String')
        .setAlign(Blockly.ALIGN_RIGHT)
        .appendField('pino');

      this.setInputsInline(false);
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour('#708090');
      this.setTooltip('Inicializa um servo motor indicando um nome e o pino de sinal (PWM).');
      this.setHelpUrl('');

      const conn = pin?.connection;
      if (conn) {
        const shadow = createPinSelectorShadow(Blockly);
        conn.setShadowDom(shadow);
      }

      this.setOnChange(function () {
        if (!this.workspace || this.workspace.isFlyout) return;
        const insideLoop = isBlockInsideLoop(this);
        const warning = insideLoop
          ? 'Coloque este bloco fora de laços: configure o servo apenas uma vez antes do loop.'
          : null;
        this.setWarningText(warning);
        if (insideLoop && !this.__servoWarned) {
          this.__servoWarned = true;
          showAlert('Bloco de init do servo deve ficar fora do loop.');
        }
        if (!insideLoop) {
          this.__servoWarned = false;
        }
      });
    },
  };

  Blockly.Blocks.servo_move = {
    init() {
      this.appendDummyInput()
        .appendField('mover servo')
        .appendField(createServoNameField(Blockly, 'Servo 1') ?? 'Servo 1', 'NAME');

      const angleInput = this.appendValueInput('ANGLE')
        .setCheck('Number')
        .setAlign(Blockly.ALIGN_LEFT)
        .appendField('Ângulo');

      this.setInputsInline(false);
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour('#708090');
      this.setTooltip('Move o servo informado para o ângulo desejado (0° a 180°).');
      this.setHelpUrl('');

      const conn = angleInput?.connection;
      if (conn) {
        const shadow = createNumberShadowBlock(Blockly, '90');
        conn.setShadowDom(shadow);
      }
    },
  };

  const oledBlockColour = '#708090';

  Blockly.Blocks.oled_display_init = {
    init() {
      this.appendDummyInput().appendField('Iniciar display OLED SSD1306 I2C');

      const i2cInput = this.appendValueInput('I2C')
        .setCheck('Number')
        .setAlign(Blockly.ALIGN_RIGHT)
        .appendField('I2C');
      const sclInput = this.appendValueInput('SCL')
        .setCheck('String')
        .setAlign(Blockly.ALIGN_RIGHT)
        .appendField('SCL');
      const sdaInput = this.appendValueInput('SDA')
        .setCheck('String')
        .setAlign(Blockly.ALIGN_RIGHT)
        .appendField('SDA');

      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour(oledBlockColour);
      this.setTooltip('Inicializa o display OLED conectado aos pinos SCL/SDA informados.');
      this.setHelpUrl('');

      i2cInput?.connection?.setShadowDom(createNumberShadowBlock(Blockly, '1'));
      sclInput?.connection?.setShadowDom(createPinSelectorShadow(Blockly));
      sdaInput?.connection?.setShadowDom(createPinSelectorShadow(Blockly));
    },
  };

  Blockly.Blocks.oled_display_write_text = {
    init() {
      this.appendDummyInput().appendField('Escrever texto no display');
      const xInput = this.appendValueInput('X')
        .setCheck('Number')
        .setAlign(Blockly.ALIGN_RIGHT)
        .appendField('Posição X');
      const yInput = this.appendValueInput('Y')
        .setCheck('Number')
        .setAlign(Blockly.ALIGN_RIGHT)
        .appendField('Posição Y');
      const textInput = this.appendValueInput('TEXT')
        .setCheck('String')
        .setAlign(Blockly.ALIGN_RIGHT)
        .appendField('Texto');

      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour(oledBlockColour);
      this.setTooltip('Escreve um texto no buffer do display nas coordenadas indicadas.');
      this.setHelpUrl('');

      xInput?.connection?.setShadowDom(createNumberShadowBlock(Blockly, '40'));
      yInput?.connection?.setShadowDom(createNumberShadowBlock(Blockly, '40'));
      textInput?.connection?.setShadowDom(createTextShadowBlock(Blockly));
    },
  };

  Blockly.Blocks.oled_display_write_value = {
    init() {
      this.appendDummyInput().appendField('Exibir valor no display');
      const xInput = this.appendValueInput('X')
        .setCheck('Number')
        .setAlign(Blockly.ALIGN_RIGHT)
        .appendField('Posição X');
      const yInput = this.appendValueInput('Y')
        .setCheck('Number')
        .setAlign(Blockly.ALIGN_RIGHT)
        .appendField('Posição Y');
      const valueInput = this.appendValueInput('VALUE')
        .setCheck('Number')
        .setAlign(Blockly.ALIGN_RIGHT)
        .appendField('Valor');

      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour(oledBlockColour);
      this.setTooltip('Mostra um valor numérico convertido em texto nas coordenadas do display.');
      this.setHelpUrl('');

      xInput?.connection?.setShadowDom(createNumberShadowBlock(Blockly, '40'));
      yInput?.connection?.setShadowDom(createNumberShadowBlock(Blockly, '40'));
      valueInput?.connection?.setShadowDom(createNumberShadowBlock(Blockly, '0'));
    },
  };

  Blockly.Blocks.oled_display_show = {
    init() {
      this.appendDummyInput().appendField('Atualizar display OLED');
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour(oledBlockColour);
      this.setTooltip('Atualiza o display exibindo o conteúdo escrito no buffer.');
      this.setHelpUrl('');
    },
  };

  Blockly.Blocks.oled_display_clear = {
    init() {
      this.appendDummyInput().appendField('Limpar display OLED');
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour(oledBlockColour);
      this.setTooltip('Limpa o conteúdo atual do display OLED.');
      this.setHelpUrl('');
    },
  };

  Blockly.Blocks.amado_ultrasonic_init = {
    init() {
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour('#708090');
      this.setTooltip('Configura o sensor ultrassônico informando pinos TRIG/ECHO e tempo limite.');
      this.setHelpUrl('');
      this.appendDummyInput()
        .appendField(new Blockly.FieldImage('/ui/media/hcsr04.png', 55, 55, '*'))
        .appendField('Iniciar sensor ultrassônico HCSR04');
      const trigInput = this.appendValueInput('TRIG')
        .setCheck('String')
        .setAlign(Blockly.ALIGN_RIGHT)
        .appendField('Pino trigger');
      const echoInput = this.appendValueInput('ECHO')
        .setCheck('String')
        .setAlign(Blockly.ALIGN_RIGHT)
        .appendField('Pino echo');
      const timeoutInput = this.appendValueInput('TIMEOUT')
        .setCheck('Number')
        .setAlign(Blockly.ALIGN_RIGHT)
        .appendField('Tempo limite (µs)');
      this.setInputsInline(false);

      timeoutInput.connection?.setShadowDom(createNumberShadowBlock(Blockly, '10000'));
      const trigShadow = Blockly.utils.xml.createElement('shadow');
      trigShadow.setAttribute('type', 'amado_pin_selector');
      const trigField = Blockly.utils.xml.createElement('field');
      trigField.setAttribute('name', 'PIN');
      trigField.textContent = 'D2';
      trigShadow.appendChild(trigField);
      trigInput.connection?.setShadowDom(trigShadow);

      const echoShadow = Blockly.utils.xml.createElement('shadow');
      echoShadow.setAttribute('type', 'amado_pin_selector');
      const echoField = Blockly.utils.xml.createElement('field');
      echoField.setAttribute('name', 'PIN');
      echoField.textContent = 'D2';
      echoShadow.appendChild(echoField);
      echoInput.connection?.setShadowDom(echoShadow);

      this.setOnChange(function () {
        if (!this.workspace || this.workspace.isFlyout) return;
        const insideLoop = isBlockInsideLoop(this);
        const warning = insideLoop
          ? 'Coloque este bloco fora de laços: configure o sensor uma única vez antes do loop.'
          : null;
        this.setWarningText(warning);
        const alreadyWarned = this.__loopWarnedOnce;
        if (insideLoop && !alreadyWarned) {
          this.__loopWarnedOnce = true;
          showAlert('Bloco de init do ultrassônico deve ficar fora do loop.');
        }
        if (!insideLoop) {
          this.__loopWarnedOnce = false;
        }
      });
    },
  };

  const javascriptGenerator = Blockly.JavaScript ?? Blockly?.javascriptGenerator;
  if (!javascriptGenerator) return;

  const orderAwait =
    (javascriptGenerator.ORDER_AWAIT ?? javascriptGenerator.ORDER_NONE ?? 0);
  const orderAtomic =
    (javascriptGenerator.ORDER_ATOMIC ?? javascriptGenerator.ORDER_NONE ?? 0);
  const orderConditional =
    (javascriptGenerator.ORDER_CONDITIONAL ?? javascriptGenerator.ORDER_NONE ?? 0);
  const orderMultiplication =
    (javascriptGenerator.ORDER_MULTIPLICATION ?? javascriptGenerator.ORDER_NONE ?? 0);
  const orderFunctionCall =
    (javascriptGenerator.ORDER_FUNCTION_CALL ?? javascriptGenerator.ORDER_NONE ?? 0);
  const orderNone =
    javascriptGenerator.ORDER_NONE ?? 0;

  // Inserir um yield mínimo dentro dos laços para não travar o navegador
  const LOOP_YIELD_MS = 5;
  const appendLoopYield = (branch = '') => `${branch}await api.wait(${LOOP_YIELD_MS});\n`;

  // Geradores blocos de controle adicionais
  javascriptGenerator.forBlock.amado_for_each_item = function amadoForEachItem(block) {
    const list =
      javascriptGenerator.valueToCode(block, 'LIST', javascriptGenerator.ORDER_NONE) || '[]';
    const variable = javascriptGenerator.nameDB_.getName(
      block.getFieldValue('VAR'),
      Blockly.VARIABLE_CATEGORY_NAME || 'VARIABLE',
    );
    let branch = javascriptGenerator.statementToCode(block, 'DO');
    branch = javascriptGenerator.addLoopTrap(branch, block.id);
    branch = appendLoopYield(branch);
    const code = `for (const ${variable} of (${list})) {\n${branch}}\n`;
    return code;
  };

  javascriptGenerator.forBlock.amado_break_loop = function amadoBreakLoop() {
    return 'break;\n';
  };

  // Geradores blocos de lógica/matemática adicionais
  javascriptGenerator.forBlock.amado_logic_ternary = function amadoLogicTernary(block) {
    const condition =
      javascriptGenerator.valueToCode(block, 'COND', javascriptGenerator.ORDER_NONE) || 'false';
    const ifTrue =
      javascriptGenerator.valueToCode(block, 'IF_TRUE', javascriptGenerator.ORDER_NONE) || 'null';
    const ifFalse =
      javascriptGenerator.valueToCode(block, 'IF_FALSE', javascriptGenerator.ORDER_NONE) || 'null';
    return [`((${condition}) ? ${ifTrue} : ${ifFalse})`, orderConditional];
  };

  javascriptGenerator.forBlock.amado_map_range = function amadoMapRange(block) {
    const value =
      javascriptGenerator.valueToCode(block, 'VALUE', javascriptGenerator.ORDER_NONE) || '0';
    const inMin =
      javascriptGenerator.valueToCode(block, 'IN_MIN', javascriptGenerator.ORDER_NONE) || '0';
    const inMax =
      javascriptGenerator.valueToCode(block, 'IN_MAX', javascriptGenerator.ORDER_NONE) || '1';
    const outMin =
      javascriptGenerator.valueToCode(block, 'OUT_MIN', javascriptGenerator.ORDER_NONE) || '0';
    const outMax =
      javascriptGenerator.valueToCode(block, 'OUT_MAX', javascriptGenerator.ORDER_NONE) || '0';
    const code = `((${value} - (${inMin})) * ((${outMax}) - (${outMin})) / (((${inMax}) - (${inMin})) || 1) + (${outMin}))`;
    return [code, orderMultiplication];
  };

  javascriptGenerator.forBlock.amado_min_between = function amadoMinBetween(block) {
    const a =
      javascriptGenerator.valueToCode(block, 'A', javascriptGenerator.ORDER_NONE) || '0';
    const b =
      javascriptGenerator.valueToCode(block, 'B', javascriptGenerator.ORDER_NONE) || '0';
    return [`Math.min(${a}, ${b})`, orderFunctionCall];
  };

  javascriptGenerator.forBlock.amado_max_between = function amadoMaxBetween(block) {
    const a =
      javascriptGenerator.valueToCode(block, 'A', javascriptGenerator.ORDER_NONE) || '0';
    const b =
      javascriptGenerator.valueToCode(block, 'B', javascriptGenerator.ORDER_NONE) || '0';
    return [`Math.max(${a}, ${b})`, orderFunctionCall];
  };

  javascriptGenerator.forBlock.amado_to_int = function amadoToInt(block) {
    const value =
      javascriptGenerator.valueToCode(block, 'VALUE', javascriptGenerator.ORDER_NONE) || '0';
    return [`Math.trunc(Number(${value}) || 0)`, orderFunctionCall];
  };

  javascriptGenerator.forBlock.amado_to_float = function amadoToFloat(block) {
    const value =
      javascriptGenerator.valueToCode(block, 'VALUE', javascriptGenerator.ORDER_NONE) || '0';
    return [`Number(${value}) || 0`, orderFunctionCall];
  };

  // Geradores para blocos de variáveis customizados
  javascriptGenerator.forBlock.variable_boolean_const = function variableBooleanConst(block) {
    const bool = block.getFieldValue('BOOL') === 'TRUE' ? 'true' : 'false';
    return [bool, orderAtomic];
  };

  javascriptGenerator.forBlock.amado_null_const = function amadoNullConst() {
    return ['null', orderAtomic];
  };

  javascriptGenerator.forBlock.variable_number_const = function variableNumberConst(block) {
    const num = Number(block.getFieldValue('NUM')) || 0;
    return [String(num), orderAtomic];
  };

  javascriptGenerator.forBlock.variable_pi_const = function variablePiConst(block) {
    const choice = block.getFieldValue ? block.getFieldValue('CONST') : null;
    const key = choice || 'PI';
    const map = {
      PI: 'Math.PI',
      E: 'Math.E',
      PHI: '(1 + Math.sqrt(5)) / 2',
      SQRT2: 'Math.SQRT2',
      SQRT1_2: 'Math.SQRT1_2',
      INF: 'Infinity',
    };
    return [map[key] ?? 'Math.PI', orderAtomic];
  };

  javascriptGenerator.forBlock.variable_random_int = function variableRandomInt(block) {
    const from = javascriptGenerator.valueToCode(block, 'FROM', javascriptGenerator.ORDER_NONE) || '0';
    const to = javascriptGenerator.valueToCode(block, 'TO', javascriptGenerator.ORDER_NONE) || '0';
    const code = `Math.floor(Math.random() * ((${to}) - (${from}) + 1) + (${from}))`;
    return [code, javascriptGenerator.ORDER_FUNCTION_CALL];
  };

  javascriptGenerator.forBlock.variable_random_float = function variableRandomFloat() {
    return ['Math.random()', orderFunctionCall];
  };

  // Geradores para blocos de texto
  javascriptGenerator.forBlock.amado_text_literal = function amadoTextLiteral(block) {
    const text = block.getFieldValue('TEXT') ?? '';
    return [javascriptGenerator.quote_(text), orderAtomic];
  };

  javascriptGenerator.forBlock.amado_text_join = function amadoTextJoin(block) {
    const parts = block.inputList
      .filter((input) => input.name && input.name.startsWith('ADD'))
      .map((input) => javascriptGenerator.valueToCode(block, input.name, orderNone) || "''");
    if (parts.length === 0) return ["''", orderAtomic];
    if (parts.length === 1) return [parts[0], orderNone];
    const code = `[${parts.join(', ')}].join('')`;
    return [code, orderFunctionCall];
  };

  // Geradores para bloco de texto
  javascriptGenerator.forBlock.amado_text_literal = function amadoTextLiteral(block) {
    const text = block.getFieldValue('TEXT') ?? '';
    return [javascriptGenerator.quote_(text), orderAtomic];
  };

  javascriptGenerator.forBlock.amado_set_pin = function amadoSetPin(block) {
    const pin =
      javascriptGenerator.valueToCode(block, 'PIN', javascriptGenerator.ORDER_NONE) || "''";
    const levelBool =
      javascriptGenerator.valueToCode(block, 'LEVEL', javascriptGenerator.ORDER_NONE) || 'false';
    const level = `((${levelBool}) ? 'HIGH' : 'LOW')`;
    return `await api.setPin(${pin}, ${level});\n`;
  };

  javascriptGenerator.forBlock.amado_wait = function amadoWait(block) {
    const value =
      javascriptGenerator.valueToCode(block, 'MS', javascriptGenerator.ORDER_NONE) ||
      '0';
    return `await api.wait(${value});\n`;
  };

  javascriptGenerator.forBlock.amado_read_digital = function amadoReadDigital(block) {
    const pin =
      javascriptGenerator.valueToCode(block, 'PIN', javascriptGenerator.ORDER_NONE) || "''";
    const code = `await api.readDigital(${pin})`;
    return [code, orderAwait];
  };

  javascriptGenerator.forBlock.amado_read_analog = function amadoReadAnalog(block) {
    const pin =
      javascriptGenerator.valueToCode(block, 'PIN', javascriptGenerator.ORDER_NONE) || "''";
    const code = `await api.readAnalog(${pin})`;
    return [code, orderAwait];
  };

  javascriptGenerator.forBlock.amado_pwm_setup = function amadoPwmSetup(block) {
    const channel = Number(block.getFieldValue('CHANNEL')) || 0;
    const pin =
      javascriptGenerator.valueToCode(block, 'PIN', javascriptGenerator.ORDER_NONE) || "''";
    const freq =
      javascriptGenerator.valueToCode(block, 'FREQ', javascriptGenerator.ORDER_NONE) || '0';
    const duty =
      javascriptGenerator.valueToCode(block, 'DUTY', javascriptGenerator.ORDER_NONE) || '0';
    return `await api.pwmSetup(${channel}, ${pin}, ${freq}, ${duty});\n`;
  };

  javascriptGenerator.forBlock.amado_pwm_set_frequency = function amadoPwmSetFrequency(block) {
    const channel = Number(block.getFieldValue('CHANNEL')) || 0;
    const freq =
      javascriptGenerator.valueToCode(block, 'FREQ', javascriptGenerator.ORDER_NONE) || '0';
    return `await api.pwmSetFrequency(${channel}, ${freq});\n`;
  };

  javascriptGenerator.forBlock.amado_pwm_set_duty = function amadoPwmSetDuty(block) {
    const channel = Number(block.getFieldValue('CHANNEL')) || 0;
    const duty =
      javascriptGenerator.valueToCode(block, 'DUTY', javascriptGenerator.ORDER_NONE) || '0';
    return `await api.pwmSetDuty(${channel}, ${duty});\n`;
  };

  javascriptGenerator.forBlock.amado_pwm_start = function amadoPwmStart(block) {
    const channel = Number(block.getFieldValue('CHANNEL')) || 0;
    const pin =
      javascriptGenerator.valueToCode(block, 'PIN', javascriptGenerator.ORDER_NONE) || "''";
    return `await api.pwmStart(${channel}, ${pin});\n`;
  };

  javascriptGenerator.forBlock.amado_pwm_stop = function amadoPwmStop(block) {
    const channel = Number(block.getFieldValue('CHANNEL')) || 0;
    return `await api.pwmStop(${channel});\n`;
  };

  javascriptGenerator.forBlock.amado_ultrasonic_init = function amadoUltrasonicInit(block) {
    const trig =
      javascriptGenerator.valueToCode(block, 'TRIG', javascriptGenerator.ORDER_NONE) || "''";
    const echo =
      javascriptGenerator.valueToCode(block, 'ECHO', javascriptGenerator.ORDER_NONE) || "''";
    const timeout =
      javascriptGenerator.valueToCode(block, 'TIMEOUT', javascriptGenerator.ORDER_NONE) ||
      '10000';
    return `await api.ultrasonicInit(${trig}, ${echo}, ${timeout});\n`;
  };

  javascriptGenerator.forBlock.amado_ultrasonic_read = function amadoUltrasonicRead(block) {
    const code = `await api.ultrasonicRead()`;
    return [code, orderAwait];
  };

  javascriptGenerator.forBlock.amado_serial_log = function amadoSerialLog(block) {
    const value =
      javascriptGenerator.valueToCode(block, 'VALUE', javascriptGenerator.ORDER_NONE) ?? "''";
    return `await api.log(${value});\n`;
  };

  javascriptGenerator.forBlock.amado_pin_selector = function amadoPinSelector(block) {
    const pin = block.getFieldValue('PIN') ?? '';
    return [`'${pin}'`, orderAtomic];
  };

  javascriptGenerator.forBlock.amado_pin_level = function amadoPinLevel(block) {
    const level = block.getFieldValue('LEVEL') ?? "'FLOATING'";
    return [level, orderAtomic];
  };

  javascriptGenerator.forBlock.motor_dc_init = function motorDcInit(block) {
    const name = (block.getFieldValue('NAME') ?? '').trim();
    const pwm =
      javascriptGenerator.valueToCode(block, 'PWM', javascriptGenerator.ORDER_NONE) || "''";
    const dir1 =
      javascriptGenerator.valueToCode(block, 'DIR1', javascriptGenerator.ORDER_NONE) || "''";
    const dir2 =
      javascriptGenerator.valueToCode(block, 'DIR2', javascriptGenerator.ORDER_NONE) || "''";
    return `await api.motorDcInit(${JSON.stringify(name)}, ${pwm}, ${dir1}, ${dir2});\n`;
  };

  javascriptGenerator.forBlock.motor_dc_set_power = function motorDcSetPower(block) {
    const name = (block.getFieldValue('NAME') ?? '').trim();
    const power =
      javascriptGenerator.valueToCode(block, 'POWER', javascriptGenerator.ORDER_NONE) ||
      '0';
    const clamped = `Math.max(0, Math.min(1023, Number(${power}) || 0))`;
    return `await api.motorDcSetPower(${JSON.stringify(name)}, ${clamped});\n`;
  };

  javascriptGenerator.forBlock.motor_dc_set_direction = function motorDcSetDirection(block) {
    const name = (block.getFieldValue('NAME') ?? '').trim();
    const directionRaw =
      javascriptGenerator.valueToCode(block, 'DIRECTION_NUM', javascriptGenerator.ORDER_NONE) ||
      '0';
    const directionNum = `Math.max(0, Math.min(2, Number(${directionRaw}) || 0))`;
    const dirCode =
      `((${directionNum}) === 2 ? 'reverse' : ((${directionNum}) === 1 ? 'forward' : 'stop'))`;
    const final = `((${dirCode}) === 'stop' ? await api.motorDcStop(${JSON.stringify(name)}) : await api.motorDcSetDirection(${JSON.stringify(name)}, ${dirCode}))`;
    return `${final};\n`;
  };

  javascriptGenerator.forBlock.motor_dc_stop = function motorDcStop(block) {
    const name = (block.getFieldValue('NAME') ?? '').trim();
    return `await api.motorDcStop(${JSON.stringify(name)});\n`;
  };

  // Sobrescreve laços padrões para inserir yield implícito e evitar travamentos
  javascriptGenerator.forBlock.controls_repeat_ext = function controlsRepeatExt(block) {
    let repeats = '';
    if (block.getField('TIMES')) {
      repeats = String(Number(block.getFieldValue('TIMES')) || 0);
    } else {
      repeats =
        javascriptGenerator.valueToCode(block, 'TIMES', javascriptGenerator.ORDER_ASSIGNMENT) || '0';
    }
    let branch = javascriptGenerator.statementToCode(block, 'DO');
    branch = javascriptGenerator.addLoopTrap(branch, block.id);
    branch = appendLoopYield(branch);
    const loopVar = javascriptGenerator.nameDB_.getDistinctName(
      'count',
      Blockly.VARIABLE_CATEGORY_NAME || 'VARIABLE',
    );
    return `for (let ${loopVar} = 0; ${loopVar} < ${repeats}; ${loopVar}++) {\n${branch}}\n`;
  };
  javascriptGenerator.forBlock.controls_repeat = javascriptGenerator.forBlock.controls_repeat_ext;

  javascriptGenerator.forBlock.controls_whileUntil = function controlsWhileUntil(block) {
    const until = block.getFieldValue('MODE') === 'UNTIL';
    let condition =
      javascriptGenerator.valueToCode(block, 'BOOL', javascriptGenerator.ORDER_LOGICAL_NOT) || 'false';
    if (until) {
      condition = `!(${condition})`;
    }
    let branch = javascriptGenerator.statementToCode(block, 'DO');
    branch = javascriptGenerator.addLoopTrap(branch, block.id);
    branch = appendLoopYield(branch);
    return `while (${condition}) {\n${branch}}\n`;
  };

  javascriptGenerator.forBlock.controls_for = function controlsFor(block) {
    const variable = javascriptGenerator.nameDB_.getName(
      block.getFieldValue('VAR'),
      Blockly.VARIABLE_CATEGORY_NAME || 'VARIABLE',
    );
    const from =
      javascriptGenerator.valueToCode(block, 'FROM', javascriptGenerator.ORDER_ASSIGNMENT) || '0';
    const to = javascriptGenerator.valueToCode(block, 'TO', javascriptGenerator.ORDER_ASSIGNMENT) || '0';
    const by = javascriptGenerator.valueToCode(block, 'BY', javascriptGenerator.ORDER_ASSIGNMENT) || '1';
    let branch = javascriptGenerator.statementToCode(block, 'DO');
    branch = javascriptGenerator.addLoopTrap(branch, block.id);
    branch = appendLoopYield(branch);
    const code =
      `for (let ${variable} = ${from}; ${variable} <= ${to}; ${variable} += ${by}) {\n${branch}}\n`;
    return code;
  };

  javascriptGenerator.forBlock.controls_forEach = function controlsForEach(block) {
    const variable = javascriptGenerator.nameDB_.getName(
      block.getFieldValue('VAR'),
      Blockly.VARIABLE_CATEGORY_NAME || 'VARIABLE',
    );
    const list =
      javascriptGenerator.valueToCode(block, 'LIST', javascriptGenerator.ORDER_ASSIGNMENT) || '[]';
    let branch = javascriptGenerator.statementToCode(block, 'DO');
    branch = javascriptGenerator.addLoopTrap(branch, block.id);
    branch = appendLoopYield(branch);
    const code = `for (const ${variable} of ${list}) {\n${branch}}\n`;
    return code;
  };

  javascriptGenerator.forBlock.servo_init = function servoInit(block) {
    const name = (block.getFieldValue('NAME') ?? '').trim() || 'Servo';
    const pin =
      javascriptGenerator.valueToCode(block, 'PIN', javascriptGenerator.ORDER_NONE) || "''";
    return `await api.servoInit(${JSON.stringify(name)}, ${pin});\n`;
  };

  javascriptGenerator.forBlock.servo_move = function servoMove(block) {
    const name = (block.getFieldValue('NAME') ?? '').trim() || 'Servo';
    const angle =
      javascriptGenerator.valueToCode(block, 'ANGLE', javascriptGenerator.ORDER_NONE) || '90';
    return `await api.servoMove(${JSON.stringify(name)}, ${angle});\n`;
  };

  javascriptGenerator.forBlock.oled_display_init = function oledDisplayInit(block) {
    const i2c =
      javascriptGenerator.valueToCode(block, 'I2C', javascriptGenerator.ORDER_NONE) || '0';
    const scl =
      javascriptGenerator.valueToCode(block, 'SCL', javascriptGenerator.ORDER_NONE) || "''";
    const sda =
      javascriptGenerator.valueToCode(block, 'SDA', javascriptGenerator.ORDER_NONE) || "''";
    return `await api.oledInit({ i2c: ${i2c}, scl: ${scl}, sda: ${sda} });\n`;
  };

  javascriptGenerator.forBlock.oled_display_write_text = function oledDisplayWriteText(block) {
    const x =
      javascriptGenerator.valueToCode(block, 'X', javascriptGenerator.ORDER_NONE) || '0';
    const y =
      javascriptGenerator.valueToCode(block, 'Y', javascriptGenerator.ORDER_NONE) || '0';
    const text =
      javascriptGenerator.valueToCode(block, 'TEXT', javascriptGenerator.ORDER_NONE) || "''";
    return `await api.oledWriteText(${x}, ${y}, ${text});\n`;
  };

  javascriptGenerator.forBlock.oled_display_write_value = function oledDisplayWriteValue(block) {
    const x =
      javascriptGenerator.valueToCode(block, 'X', javascriptGenerator.ORDER_NONE) || '0';
    const y =
      javascriptGenerator.valueToCode(block, 'Y', javascriptGenerator.ORDER_NONE) || '0';
    const value =
      javascriptGenerator.valueToCode(block, 'VALUE', javascriptGenerator.ORDER_NONE) || '0';
    return `await api.oledWriteValue(${x}, ${y}, ${value});\n`;
  };

  javascriptGenerator.forBlock.oled_display_show = function oledDisplayShow() {
    return 'await api.oledShow();\n';
  };

  javascriptGenerator.forBlock.oled_display_clear = function oledDisplayClear() {
    return 'await api.oledClear();\n';
  };
}
