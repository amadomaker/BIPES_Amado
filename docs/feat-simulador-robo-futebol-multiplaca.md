# Modo Futebol multi-placa (simulador de robô)

Status: **BUG PRINCIPAL RESOLVIDO** (robô do futebol não engasga mais).
Branch: `275-feat-simulator-with-robot-movel`.

## ✅ CAUSA RAIZ E SOLUÇÃO (resolvido)

**Sintoma real:** o robô NÃO travava parado — ele **andava engasgando** (acelerava e
quase parava, repetidamente). Só o `robotB` (lado B) andava liso; o robô A (lado A)
sempre engasgava, independente de placa/IP/ordem/posição.

**Causa:** o robô A é a variável global `robot`, que era comandada por DOIS controles
ao mesmo tempo:
1. o controle do futebol via HTTP (`applyFbState`, a cada 30ms), e
2. o controle antigo por blocos do BIPES (`bipes-motor-state` → `applyMotorState`),
   que o BIPES-pai voltava a enviar assim que o robô era iniciado (`robot-started`).

Os dois escreviam no mesmo `robot.leftWheel.speed_sp` e brigavam → engasgo. O `robotB`
nunca engasgava porque o `applyMotorState` só mexe na global `robot` (A), não no B.
Por isso, no grid/labirinto também é liso (lá só existe o controle por blocos).

**Solução (1 linha, isolada no futebol):** em `bipes-bridge.js` `onMessage`, quando
`fbMode !== 'off'` faz `return` antes de aplicar o `motor-state`. No futebol o robô é
controlado 100% pela placa via HTTP; nos outros mundos (`fbMode === 'off'`) o controle
por blocos segue intacto.

**Lição:** quando UM robô idêntico se comporta diferente do outro, suspeitar de
controle/estado duplicado, não de física. Perdi muito tempo caçando física (atrito,
massa, anti-drift, ordem de criação) porque o doc dizia "trava" quando era "engasga".

## Objetivo

Adicionar um modo "Futebol" ao simulador de robô (`Simulator/robot/`), reusando o
mundo `world_Football.js` do Gears. A ideia:

- A pessoa programa um ESP32 em blocos (BIPES) com a lógica que quiser
  (botão, joystick, sensor — ex.: LDR). A placa expõe um endpoint HTTP.
- O simulador faz polling do IP da placa e move o robô virtual conforme os
  valores de motor que a placa devolve. É o inverso da aba Visão (lá o browser
  controla a placa; aqui a placa controla o robô virtual).
- **Modo Treino**: 1 robô, 1 placa — para testar/brincar livre.
- **Modo Jogo**: 2 robôs (A e B), 2 placas — cada placa controla um robô,
  jogo de futebol.

## O que JÁ funciona

- Seleção do mundo "Futebol" no dropdown (`index.html`), com painel próprio
  (modo Treino/Jogo + campos de IP + botão Testar + bolinha de status).
- Comunicação ESP32 ↔ simulador 100% OK:
  - `testEsp32(ip)` testa conectividade (bolinha amarela→tentando, verde→ok, vermelho→falhou).
  - `fetchEsp32Motors(ip)` lê `GET http://IP/robot` que devolve `{"l":<-1023..1023>,"r":<...>}`.
  - Polling a 200ms (só envia novo request quando o anterior volta, p/ não saturar
    o ESP32 single-thread), e aplicação nas rodas a 30ms usando o último valor
    guardado (`fbStateA`/`fbStateB`). Isso deixou o movimento contínuo (sem ser
    o "anda-1-tiquinho-e-para").
  - Mapeamento linear `fbValToSpeed`: -1023..1023 → -FB_MAX_SPEED..FB_MAX_SPEED
    (atualmente `FB_MAX_SPEED=550`, sem zona morta — a velocidade ficou boa).
- Código MicroPython de teste do usuário (LDR controlando frente/parado) em
  `C:\Users\João Jr\Downloads\robo_futebol_ldr.py` (cópia em
  `/home/joaodrj/Downloads/robo_futebol_ldr.py`). Endpoint `/robot`, com header
  `Access-Control-Allow-Origin: *` (obrigatório, senão o browser bloqueia).
