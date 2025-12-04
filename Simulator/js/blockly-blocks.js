import { amadoBoardPins } from './components.js';

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
  const pins = new Set(
    amadoBoardPins
      .filter((pin) => pin.type === 'signal' && !/^MOTOR_/i.test(pin.name))
      .map((pin) => pin.name),
  );

  if (!pins.size) {
    return [['D2', 'D2']];
  }

  return Array.from(pins)
    .sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true }))
    .map((name) => [name, name]);
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
      this.appendDummyInput().appendField('pi');
      this.setOutput(true, 'Number');
      this.setColour('#1c1f7a');
      this.setTooltip('Constante π (pi).');
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

  Blockly.defineBlocksWithJsonArray([
    {
      type: 'amado_read_digital',
      message0: 'ler pino digital %1',
      args0: [
        {
          type: 'field_dropdown',
          name: 'PIN',
          options: pinOptions,
        },
      ],
      output: 'Boolean',
      colour: '#708090',
      tooltip: 'Lê o nível lógico atual (HIGH/LOW) do pino selecionado.',
      helpUrl: '',
    },
    {
      type: 'amado_read_analog',
      message0: 'ler pino analógico %1',
      args0: [
        {
          type: 'field_dropdown',
          name: 'PIN',
          options: pinOptions,
        },
      ],
      output: 'Number',
      colour: '#708090',
      tooltip: 'Retorna o valor analógico (0 a 4095) do pino selecionado.',
      helpUrl: '',
    },
    {
      type: 'amado_ultrasonic_read',
      message0: 'ultrassom TRIG %1 ECHO %2 ler distância (cm)',
      args0: [
        {
          type: 'field_dropdown',
          name: 'TRIG',
          options: pinOptions,
        },
        {
          type: 'field_dropdown',
          name: 'ECHO',
          options: pinOptions,
        },
      ],
      output: 'Number',
      colour: '#708090',
      tooltip: 'Lê a distância medida pelo sensor ultrassônico conectado aos pinos TRIG/ECHO.',
      helpUrl: '',
    },
    {
      type: 'motor_dc_init',
      message0: 'motor DC %1 PWM %2 DIR1 %3 DIR2 %4',
      args0: [
        {
          type: 'field_input',
          name: 'NAME',
          text: 'Motor A',
        },
        {
          type: 'field_dropdown',
          name: 'PWM',
          options: pinOptions,
        },
        {
          type: 'field_dropdown',
          name: 'DIR1',
          options: pinOptions,
        },
        {
          type: 'field_dropdown',
          name: 'DIR2',
          options: pinOptions,
        },
      ],
      previousStatement: null,
      nextStatement: null,
      colour: '#708090',
      tooltip: 'Configura o motor DC mapeando os pinos PWM, DIR1 e DIR2 da placa Amado.',
      helpUrl: '',
    },
    {
      type: 'servo_init',
      message0: 'iniciar servo %1 no pino %2',
      args0: [
        {
          type: 'field_input',
          name: 'NAME',
          text: 'Servo 1',
        },
        {
          type: 'field_dropdown',
          name: 'PIN',
          options: pinOptions,
        },
      ],
      previousStatement: null,
      nextStatement: null,
      colour: '#708090',
      tooltip: 'Inicializa um servo motor indicando um nome e o pino de sinal (PWM).',
      helpUrl: '',
    },
  ]);

  Blockly.Blocks.amado_set_pin = {
    init() {
      const pinInput = this.appendValueInput('PIN')
        .setCheck('String')
        .appendField('definir pino');
      const levelInput = this.appendValueInput('LEVEL')
        .setCheck('String')
        .appendField('como');
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour('#708090');
      this.setTooltip('Configura o nível lógico de um pino digital da placa Amado ESP32.');
      this.setHelpUrl('');

      pinInput?.connection?.setShadowDom(createPinSelectorShadow(Blockly));
      levelInput?.connection?.setShadowDom(createLevelSelectorShadow(Blockly));
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
      this.appendDummyInput().appendField(
        new Blockly.FieldDropdown(pinOptions),
        'PIN',
      );
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
          ['Liberar (flutuante)', "'FLOATING'"],
        ]),
        'LEVEL',
      );
      this.setOutput(true, 'String');
      this.setColour('#708090');
      this.setTooltip('Seleciona o nível lógico (HIGH/LOW/flutuante).');
      this.setHelpUrl('');
    },
  };

  Blockly.Blocks.motor_dc_set_power = {
    init() {
      this.appendDummyInput()
        .appendField('motor')
        .appendField(createMotorNameField(Blockly) ?? 'Motor A', 'NAME');

      const powerInput = this.appendValueInput('POWER')
        .setCheck('Number')
        .appendField('potência (%)');

      this.setInputsInline(true);
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour('#708090');
      this.setTooltip('Define o PWM aplicado ao motor DC (0 a 100%).');
      this.setHelpUrl('');

      const connection = powerInput?.connection;
      if (connection) {
        const shadow = createNumberShadowBlock(Blockly, '100');
        connection.setShadowDom(shadow);
      }
    },
  };

  Blockly.Blocks.motor_dc_set_direction = {
    init() {
      this.appendDummyInput()
        .appendField('motor')
        .appendField(createMotorNameField(Blockly) ?? 'Motor A', 'NAME')
        .appendField('direção')
        .appendField(
          new Blockly.FieldDropdown([
            ['Horário', 'forward'],
            ['Anti-horário', 'reverse'],
          ]),
          'DIRECTION',
        );

      this.setInputsInline(true);
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour('#708090');
      this.setTooltip('Define o sentido de rotação do motor: horário ou anti-horário.');
      this.setHelpUrl('');
    },
  };

  Blockly.Blocks.motor_dc_stop = {
    init() {
      this.appendDummyInput()
        .appendField('motor')
        .appendField(createMotorNameField(Blockly) ?? 'Motor A', 'NAME')
        .appendField('parar');

      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour('#708090');
      this.setTooltip('Desliga o motor DC e coloca os pinos de direção em LOW.');
      this.setHelpUrl('');
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

  // Geradores para blocos de variáveis customizados
  javascriptGenerator.forBlock.variable_boolean_const = function variableBooleanConst(block) {
    const bool = block.getFieldValue('BOOL') === 'TRUE' ? 'true' : 'false';
    return [bool, orderAtomic];
  };

  javascriptGenerator.forBlock.variable_number_const = function variableNumberConst(block) {
    const num = Number(block.getFieldValue('NUM')) || 0;
    return [String(num), orderAtomic];
  };

  javascriptGenerator.forBlock.variable_pi_const = function variablePiConst() {
    return ['Math.PI', orderAtomic];
  };

  javascriptGenerator.forBlock.variable_random_int = function variableRandomInt(block) {
    const from = javascriptGenerator.valueToCode(block, 'FROM', javascriptGenerator.ORDER_NONE) || '0';
    const to = javascriptGenerator.valueToCode(block, 'TO', javascriptGenerator.ORDER_NONE) || '0';
    const code = `Math.floor(Math.random() * ((${to}) - (${from}) + 1) + (${from}))`;
    return [code, javascriptGenerator.ORDER_FUNCTION_CALL];
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
    const pinCode =
      javascriptGenerator.valueToCode(block, 'PIN', javascriptGenerator.ORDER_NONE) || "''";
    const levelCode =
      javascriptGenerator.valueToCode(block, 'LEVEL', javascriptGenerator.ORDER_NONE) || "'FLOATING'";
    return `await api.setPin(${pinCode}, ${levelCode});\n`;
  };

  javascriptGenerator.forBlock.amado_wait = function amadoWait(block) {
    const value =
      javascriptGenerator.valueToCode(block, 'MS', javascriptGenerator.ORDER_NONE) ||
      '0';
    return `await api.wait(${value});\n`;
  };

  javascriptGenerator.forBlock.amado_read_digital = function amadoReadDigital(block) {
    const pin = block.getFieldValue('PIN') ?? '';
    const code = `await api.readDigital('${pin}')`;
    return [code, orderAwait];
  };

  javascriptGenerator.forBlock.amado_read_analog = function amadoReadAnalog(block) {
    const pin = block.getFieldValue('PIN') ?? '';
    const code = `await api.readAnalog('${pin}')`;
    return [code, orderAwait];
  };

  javascriptGenerator.forBlock.amado_ultrasonic_read = function amadoUltrasonicRead(block) {
    const trig = block.getFieldValue('TRIG') ?? '';
    const echo = block.getFieldValue('ECHO') ?? '';
    const code = `await api.ultrasonicRead('${trig}', '${echo}')`;
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
    const pwm = block.getFieldValue('PWM') ?? '';
    const dir1 = block.getFieldValue('DIR1') ?? '';
    const dir2 = block.getFieldValue('DIR2') ?? '';
    const args = [
      JSON.stringify(name),
      JSON.stringify(pwm),
      JSON.stringify(dir1),
      JSON.stringify(dir2),
    ].join(', ');
    return `await api.motorDcInit(${args});\n`;
  };

  javascriptGenerator.forBlock.motor_dc_set_power = function motorDcSetPower(block) {
    const name = (block.getFieldValue('NAME') ?? '').trim();
    const power =
      javascriptGenerator.valueToCode(block, 'POWER', javascriptGenerator.ORDER_NONE) ||
      '0';
    return `await api.motorDcSetPower(${JSON.stringify(name)}, ${power});\n`;
  };

  javascriptGenerator.forBlock.motor_dc_set_direction = function motorDcSetDirection(block) {
    const name = (block.getFieldValue('NAME') ?? '').trim();
    const direction = block.getFieldValue('DIRECTION') ?? 'forward';
    return `await api.motorDcSetDirection(${JSON.stringify(name)}, ${JSON.stringify(direction)});\n`;
  };

  javascriptGenerator.forBlock.motor_dc_stop = function motorDcStop(block) {
    const name = (block.getFieldValue('NAME') ?? '').trim();
    return `await api.motorDcStop(${JSON.stringify(name)});\n`;
  };

  javascriptGenerator.forBlock.servo_init = function servoInit(block) {
    const name = (block.getFieldValue('NAME') ?? '').trim() || 'Servo';
    const pin = block.getFieldValue('PIN') ?? '';
    return `await api.servoInit(${JSON.stringify(name)}, ${JSON.stringify(pin)});\n`;
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
