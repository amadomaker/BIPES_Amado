# Simulador de Robô Físico — Integração Gears no BIPES

**Branch:** `275-feat-simulator-with-robot-movel`
**Status:** Funcional (fase inicial — testes e calibração em andamento)

---

## O que foi feito

### Ideia central
Integrar o simulador físico 3D do projeto [Gears](https://gears.aposteriori.com.sg/) (open source, GPLv3 — compatível com o BIPES) dentro da aba Simulador do BIPES, como um modo opcional. O mesmo circuito montado com blocos que já simula eletrônica agora também move um carrinho 3D.

### Arquitetura

```
Blocos BIPES → simulation.js calcula RPM → main.js lê motores
    → postMessage → bipes-bridge.js → robot.leftWheel.speed_sp → robô se move

Robô detecta parede (raycast 3D) → bipes-bridge.js → postMessage
    → main.js → component.element.__distanceCm → bloco lê sensor
```

### Arquivos criados

**`Simulator/robot/`** — pasta isolada, não interfere com nada existente:
- `index.html` — página do simulador de robô (canvas Babylon.js + controles)
- `robot-sim.css` — estilos do painel
- `js/bipes-bridge.js` — cérebro da integração: recebe RPM, controla rodas, lê sensor ultrassônico e envia de volta
- `js/Robot.js`, `js/Wheel.js`, `js/arena.js`, etc. — copiados do Gears
- `js/worlds/` — mundos: Grade, Labirinto, Seguidor de Linha, Arena, e outros
- `babylon/` — engine 3D Babylon.js 4.2.1
- `ammo/` — física Ammo.js (port do Bullet Physics)
- `textures/` — texturas do robô e mapas dos mundos
- `worlds/challenges/` — cenários JSON prontos do Gears

### Arquivos modificados (mudanças mínimas)

- **`Simulator/index.html`** — botão "🤖 Robô" + iframe oculto que carrega `robot/index.html`
- **`Simulator/css/style.css`** — CSS do botão e painel overlay
- **`Simulator/js/main.js`** — `setupRobotSimPanel()`: abre/fecha painel, polling de motor a cada 50ms, recebe distância do sensor a cada 100ms

---

## O que funciona

- **Botão "🤖 Robô"** abre/fecha o painel do simulador 3D sobreposto ao canvas existente
- **Motor A e B**: o 1º motor DC no canvas = roda esquerda, 2º motor = roda direita
- **Robô se move** conforme o RPM calculado pelo simulador de eletrônica
- **Sensor ultrassônico**: o robô faz raycast no mundo 3D e envia a distância de volta ao BIPES; o bloco de sensor reage em tempo real
- **3 mundos disponíveis** no seletor: Grade, Labirinto, Seguidor de Linha
- **Botões**: Iniciar/Parar simulação, Resetar posição, Alternar câmera (follow/arc)
- **Console** no rodapé do painel para logs

---

## O que ainda falta / próximos passos

### Calibração e correção
- [ ] Calibrar a escala de velocidade: `RPM → deg/s` pode precisar de ajuste fino dependendo do robô
- [ ] Calibrar a escala do sensor ultrassônico (Gears usa unidades que são ≈ cm, mas pode variar por mundo)
- [ ] Direção do motor (`leftDir`/`rightDir`): atualmente assume positivo se dir=0; testar se marcha ré funciona corretamente
- [ ] Detecção de canal A/B por fiação (hoje usa ordem dos componentes no canvas, não os pinos D25/D26/D27)

### Novas funcionalidades
- [ ] Sensor de cor (para seguidor de linha): robô lê cor do chão e envia ao BIPES
- [ ] Mais mundos no seletor (Arena, Sumo, etc.)
- [ ] Seletor de template de robô (hoje fixo: `singleFollower`)
- [ ] Mostrar leitura atual do sensor ultrassônico no painel
- [ ] Botão de screenshot/gravação do simulador

### UX / polimento
- [ ] Painel em modo split (lado a lado) em vez de overlay, para ver os dois ao mesmo tempo
- [ ] Persistência do mundo escolhido
- [ ] Indicador visual quando o postMessage não está chegando (simulação pausada)

---

## Como usar

1. Abra a aba **Simulador** do BIPES
2. Monte o circuito: placa + 2 motores DC (MOTOR_A e MOTOR_B) + sensor ultrassônico (opcional)
3. Monte os blocos de controle normalmente
4. Clique em **🤖 Robô** (canto superior direito do canvas)
5. Clique em **▶ Iniciar** no painel do robô
6. Dê **Play** na simulação de eletrônica
7. O carrinho se move; se tiver sensor, ele detecta paredes em tempo real

---

## Referências

- Gears GitHub: https://github.com/QuirkyCort/gears (GPLv3)
- Babylon.js 4.2.1 — engine 3D
- Ammo.js — física (port do Bullet Physics em JS)
- BIPES Simulator: `Simulator/js/simulation.js` — `component.state.motor.rpm/direction`
- Sensor ultrassônico BIPES: `component.element.__distanceCm`