- Placar do futebol renderiza (stub `arenaPanel` no index.html alimenta o
  `world_Football.js`). Textura placeholder da bola em
  `Simulator/robot/textures/sphere/soccerBall.png` (era 404).

## O BUG (não resolvido)

**No mundo Futebol o robô não anda — fica "travado", como se algo o segurasse.**
No grid/labirinto o MESMO robô anda perfeitamente.

### Fato central, isolado por testes (com DIAG no F12)

- **Só `robots[1]` (o SEGUNDO robô criado) anda. `robots[0]` (o primeiro) SEMPRE trava.**
- No Treino só existe `robots[0]` → trava.
- No Jogo: robô A (`robots[0]`) trava, robô B (`robots[1]`) anda lindo.
- Teste decisivo: coloquei os 2 robôs na MESMA posição (x=+100) e MESMA rotação.
  Mesmo assim A travou e B andou → **NÃO é posição, NÃO é rotação, NÃO é o lado do campo.**

### Medições (DIAG temporário, já removido)

Comparação grid (funciona) × football (trava), mesma métrica:
- **grid**: roda gira ~1500°/s → corpo anda ~72 u/s (relação ~0.048). OK.
- **football robô que anda (B)**: roda ~1800°/s → corpo até ~83 u/s. OK (mesma relação).
- **football robô que trava (A)**: corpo ~3-5 u/s, com a roda comandada a 782°/s.
  A roda chega a girar (medido ~700°/s) mas o corpo quase não sai do lugar.
- FPS do football: 79–105 (mais baixo que grid 132–144, por causa da bola+paredes),
  mas suficiente; performance NÃO é a causa.

### Pista importante / contradição a investigar

Num teste anterior, **1 robô com `player='single'` ANDOU** (DIAG chegou a corpo=83,
o usuário disse "quase certo"). Mas `robotStart` (single) e `arenaStart[0]` (player 0)
têm posição/rotação IDÊNTICAS no football — e player 0 trava. A única diferença no
`Robot.load` entre single e numérico é o material (cor) e qual start usa. Vale
confirmar se single REALMENTE anda de forma estável ou se também trava (pode ter
sido leitura otimista do DIAG).

## O que foi TENTADO e DESCARTADO (não resolveu)

1. **Atrito do chão** `groundFriction` 1→20 (20×): nada mudou → não é tração/derrapagem por atrito.
2. **Massa do robô** 1000→150 (clone leve do template): nada mudou → não é torque/inércia.
3. **Substeps da física** (`setFixedTimeStep 1/240`, `setMaxSteps 10`) no `babylon.js`: nada mudou. **Revertido.**
4. **Restituição do chão** `groundRestitution` 0.2→0 e parede 1.0→0.3: tirou um micro-quique mas não resolveu o travamento. (Mantido em 0 / 0.1, é uma melhoria neutra.)
5. **Rotação** +90 (esquerda) vs -90 (direita): troquei +90 por -270 (mesma orientação): não resolveu. **Revertido p/ original.**
6. **Anti-drift** (`Robot.js`, `registerBeforePhysicsStep` que congela o corpo se vel<0.316):
   - tentei reobter o `origin` do Ammo dentro do callback (era referência a buffer temporário compartilhado): não resolveu.
   - desabilitei o anti-drift no modo arena (só ativo p/ `player=='single'`): **não resolveu** → não é o anti-drift.
7. **Carga sequencial** dos robôs no `babylon.js` (mundo→robôA→robôB em cadeia
   `.then` em vez de `Promise.all` paralelo, p/ evitar a física de um robô se
   formar no meio da criação da bola/paredes): **não resolveu.**
8. **Parede central invisível** do football (separava times no modo 2v2 original):
   removida (não usamos), p/ o robô poder cruzar o campo e empurrar a bola.

## ✅ CONCLUÍDO (sessão 2026-06-11)

- **Bug da toolbar somindo: RESOLVIDO.** O `#football-panel` estava no fluxo flex e
  empurrava a toolbar ao aparecer/expandir. Virou overlay `position: absolute`
  (`top: 48px`), fora do fluxo. (`robot-sim.css`)
