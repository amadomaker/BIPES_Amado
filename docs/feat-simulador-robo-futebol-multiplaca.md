# Modo Futebol multi-placa (simulador de robô)

Status: **EM ANDAMENTO — bug não resolvido** (robô não anda no mundo Futebol).
Branch: `275-feat-simulator-with-robot-movel`.

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

## PRÓXIMAS HIPÓTESES a investigar (ao voltar)

1. **Medir a roda do robô TRAVADO (A) especificamente** — o DIAG mediu o robot
   global (`robot`, que é o A). Reconfirmar: a roda de A GIRA mas o corpo não anda
   (= preso/derrapando) ou a roda NEM gira (= joint/motor quebrado)? Isso separa
   "physics joint mal-formada" de "corpo preso por algo".
2. **Por que `player='single'` (1 robô) parece andar e numérico não**, sendo
   posição/rotação iguais. Ler com lupa o caminho `self.player=='single'` no
   `Robot.load` (linhas ~107-123) e tudo que dependa de `self.player`.
3. **Testar 1 robô numérico (player=0) no mundo GRID** (sem bola/paredes):
   - se andar → é a interação com os objetos de física do football.
   - se travar → é o `player` numérico em si (modo arena).
4. **Recriar a física do robô depois** que todos os corpos carregam
   (dispose + recreate do `physicsImpostor`/joints), caso a ordem de adição de
   joints ao mundo Ammo invalide as do primeiro robô.
5. **Procurar estado compartilhado entre instâncias** em `Wheel.js`/`Robot.js`
   (variáveis de módulo, `registerBeforePhysicsStep` das rodas, buffers do Ammo
   reaproveitados) que façam um robô interferir no outro.

## Pendências de UX (depois que o robô andar)

- Modo Jogo: posicionar os 2 robôs em lados OPOSTOS, cada um apontando para o gol
  adversário (no design arena: player 0 esquerda +90°, player 2 direita -90°).
  Hoje, nas tentativas, ficaram apontando errado / empilhados.
- Garantir que A e B sejam robôs DISTINTOS controlados por IPs distintos (campos
  `fb-ip-a` e `fb-ip-b`).
- Afinar `FB_MAX_SPEED` (velocidade) e tamanho do campo (480×288 é grande;
  pode dar sensação de lentidão mesmo andando certo).

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
