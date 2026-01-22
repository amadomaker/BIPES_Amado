import { registerAmadoBlocks } from './blockly-blocks.js';

function applyPortugueseMathMessages(BlocklyInstance) {
  if (!BlocklyInstance || !BlocklyInstance.Msg) return;
  const msg = BlocklyInstance.Msg;
  Object.assign(msg, {
    MATH_SINGLE_OP_ROOT: 'raiz quadrada',
    MATH_SINGLE_OP_ABSOLUTE: 'valor absoluto',
    MATH_SINGLE_OP_NEG: 'negativo',
    LOGIC_BOOLEAN_TRUE: 'verdadeiro',
    LOGIC_BOOLEAN_FALSE: 'falso',
    MATH_SINGLE_TOOLTIP_ROOT: 'Retorna a raiz quadrada de um número.',
    MATH_SINGLE_TOOLTIP_ABS: 'Retorna o valor absoluto.',
    MATH_SINGLE_TOOLTIP_NEG: 'Retorna o negativo do número.',
    MATH_TRIG_SIN: 'sin',
    MATH_TRIG_COS: 'cos',
    MATH_TRIG_TAN: 'tan',
    MATH_TRIG_TOOLTIP_SIN: 'Retorna o seno (graus).',
    MATH_TRIG_TOOLTIP_COS: 'Retorna o cosseno (graus).',
    MATH_TRIG_TOOLTIP_TAN: 'Retorna a tangente (graus).',
    MATH_IS_EVEN: 'é par',
    MATH_IS_ODD: 'é ímpar',
    MATH_IS_PRIME: 'é primo',
    MATH_IS_WHOLE: 'é inteiro',
    MATH_IS_POSITIVE: 'é positivo',
    MATH_IS_NEGATIVE: 'é negativo',
    MATH_IS_DIVISIBLE_BY: 'divisível por',
    MATH_IS_TOOLTIP: 'Verifica se o número atende à condição escolhida.',
    MATH_ROUND_OPERATOR_ROUND: 'arredonda',
    MATH_ROUND_OPERATOR_ROUNDUP: 'arredonda para cima',
    MATH_ROUND_OPERATOR_ROUNDDOWN: 'arredonda para baixo',
    MATH_ROUND_TOOLTIP: 'Arredonda um número para cima ou para baixo.',
    MATH_ONLIST_OPERATOR_SUM: 'soma de uma lista',
    MATH_ONLIST_OPERATOR_MIN: 'mínimo',
    MATH_ONLIST_OPERATOR_MAX: 'máximo',
    MATH_ONLIST_OPERATOR_AVERAGE: 'média',
    MATH_ONLIST_OPERATOR_MEDIAN: 'mediana',
    MATH_ONLIST_OPERATOR_MODE: 'moda',
    MATH_ONLIST_OPERATOR_STD_DEV: 'desvio padrão',
    MATH_ONLIST_OPERATOR_RANDOM: 'item aleatório',
    MATH_ONLIST_TOOLTIP_SUM: 'Retorna a soma de todos os números da lista.',
    MATH_ONLIST_TOOLTIP_MIN: 'Retorna o menor número da lista.',
    MATH_ONLIST_TOOLTIP_MAX: 'Retorna o maior número da lista.',
    MATH_ONLIST_TOOLTIP_AVERAGE: 'Retorna a média aritmética da lista.',
    MATH_MODULO_TITLE: 'resto da divisão de %1 ÷ %2',
    MATH_MODULO_TOOLTIP: 'Retorna o resto da divisão de dois números.',
    MATH_CONSTRAIN_TITLE: 'restringe %1 inferior %2 superior %3',
    MATH_CONSTRAIN_TOOLTIP: 'Restringe um número para que fique entre os limites inferior e superior.',
    MATH_ARITHMETIC_TOOLTIP_ADD: 'Retorna a soma de dois números.',
    MATH_ARITHMETIC_TOOLTIP_MINUS: 'Retorna a diferença de dois números.',
    MATH_ARITHMETIC_TOOLTIP_MULTIPLY: 'Retorna o produto de dois números.',
    MATH_ARITHMETIC_TOOLTIP_DIVIDE: 'Retorna o quociente de dois números.',
    MATH_ARITHMETIC_TOOLTIP_POWER: 'Retorna o primeiro número elevado ao segundo.',
    LISTS_INLIST: 'lista',
    LISTS_CREATE_EMPTY_TITLE: 'criar lista vazia',
    LISTS_CREATE_WITH_INPUT_WITH: 'criar lista com',
    LISTS_CREATE_WITH_CONTAINER_TITLE_ADD: 'itens',
    LISTS_CREATE_WITH_ITEM_TITLE: 'item',
    LISTS_REPEAT_TITLE: 'criar lista com item %1 repetido %2 vezes',
    LISTS_REPEAT_TOOLTIP: 'Cria uma lista com o item fornecido repetido o número de vezes informado.',
  });
}