- **Placar: FUNCIONANDO.** Aparece só no modo Jogo (oculto no Treino). Bug do stub
  `arenaPanel.drawWorldInfo` (só inseria o 1º div) corrigido com `$el.each`. Textos
  em PT: Tempo / Time A / Time B / Reinício em. (`index.html`)
- **Gol / reset de posição: FUNCIONANDO.** Implementado 100% no `bipes-bridge.js`
  (`checkFootballGoal`): detecta bola na `scoreZone`, incrementa placar e chama
  `babylon.resetScene()` (mesmo caminho do botão Resetar) preservando o placar →
  recoloca bola E robôs nas posições iniciais de forma confiável.
  - **IMPORTANTE / armadilha:** NÃO ativar o game loop do Gears (`game.state` fica
    `'standby'`). Ativá-lo (via `world.startSim()`) liga o `foosRandom`/`firstFoos`
    que dá CHUTE AUTOMÁTICO na bola e o shotclock — a bola sai andando sozinha.
    Já tentamos e quebrou; reverter na hora se reaparecer.
  - **Por que não teleportar o robô na mão:** o robô é corpo composto (caixa + 2
    rodas com joints + rodízio) + anti-drift (`registerBeforePhysicsStep` em
    `Robot.js` segura a posição via `lastOrigin`, closure inacessível de fora).
    Teleportar só o `body` faz as rodas/joints/anti-drift brigarem → robô TOMBA e
    fica com "força puxando como sem gravidade". Por isso usamos reset de cena.
  - Detalhe: como o game loop fica dormindo, o "Tempo" do placar fica estático em
    2:00 e o "Reinício em" no máximo. Cosmético; resolver depois se incomodar.

## PRÓXIMOS PASSOS (fazer amanhã)

1. **Placa de patrocínio (item 3 do usuário).** Adicionar objeto(s) 3D tipo placa de
   beira de campo ao lado das laterais, com imagem/logo como textura. É um `box` com
   `imageURL`, igual às paredes do `world_Football.js` (ver `addWall`). O usuário quer
   poder colocar logos/patrocínios personalizados.
2. **Gol com rede (por último).** Hoje o gol é só paredes invisíveis + zona de
   detecção. Adicionar geometria 3D de rede (3 planos com textura de rede nos lados
   do gol). Mais trabalhoso — o usuário disse que pode procurar modelos 3D se não der
   pra construir.
3. **Limpeza de código (opcional).** Reverter tentativas antigas que não eram a causa
   do bug do engasgo (carga sequencial no `babylon.js`, etc.). A correção que IMPORTA
   é o `return` no `onMessage` quando `fbMode !== 'off'`.

## Pendências menores

- Esconder o robô-isca foi removido (não é mais usado; o bug não era ordem).
- Afinar tamanho do campo (480×288 é grande) se quiser ação mais rápida — opcional,
  o usuário disse que a velocidade está boa.

## Arquivos tocados nesta feature

- `Simulator/robot/index.html` — dropdown "Futebol", painel de modo/IP, stub
  `arenaPanel`, `setupFootballRobots()`.
- `Simulator/robot/robot-sim.css` — estilos do painel de futebol e do placar.
- `Simulator/robot/js/bipes-bridge.js` — `setFootballMode`, `testEsp32`,
  `fetchEsp32Motors`, `applyFbState`, `startFbPoll`, `fbValToSpeed`.
- `Simulator/robot/js/worlds/world_Football.js` — carregado no index; parede
  central removida; `groundFriction`/restituição ajustados.
- `Simulator/robot/js/babylon.js` — carga sequencial dos robôs (tentativa).
- `Simulator/robot/js/Robot.js` — anti-drift só no modo single (tentativa).
- `Simulator/robot/textures/sphere/soccerBall.png` — placeholder da bola.

## Regras de ouro herdadas (NÃO violar)

Ver `docs/feat-simulador-robo-fisico.md`. Resumo crítico:
- Robô é TOTALMENTE desacoplado do Play do BIPES. NUNCA mexer em `handlePlayPause()`.
- NUNCA `setAttribute`/`element.state=` em web components Wokwi durante a simulação.
- O usuário é engenheiro e já fez seguidores físicos — não explicar teoria básica.
- NÃO tweakar parâmetro às cegas; medir antes (usar DIAG no F12).
