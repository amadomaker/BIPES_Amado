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
  ]);

  Blockly.Blocks.amado_wait = {
    init() {
      this.appendValueInput('MS')
        .setCheck('Number')
        .appendField('aguardar');
      this.appendDummyInput().appendField('ms');
      this.setInputsInline(true);
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour(210);
      this.setTooltip('Pausa a execução do programa pelo tempo indicado (em milissegundos).');
      this.setHelpUrl('');

      const shadow = createWaitShadowBlock(Blockly);
      this.getInput('MS')?.connection?.setShadowDom(shadow);
      this.getInput('MS')?.connection?.setShadowState(shadow);
    },
  };

  const javascriptGenerator = Blockly.JavaScript ?? Blockly?.javascriptGenerator;
  if (!javascriptGenerator) return;

  javascriptGenerator.forBlock.amado_set_pin = function amadoSetPin(block) {
    const pin = block.getFieldValue('PIN') ?? '';
    const level = block.getFieldValue('LEVEL') ?? 'FLOATING';
    return `api.setPin('${pin}', '${level}');\n`;
  };

  javascriptGenerator.forBlock.amado_wait = function amadoWait(block) {
    const value =
      javascriptGenerator.valueToCode(block, 'MS', javascriptGenerator.ORDER_NONE) ||
      '0';
    return `await api.wait(${value});\n`;
  };
}
