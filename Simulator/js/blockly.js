import { registerAmadoBlocks } from './blockly-blocks.js';

const DEFAULT_TOOLBOX = {
  kind: 'categoryToolbox',
  contents: [
    {
      kind: 'category',
      name: 'Lógica',
      colour: '#4C97FF',
      contents: [
        { kind: 'block', type: 'controls_if' },
        { kind: 'block', type: 'logic_compare' },
        { kind: 'block', type: 'logic_operation' },
        { kind: 'block', type: 'logic_boolean' },
        { kind: 'block', type: 'logic_negate' },
      ],
    },
    {
      kind: 'category',
      name: 'Laços',
      colour: '#9966FF',
      contents: [
        { kind: 'block', type: 'controls_repeat_ext' },
        { kind: 'block', type: 'controls_whileUntil' },
        { kind: 'block', type: 'controls_for' },
      ],
    },
    {
      kind: 'category',
      name: 'Temporização',
      colour: '#4CAF50',
      contents: [
        { kind: 'block', type: 'amado_wait' },
      ],
    },
    {
      kind: 'category',
      name: 'Leituras',
      colour: '#00BFA6',
      contents: [
        { kind: 'block', type: 'amado_read_digital' },
        { kind: 'block', type: 'amado_read_analog' },
      ],
    },
    {
      kind: 'category',
      name: 'Amado ESP32',
      colour: '#2BC3A3',
      contents: [
        { kind: 'block', type: 'amado_set_pin' },
        { kind: 'block', type: 'amado_serial_log' },
      ],
    },
    {
      kind: 'category',
      name: 'Saídas e atuadores',
      colour: '#F97316',
      contents: [
        {
          kind: 'category',
          name: 'Motor DC',
          colour: '#FB923C',
          contents: [
            { kind: 'block', type: 'motor_dc_init' },
            { kind: 'block', type: 'motor_dc_set_direction' },
            { kind: 'block', type: 'motor_dc_set_power' },
            { kind: 'block', type: 'motor_dc_stop' },
          ],
        },
      ],
    },
    {
      kind: 'category',
      name: 'Matemática',
      colour: '#FFAB19',
      contents: [
        { kind: 'block', type: 'math_number' },
        { kind: 'block', type: 'math_arithmetic' },
        { kind: 'block', type: 'math_single' },
        { kind: 'block', type: 'math_number_property' },
        { kind: 'block', type: 'math_random_int' },
      ],
    },
    {
      kind: 'category',
      name: 'Variáveis',
      colour: '#FF8C1A',
      custom: 'VARIABLE',
    },
    {
      kind: 'category',
      name: 'Funções',
      colour: '#FF6680',
      custom: 'PROCEDURE',
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
        colourPrimary: '#4C97FF',
        colourSecondary: '#4280D7',
        colourTertiary: '#3373CC',
      },
      loop_blocks: {
        colourPrimary: '#9966FF',
        colourSecondary: '#855CD6',
        colourTertiary: '#774DCB',
      },
      math_blocks: {
        colourPrimary: '#FFAB19',
        colourSecondary: '#E29C17',
        colourTertiary: '#B8860B',
      },
      variable_blocks: {
        colourPrimary: '#FF8C1A',
        colourSecondary: '#DB770F',
        colourTertiary: '#A8540A',
      },
      procedure_blocks: {
        colourPrimary: '#FF6680',
        colourSecondary: '#E6506B',
        colourTertiary: '#B33C52',
      },
    },
    categoryStyles: {
      logic_category: { colour: '#4C97FF' },
      loop_category: { colour: '#9966FF' },
      math_category: { colour: '#FFAB19' },
      variable_category: { colour: '#FF8C1A' },
      procedure_category: { colour: '#FF6680' },
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
