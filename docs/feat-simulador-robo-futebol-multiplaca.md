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

## PRÓXIMOS PASSOS (fazer amanhã)

Já OK: robôs andam liso (treino e jogo), orientação dos robôs no jogo está certa,
velocidade está boa.

1. **Bug da tela / botões somem (PRIORIDADE).** Acontece SEMPRE: em algum momento a
   tela "cresce" e os botões de cima (▶ Play e os outros da toolbar) somem/escondem
   e não dá mais pra acessar. Investigar layout/CSS (provável: o canvas ou algum
   painel crescendo e empurrando a toolbar pra fora, ou overflow). Ver
   `robot-sim.css` (.robot-sim-toolbar, #renderCanvas flex) e os painéis do futebol.
2. **Gol / reset de posição.** Quando a bola sai (ou sai pela lateral / faz gol),
   os carrinhos devem voltar para a posição inicial. O `world_Football.js` já tem
   lógica de zonas de gol (`scoreZones`, `getBallZone`, `resetBall`/`foosRandom`)
   mas hoje só reposiciona a BOLA — precisa também reposicionar os ROBÔS.
3. **Placar.** Fazer o placar funcionar de verdade (contagem de gols time A/B). O
   `world_Football.js` já incrementa `self.game.teamA/teamB` e tem o painel via stub
   `arenaPanel` no index.html — validar/ajustar a exibição.
4. **Limpeza de código (opcional).** Reverter as tentativas que NÃO eram a causa do
   bug, se quiser deixar o diff mínimo: carga sequencial no `babylon.js`
   (voltar p/ `Promise.all`), anti-drift do `Robot.js`/`Wheel.js` (reobter origin —
   é uma correção válida de bug latente, pode até manter), restituição do
   `world_Football.js`. A correção que IMPORTA é o `return` no `onMessage` quando
   `fbMode !== 'off'`.

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