const DEFAULT_TOOLBOX = {
  kind: 'categoryToolbox',
  contents: [
    {
      kind: 'category',
      name: 'Controle',
      colour: '#d9a600',
      contents: [
        {
          kind: 'category',
          name: 'Laços',
          colour: '#d9a600',
          contents: [
            { kind: 'block', type: 'controls_repeat_ext' },
            { kind: 'block', type: 'controls_whileUntil' },
            { kind: 'block', type: 'controls_for' },
            { kind: 'block', type: 'amado_for_each_item' },
            { kind: 'block', type: 'amado_break_loop' },
          ],
        },
        {
          kind: 'category',
          name: 'Temporização',
          colour: '#d9a600',
          contents: [
            {
              kind: 'block',
              type: 'amado_wait',
              fields: { UNIT: 's' },
              inputs: {
                MS: { shadow: { type: 'math_number', fields: { NUM: 1 } } },
              },
            },
          ],
        },
      ],
    },
    {
      kind: 'category',
      name: 'Matemática',
      colour: '#008000',
      contents: [
        {
          kind: 'category',
          name: 'Lógica',
          colour: '#008000',
          contents: [
            { kind: 'block', type: 'controls_if' },
            { kind: 'block', type: 'logic_compare' },
            { kind: 'block', type: 'logic_operation' },
            { kind: 'block', type: 'logic_negate' },
            { kind: 'block', type: 'amado_logic_ternary' },
            {
              kind: 'block',
              type: 'amado_map_range',
              inputs: {
                VALUE: { shadow: { type: 'math_number', fields: { NUM: 0 } } },
                IN_MIN: { shadow: { type: 'math_number', fields: { NUM: 0 } } },
                IN_MAX: { shadow: { type: 'math_number', fields: { NUM: 1023 } } },
                OUT_MIN: { shadow: { type: 'math_number', fields: { NUM: 0 } } },
                OUT_MAX: { shadow: { type: 'math_number', fields: { NUM: 255 } } },
              },
            },
            { kind: 'block', type: 'amado_min_between' },
            { kind: 'block', type: 'amado_max_between' },
          ],
        },
        {
          kind: 'category',
          name: 'Operadores',
          colour: '#008000',
          contents: [
            { kind: 'block', type: 'math_number' },
            { kind: 'block', type: 'math_arithmetic' },
            { kind: 'block', type: 'math_single' },
            { kind: 'block', type: 'math_trig' },
            { kind: 'block', type: 'math_number_property' },
            { kind: 'block', type: 'math_round' },
            { kind: 'block', type: 'math_on_list' },
            { kind: 'block', type: 'math_modulo' },
            { kind: 'block', type: 'math_constrain' },
            { kind: 'block', type: 'amado_to_int' },
            { kind: 'block', type: 'amado_to_float' },
            { kind: 'block', type: 'math_random_int' },
          ],
        },
      ],
    },
    {
      kind: 'category',
      name: 'Variáveis',
      colour: '#1c1f7a',
      contents: [
        {
          kind: 'category',
          name: 'Variáveis criadas',
          colour: '#1c1f7a',
          custom: 'VARIABLE',
        },
        {
          kind: 'category',
          name: 'Boleanas',
          colour: '#1c1f7a',
          contents: [
            { kind: 'block', type: 'variable_boolean_const' },
            { kind: 'block', type: 'amado_null_const' },
          ],
        },
        {
          kind: 'category',
          name: 'Numéricas',
          colour: '#1c1f7a',
          contents: [
            { kind: 'block', type: 'variable_number_const' },
            { kind: 'block', type: 'variable_pi_const' },
            { kind: 'block', type: 'variable_random_int' },
            { kind: 'block', type: 'variable_random_float' },
          ],
        },
        {
          kind: 'category',
          name: 'Texto',
          colour: '#1c1f7a',
          contents: [
            { kind: 'block', type: 'amado_serial_log' },
            { kind: 'block', type: 'amado_text_literal' },
            { kind: 'block', type: 'amado_text_join' },
          ],
        },
        {
          kind: 'category',
          name: 'Listas',
          colour: '#1c1f7a',
          contents: [
            { kind: 'block', type: 'lists_create_empty' },
            { kind: 'block', type: 'lists_create_with' },
            {
              kind: 'block',
              type: 'lists_repeat',
              inputs: {
                NUM: { shadow: { type: 'math_number', fields: { NUM: 5 } } },
              },
            },
          ],
        },
      ],
    },
    {
      kind: 'category',
      name: 'Funções',
      colour: '#995ba5',
      contents: [
        {
          kind: 'category',
          name: 'Funções criadas',
          colour: '#995ba5',
          custom: 'PROCEDURE',
        },
        {
          kind: 'category',
          name: 'BIPES',
          colour: '#995ba5',
          contents: [{ kind: 'block', type: 'amado_project_info' }],
        },
      ],
    },
    {
      kind: 'category',
      name: 'Pinos entrada/saída',
      colour: '#708090',
      contents: [
        { kind: 'block', type: 'amado_pin_selector' },
        { kind: 'block', type: 'amado_set_pin' },
        { kind: 'block', type: 'amado_read_digital' },
        { kind: 'block', type: 'amado_read_analog' },
        /* Blocos PWM desativados temporariamente
        {
          kind: 'block',
          type: 'amado_pwm_setup',
          inputs: {
            PIN: { shadow: { type: 'amado_pin_selector' } },
            FREQ: { shadow: { type: 'math_number', fields: { NUM: 1000 } } },
            DUTY: { shadow: { type: 'math_number', fields: { NUM: 50 } } },
          },
        },
        {
          kind: 'block',
          type: 'amado_pwm_set_frequency',
          inputs: {
            FREQ: { shadow: { type: 'math_number', fields: { NUM: 1000 } } },
          },
        },
        {
          kind: 'block',
          type: 'amado_pwm_set_duty',
          inputs: {
            DUTY: { shadow: { type: 'math_number', fields: { NUM: 50 } } },
          },
        },
        {
          kind: 'block',
          type: 'amado_pwm_start',
          inputs: {
            PIN: { shadow: { type: 'amado_pin_selector' } },
          },
        },
        { kind: 'block', type: 'amado_pwm_stop' },
        */
      ],
    },
    {
      kind: 'category',
      name: 'Sensores',
      colour: '#708090',
      contents: [
        {
          kind: 'category',
          name: 'Temperatura e umidade',
          colour: '#708090',
          contents: [
            {
              kind: 'block',
              type: 'dht_init',
              inputs: {
                PIN: {
                  shadow: { type: 'amado_pin_selector', fields: { PIN: 'D2' } },
                },
              },
            },
            { kind: 'block', type: 'dht_update' },
            { kind: 'block', type: 'dht_temperature' },
            { kind: 'block', type: 'dht_humidity' },
          ],
        },
        {
          kind: 'category',
          name: 'Ultrassônico',
          colour: '#708090',
          contents: [
            { kind: 'block', type: 'amado_ultrasonic_init' },
            { kind: 'block', type: 'amado_ultrasonic_read' },
          ],
        },
        {
          kind: 'category',
          name: 'Acelerômetro e giroscópio',
          colour: '#708090',
          contents: [],
        },
        {
          kind: 'category',
          name: 'Leitor RFID',
          colour: '#708090',
          contents: [],
        },
      ],
    },
    {
      kind: 'category',
      name: 'Telas',
      colour: '#708090',
      contents: [
        {
          kind: 'category',
          name: 'Display OLED',
          colour: '#708090',
          contents: [
            { kind: 'block', type: 'oled_display_init' },
            { kind: 'block', type: 'oled_display_write_text' },
            { kind: 'block', type: 'oled_display_write_value' },
            { kind: 'block', type: 'oled_display_show' },
            { kind: 'block', type: 'oled_display_clear' },
          ],
        },
      ],
    },
    {
      kind: 'category',
      name: 'Saídas e atuadores',
      colour: '#708090',
      contents: [
        {
          kind: 'category',
          name: 'Servo motor',
          colour: '#708090',
          contents: [
            { kind: 'block', type: 'servo_init' },
            { kind: 'block', type: 'servo_move' },
          ],
        },
        {
          kind: 'category',
          name: 'Motor DC',
          colour: '#708090',
          contents: [
            { kind: 'block', type: 'motor_dc_init' },
            { kind: 'block', type: 'motor_dc_set_direction' },
            { kind: 'block', type: 'motor_dc_set_power' },
            { kind: 'block', type: 'motor_dc_stop' },
          ],
        },
      ],
    },
  ],
};

