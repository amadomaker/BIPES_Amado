# Modo Futebol multi-placa (simulador de robô)

Status: **FUNCIONAL** — engasgo, placar, reset no gol, gol 3D, garra física, controle
manual de teste, timer de 5 min e seleção de time (cor + escudo da Série A) todos
prontos. Branch já pushada (em sync com `origin`); falta abrir o PR e polimento
(tela de fim de jogo, salvar IPs).
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

## O BUG (✅ RESOLVIDO — histórico)

> **NOTA:** esta seção está mantida só como histórico da investigação. O problema
> foi resolvido — não era "travamento" e sim **engasgo por controle duplicado** (ver
> "CAUSA RAIZ E SOLUÇÃO" no topo do doc). O diagnóstico abaixo descrevia o sintoma
> como "trava", o que atrasou a caça; na prática o robô andava engasgando porque dois
> controles (HTTP do futebol + motor-state por blocos do BIPES) brigavam pela mesma
> variável global `robot`.

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

## ✅ CONCLUÍDO (sessão 2026-06-15)

- **Placa de patrocínio: FEITO** (commit a7c3941) — boxes com `imageURL` nas laterais.
- **Gol 3D com recorte na parede: FEITO.** No `world_Football.js`: `wall:false` desliga
  o perímetro do mundo-base (que fechava o vão do gol); paredes laterais e de fundo
  recriadas à mão. `goalPostInset` (≈41) estreita o vão real (`goalOpening`) até as
  traves do modelo `models/gol.glb`. Posição do gol por `goalScale`/`goalOffsetZ`/
  `goalOutward`. Precisa do loader `babylon/4.2.1/babylonjs.loaders.min.js` no index.
  - **Cor:** o `gol.glb` (Tinkercad) vinha cinza porque a cor estava nos **vertex
    colors** (atributo COLOR_0), não no material. Fix no callback do objeto:
    `m.useVertexColors = false` + albedo branco. (Trocar o material por um novo
    QUEBRAVA o load — não fazer isso.)
  - **Detecção de gol** usa `goalOpening` (só conta dentro das traves).
- **Controle manual de teste: FEITO.** D-pad OCULTO no `Simulator/robot/index.html`,
  ativado pelo console: `manualControl(true/false/)` (exposto também em `window.top`
  porque roda em iframe). Estágios de velocidade V1..V4. Move a global `robot` por
  `leftWheel.speed_sp`. Roda `checkFootballGoal` enquanto aberto (gol conta sem ▶ Iniciar).
- **Garra física (berço em U): FEITO, só no futebol.** `footballRobotOptions()` no
  index clona o template e adiciona 2 peças `Box` (braços) na frente. Tentei
  `MagnetActuator` (ímã) primeiro — o usuário queria física, não ímã.
- **Bola mais manipulável:** massa 10→30, restituição 1.0→0.5, ballDamping 0.01→0.4.
- **Timer de partida 5 min (só Jogo): FEITO** sem ligar o game loop do Gears. Próprio no
  `bipes-bridge.js` (`FB_MATCH_DURATION`, `startFbTimer`/`updateFbTimer`/`stopFbTimer`),
  escreve em `.football-score-panel .time`; ao zerar chama `stopSim`. `game.TIME_LIMIT`
  também = 5 min (display estático antes do start). Começa no `startSim` OU ao ativar
  `manualControl` no Jogo.
- **Botão "Robô 3D":** era botão flutuante no canvas; movido pra toolbar do
  `Simulator/index.html` (à direita de "Laboratorio"), sem emoji, em `setupRobotSimPanel`
  (`Simulator/js/main.js`).
- **Fix clique amplia/esconde toolbar:** `babylon.js` `attachControl(canvas, false)`
  (era `true` = noPreventDefault) — o clique no canvas disparava scroll/focus do
  navegador dentro do iframe.
