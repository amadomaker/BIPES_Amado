# GCE MQTT Stack (Mosquitto + Subscriber)

Este diretório contém o Compose para subir o broker MQTT (Mosquitto) e o serviço `subscriber` em uma VM do Google Compute Engine.

## Portas

- 1883/TCP: MQTT (plain TCP) — exposta publicamente (considere restringir IPs no firewall).

## Pré-requisitos na VM

- Debian/Ubuntu com Docker e Docker Compose (compose V2).
- IP externo estático associado à VM.

## Passos de instalação

1. Clone o repositório nesta VM (ou copie apenas esta pasta `infra/gce-mqtt`).
2. Dentro da pasta `infra/gce-mqtt`, copie o exemplo de variáveis e edite:
   - `cp .env.example .env`
   - Ajuste `MQTT_USER`, `MQTT_PASS` e `MONGO_URI`.
3. Gere o arquivo de senhas do Mosquitto (o usuário deve coincidir com `MQTT_USER` do `.env`):
   - `docker run --rm -v $(pwd):/work -w /work eclipse-mosquitto:2.0.21 sh -lc "mosquitto_passwd -c passwd $MQTT_USER"`
   - Será solicitado o password (use o mesmo de `MQTT_PASS`).
4. Suba a stack:
   - `docker compose up -d`
5. Verifique logs/saúde:
   - `docker compose ps`
   - `docker logs mqtt -f`
   - `docker logs subscriber -f`

## Boas práticas de segurança

- Mantenha `allow_anonymous false` (já está no `mosquitto.conf`).
- Senhas fortes no `passwd`.
- Se possível, restrinja o firewall da VM (regras GCP) para permitir 1883 somente de redes conhecidas.
- (Opcional) Habilite TLS e use a porta 8883 (requer gerar certificado e ajustar o `mosquitto.conf`).

## Troubleshooting rápido

- Teste local na VM:
  - `mosquitto_pub -h 127.0.0.1 -p 1883 -u "$MQTT_USER" -P "$MQTT_PASS" -t test -m ok`
  - `mosquitto_sub -h 127.0.0.1 -p 1883 -u "$MQTT_USER" -P "$MQTT_PASS" -t '#'`
- Do lado de fora, aponte `-h <IP_PUBLICO_DA_VM>`.