let workspace = null;
let resizeObserver = null;
let fallbackCleanup = null;
let windowResizeHandler = null;

function getBlockly() {
  if (typeof window === 'undefined') return null;
  return window.Blockly ?? null;
}

function getTheme(Blockly) {
  if (!Blockly) return null;
  if (Blockly.Themes?.BipesDark) {
    return Blockly.Themes.BipesDark;
  }

  const baseTheme = Blockly.Themes?.Classic ?? Blockly.Themes?.Default ?? null;

  return Blockly.Theme.defineTheme('BipesDark', {
    base: baseTheme ?? undefined,
    blockStyles: {
      logic_blocks: {
        colourPrimary: '#008000',
        colourSecondary: '#006600',
        colourTertiary: '#004d00',
      },
      loop_blocks: {
        colourPrimary: '#d9a600',
        colourSecondary: '#bf9100',
        colourTertiary: '#a67e00',
      },
      math_blocks: {
        colourPrimary: '#008000',
        colourSecondary: '#006600',
        colourTertiary: '#004d00',
      },
      list_blocks: {
        colourPrimary: '#1c1f7a',
        colourSecondary: '#16185f',
        colourTertiary: '#101243',
      },
      variable_blocks: {
        colourPrimary: '#1c1f7a',
        colourSecondary: '#16185f',
        colourTertiary: '#101243',
      },
      procedure_blocks: {
        colourPrimary: '#995ba5',
        colourSecondary: '#7f4a88',
        colourTertiary: '#653a6b',
      },
    },
    categoryStyles: {
      logic_category: { colour: '#4C97FF' },
      loop_category: { colour: '#9966FF' },
      math_category: { colour: '#FFAB19' },
      variable_category: { colour: '#1c1f7a' },
      procedure_category: { colour: '#995ba5' },
    },
    componentStyles: {
      workspaceBackgroundColour: '#1E1E1E',
      toolboxBackgroundColour: '#1f1f22',
      toolboxForegroundColour: '#FFFFFF',
      flyoutBackgroundColour: '#252526',
      flyoutForegroundColour: '#FFFFFF',
      flyoutOpacity: 0.9,
      scrollbarColour: '#5B5B66',
      scrollbarOpacity: 0.6,
      cursorColour: '#FFFFFF',
      insertionMarkerColour: '#FFFFFF',
      insertionMarkerOpacity: 0.3,
    },
    fontStyle: {
      family: '"Segoe UI", "Roboto", sans-serif',
      weight: '400',
    },
  });
}