- **Seleção de time (cor + escudo): FEITO** (commits `f12ee8c`, `ea04c0f`). Dois
  `<select>` no painel (`#fb-team-a` / `#fb-team-b`, `Simulator/robot/index.html`).
  - Mapa `TEAMS` no index com `{ nome, cor (hex), escudo (PNG) }`. Série A inicial:
    Padrão (none), Palmeiras, Flamengo, Corinthians, São Paulo, Cruzeiro.
  - `populateTeamSelect()` popula os dropdowns; ao trocar, **recria os robôs** (cor e
    escudo são definidos na criação) e dá `resetScene` pra aplicar.
  - **Cor:** `robot.playerIndividualColors[0]` (A) / `[2]` (B) recebem
    `Color3.FromHexString(team.cor)`.
  - **Escudo:** `footballRobotOptions()` adiciona uma plaquinha fina (`Box`
    9×0.4×9) em cima do corpo (topo y=2) com `imageType:'top'` e `imageURL` do PNG.
  - **Transparência do PNG:** `robotComponents.js` `BoxBlock` agora seta
    `diffuseTexture.hasAlpha=true` + `useAlphaFromDiffuseTexture=true` (só afeta Box
    com `imageURL`). Escudos com fundo transparente aparecem recortados.
  - **Texturas:** `Simulator/robot/textures/teams/*.png` (e `.jpg` de backup). Ver
    `textures/teams/README.md` pra adicionar novos times. **Atenção:** alguns escudos
    foram adicionados em `.jpg` com fundo NÃO transparente — trocar por `.png`
    recortado pra ficar bom.

## PRÓXIMOS PASSOS

> Feature pausada (o usuário foi mexer em outra coisa; retoma no futuro). Lista de
> retomada por ordem de retorno/esforço:

1. **Tela de "Fim de jogo".** Hoje o timer zera e só loga no console; falta overlay com
   o vencedor/placar final (e botão de reiniciar partida). Fecha o ciclo da partida.
2. **Salvar IPs das placas** (localStorage) — hoje redigita Robô A/B toda vez. Rápido,
   tira atrito do uso diário.
3. **Mais times da Série A** — os escudos `.jpg` atuais têm fundo NÃO transparente;
   trocar por `.png` recortado e completar o restante da Série A no mapa `TEAMS`.
4. **Abrir o PR** da branch 275 (já está pushada e em sync com `origin` — só falta o PR).
5. **Polimento:** estado "ativo" no botão Robô 3D, feedback visual de gol ("GOL!"/apito).
6. **Limpeza (opcional, CUIDADO):** as antigas "tentativas" (carga sequencial no
   `babylon.js`, anti-drift no `Robot.js`) viraram correções reais com comentário
   explicando — reverter QUEBRA. Não mexer.

## Possíveis implementações futuras (ideias já conversadas)

Ideias levantadas ao longo das sessões, ainda NÃO implementadas — registradas aqui
pra não se perderem na retomada:

- **Tela de fim de jogo completa:** overlay com vencedor + placar final, botão
  "Reiniciar partida" e "Voltar ao menu" (hoje só `console.log` ao zerar o timer).
- **Persistir configuração da partida em localStorage:** IPs das placas, times
  escolhidos (A/B) e modo (Treino/Jogo) — recarregar tudo na próxima sessão.
- **Feedback de gol mais rico:** banner "GOL!" na tela + som de apito/torcida +
  pequena pausa/replay antes do reset da cena.
- **Botão "reiniciar partida"** sem ter que fechar/reabrir o painel (zera placar +
  timer + reset de cena).
- **Estado "ativo" no botão Robô 3D** na toolbar (destaque visual quando o painel
  está aberto).
- **Afinar tamanho do campo** (480×288 é grande) pra ação mais rápida — opcional, o
  usuário disse que a velocidade está boa.
- **Display de tempo "vivo":** hoje o "Tempo" do placar fica estático porque o game
  loop do Gears fica dormindo de propósito (ligar dispara chute automático). O timer
  real roda por fora; só falta espelhar a contagem no display do placar.
- **Mais ligas/seleções de time** além da Série A (Série B, seleções, times locais),
  reusando o mapa `TEAMS`.
- **Modo torneio / melhor de N partidas** entre as duas placas, somando vitórias.

## Pendências menores

- Esconder o robô-isca foi removido (não é mais usado; o bug não era ordem).

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
- `Simulator/robot/js/robotComponents.js` — `BoxBlock` honra alpha do PNG
  (`hasAlpha`/`useAlphaFromDiffuseTexture`) p/ o escudo do time recortado.
- `Simulator/robot/textures/sphere/soccerBall.png` — placeholder da bola.
- `Simulator/robot/textures/teams/*.png` (`.jpg` de backup) + `README.md` — escudos
  dos times da Série A.

## Regras de ouro herdadas (NÃO violar)

Ver `docs/feat-simulador-robo-fisico.md`. Resumo crítico:
- Robô é TOTALMENTE desacoplado do Play do BIPES. NUNCA mexer em `handlePlayPause()`.
- NUNCA `setAttribute`/`element.state=` em web components Wokwi durante a simulação.
- O usuário é engenheiro e já fez seguidores físicos — não explicar teoria básica.
- NÃO tweakar parâmetro às cegas; medir antes (usar DIAG no F12).
