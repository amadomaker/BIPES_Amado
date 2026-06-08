# Correção do botão Play (Run/Stop)

**Status:** feito e testado (WebSerial/USB e WebSocket/EasyMQTT)
**Data:** 2026-06-08
**Branch:** `273-fix-botao-play`
**Commit:** `1c3f33e`
**Arquivos:** `ui/core/ui.js`, `ui/core/channel.js`

## O problema (sintomas)

O botão Play travava com frequência — muitas vezes só recarregando a página (F5) ele voltava.
Outros sintomas:

- Rodando um programa em loop, o botão **não pausava**.
- Apertar **reset "ativava"** o botão sozinho.
- Qualquer dado vindo da placa colocava o botão em "rodando" mesmo sem nada rodar.
- Às vezes era preciso **clicar várias vezes** pra ele "destravar".
- Funcionava pra uma pessoa e falhava pra outra (intermitente).

Já tinha sido "consertado" várias vezes antes (PRs #240, #242, #243, #264, #265, #267),
sempre na mesma região — sinal de que o problema era de **arquitetura**, não um bug pontual.

## Como era antes (a causa raiz)

O estado do botão era **adivinhado lendo a saída serial da placa**. Existia uma única
variável (`runButton.status`) e o código ficava procurando o texto `">>> "` (o prompt do
MicroPython) no que a placa imprimia pra decidir se o botão era "▶ rodar" ou "⏹ parar".

Essa lógica estava **copiada e idêntica nos 3 canais** (WebSerial, WebSocket, Bluetooth),
com dois defeitos centrais:

1. **Qualquer dado recebido** com o botão ocioso já o jogava pra "rodando" (mensagem de boot,
   debug, echo). Aí o clique não fazia o esperado.
2. **Se o programa entrava em loop**, a placa nunca mais imprimia `">>> "` — então o botão
   ficava **preso pra sempre** em "rodando". Esse era o travamento que exigia F5.

Como dependia de *timing* da serial, era não-determinístico: funcionava num momento,
travava no outro, e variava de máquina pra máquina.

## Como ficou (a correção)

O estado do botão passou a ser uma **máquina de estados explícita**, dirigida pela
**intenção do usuário**, não pelo texto da serial. Quatro estados:
`disconnected` → `idle` → `running` → `stopping`.

Peças novas em `ui/core/ui.js`:

- **`setRunState(estado)`** — fonte única da verdade do botão. Tudo que muda o botão passa
  por aqui.
- **`onReplPrompt()`** — o `">>> "` virou só uma **confirmação** de que a placa voltou ao
  prompt. Ele leva "rodando → pronto" e **nunca mexe num botão que já está pronto** (foi isso
  que acabou com o reset/boot bagunçando o botão).
- **`run()` (o clique)** — ao **parar**, devolve a UI pra "pronto" **na hora** (otimista).
  Assim o botão **nunca fica preso**, mesmo com a placa num loop infinito. Foi isso que
  eliminou o travamento que exigia recarregar a página.

Em `ui/core/channel.js`: removida a lógica frágil ("vilão") nos 3 canais; a detecção do
prompt agora chama o `onReplPrompt()`; conectar marca "pronto" em vez de "rodando".

## Antes × Depois (resumo)

| Situação | Antes | Depois |
|---|---|---|
| Programa em loop infinito | Botão preso → **F5** | Para na hora, botão volta a "pronto" |
| Apertar reset | Botão "ativava" sozinho | Reset não mexe mais no botão |
| Dado chegando da placa | Jogava pra "rodando" | Não muda o botão |
| Consistência | Dependia de timing (intermitente) | Determinístico — sempre igual |

## Por que ficou confiável

Antes o botão **adivinhava** o estado a partir de algo incerto (quando/se o `">>> "` chegava).
Agora ele **decide** com base no que você fez (clicou rodar / clicou parar). Não sobrou nada
"indeterminado" pra dar errado — por isso passou a funcionar sempre igual.