function setupAutoResize(container, BlocklyInstance) {
  const handleResize = () => {
    if (!workspace) return;
    BlocklyInstance.svgResize(workspace);
  };

  windowResizeHandler = handleResize;
  window.addEventListener('resize', windowResizeHandler);

  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);
  } else {
    // Fallback para navegadores sem ResizeObserver
    let scheduled = null;
    const scheduleResize = () => {
      if (scheduled) return;
      scheduled = window.requestAnimationFrame(() => {
        scheduled = null;
        handleResize();
      });
    };
    container.addEventListener('transitionend', scheduleResize);
    container.addEventListener('animationend', scheduleResize);
    fallbackCleanup = () => {
      container.removeEventListener('transitionend', scheduleResize);
      container.removeEventListener('animationend', scheduleResize);
    };
  }
}

export function initBlocklyWorkspace({
  containerId = 'blockly-container',
  toolbox = DEFAULT_TOOLBOX,
  additionalOptions = {},
} = {}) {
  const container = document.getElementById(containerId);
  if (!container) {
    console.warn('[Blockly] Container não encontrado:', containerId);
    return null;
  }

  const BlocklyInstance = getBlockly();
  if (!BlocklyInstance) {
    console.warn('[Blockly] Biblioteca não carregada.');
    return null;
  }

  applyPortugueseMathMessages(BlocklyInstance);
  registerAmadoBlocks(BlocklyInstance);

  const theme = getTheme(BlocklyInstance);

  workspace = BlocklyInstance.inject(container, {
    toolbox,
    trashcan: true,
    collapse: true,
    scrollbars: true,
    renderer: 'thrasos',
    grid: {
      spacing: 20,
      length: 3,
      colour: '#3e3e42',
      snap: true,
    },
    move: {
      scrollbars: true,
      drag: true,
      wheel: true,
    },
    theme,
    ...additionalOptions,
  });

  setupAutoResize(container, BlocklyInstance);

  window.setTimeout(() => {
    BlocklyInstance.svgResize(workspace);
  }, 0);

  return workspace;
}

