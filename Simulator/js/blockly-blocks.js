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

function createTextShadowBlock(Blockly) {
  const shadow = Blockly.utils.xml.createElement('shadow');
  shadow.setAttribute('type', 'text');

  const field = Blockly.utils.xml.createElement('field');
  field.setAttribute('name', 'TEXT');
  field.textContent = 'Mensagem';

  shadow.appendChild(field);
  return shadow;
}

function buildPinOptions() {
  const pins = new Set(
    amadoBoardPins
      .filter((pin) => pin.type === 'signal')
      .map((pin) => pin.name),
  );

  if (!pins.size) {
    return [['D2', 'D2']];
  }

  return Array.from(pins)
    .sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true }))
    .map((name) => [name, name]);
}

export function registerAmadoBlocks(Blockly) {
  if (blocksRegistered || !Blockly) return;
  blocksRegistered = true;

  const pinOptions = buildPinOptions();

  Blockly.defineBlocksWithJsonArray([
    {
      type: 'amado_set_pin',
      message0: 'definir pino %1 como %2',
      args0: [
        {
          type: 'field_dropdown',
          name: 'PIN',
          options: pinOptions,
        },
        {
          type: 'field_dropdown',
          name: 'LEVEL',
          options: [
            ['HIGH (3V3)', 'HIGH'],
            ['LOW (GND)', 'LOW'],
            ['Liberar (flutuante)', 'FLOATING'],
          ],
        },
      ],
      previousStatement: null,
      nextStatement: null,
      colour: 162,
      tooltip: 'Configura o nível lógico de um pino digital da placa Amado ESP32.',
      helpUrl: '',
    },
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
  ]);

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

  const javascriptGenerator = Blockly.JavaScript ?? Blockly?.javascriptGenerator;
  if (!javascriptGenerator) return;

  const orderAwait =
    (javascriptGenerator.ORDER_AWAIT ?? javascriptGenerator.ORDER_NONE ?? 0);

  javascriptGenerator.forBlock.amado_set_pin = function amadoSetPin(block) {
    const pin = block.getFieldValue('PIN') ?? '';
    const level = block.getFieldValue('LEVEL') ?? 'FLOATING';
    return `await api.setPin('${pin}', '${level}');\n`;
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
}
