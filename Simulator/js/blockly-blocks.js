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
      colour: 210,
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
      colour: 210,
      tooltip: 'Retorna o valor analógico (0 a 4095) do pino selecionado.',
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
      colour: 18,
      tooltip: 'Configura o motor DC mapeando os pinos PWM, DIR1 e DIR2 da placa Amado.',
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
      this.setColour(162);
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
        .appendField('enviar para monitor');
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour(200);
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
      this.setColour(210);
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
      this.setColour(195);
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
      this.setColour(195);
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
      this.setColour(18);
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
      this.setColour(18);
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
      this.setColour(18);
      this.setTooltip('Desliga o motor DC e coloca os pinos de direção em LOW.');
      this.setHelpUrl('');
    },
  };

  const javascriptGenerator = Blockly.JavaScript ?? Blockly?.javascriptGenerator;
  if (!javascriptGenerator) return;

  const orderAwait =
    (javascriptGenerator.ORDER_AWAIT ?? javascriptGenerator.ORDER_NONE ?? 0);
  const orderAtomic =
    (javascriptGenerator.ORDER_ATOMIC ?? javascriptGenerator.ORDER_NONE ?? 0);

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
}