export function getBlocklyWorkspace() {
  return workspace;
}

export function disposeBlocklyWorkspace() {
  if (!workspace) return;
  workspace.dispose();
  workspace = null;

  if (resizeObserver) {
    resizeObserver.disconnect();
    resizeObserver = null;
  }

  if (fallbackCleanup) {
    fallbackCleanup();
    fallbackCleanup = null;
  }

  if (windowResizeHandler) {
    window.removeEventListener('resize', windowResizeHandler);
    windowResizeHandler = null;
  }
}

export function compileWorkspaceToProgram(targetWorkspace = workspace, { allowEmpty = false } = {}) {
  const BlocklyInstance = getBlockly();
  if (!BlocklyInstance) {
    return { error: 'Blockly não está disponível.' };
  }
  if (!targetWorkspace) {
    return { error: 'Nenhum workspace Blockly carregado.' };
  }

  const topBlocks = targetWorkspace.getTopBlocks(false);
  if (!topBlocks.length) {
    if (allowEmpty) {
      return { program: null, code: '', isEmpty: true };
    }
    return { error: 'Adicione blocos ao editor Blockly para executar um programa.' };
  }

  const generator = BlocklyInstance.JavaScript ?? BlocklyInstance?.javascriptGenerator;
  if (!generator) {
    return { error: 'Gerador JavaScript do Blockly não encontrado.' };
  }

  let code = '';
  try {
    code = generator.workspaceToCode(targetWorkspace);
  } catch (error) {
    return {
      error: `Erro ao gerar código a partir dos blocos: ${error.message ?? error}`,
    };
  }

  if (!code || !code.trim()) {
    if (allowEmpty) {
      return { program: null, code: '', isEmpty: true };
    }
    return {
      error: 'Adicione blocos ao editor Blockly para executar um programa.',
    };
  }

  const wrappedCode = `"use strict";\nreturn async (api) => {\n${code}\n};`;

  try {
    const factory = new Function(wrappedCode);
    const program = factory();
    if (typeof program !== 'function') {
      return { error: 'Falha ao compilar o programa Blockly.' };
    }
    return { program, code };
  } catch (error) {
    return {
      error: `Erro ao compilar os blocos para o simulador: ${error.message ?? error}`,
    };
  }
}
