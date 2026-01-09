# Cloud Function: MQTT Publisher (HTTP)

Função HTTP para publicar mensagens no broker MQTT a partir de uma chamada web.

## Deploy (gcloud)

Pré-requisitos: projeto GCP selecionado, `gcloud` autenticado.

- Ambiente: Python 3.12 (ou superior suportado pela região)
- Região sugerida: `us-central1`

Comandos:

1. Defina as variáveis de ambiente (substitua valores):

```bash
export PROJECT_ID="<seu-projeto>"
export REGION="us-central1"
export MQTT_HOST="<IP_ESTATICO_VM>"
export MQTT_PORT="1883"
export MQTT_USER="bipes"
export MQTT_PASS="<senha>"
```

2. Deploy da função (2ª geração):

```bash
gcloud functions deploy mqtt-publisher \
  --gen2 \
  --runtime=python312 \
  --region=$REGION \
  --source=. \
  --entry-point=publish_http \
  --trigger-http \
  --allow-unauthenticated \
  --set-env-vars MQTT_HOST=$MQTT_HOST,MQTT_PORT=$MQTT_PORT,MQTT_USER=$MQTT_USER,MQTT_PASS=$MQTT_PASS
```

3. Teste:

```bash
curl "https://$REGION-$PROJECT_ID.cloudfunctions.net/mqtt-publisher?session=test&topic=Topic1&value=123"
```

A resposta deve ser JSON com `success: true`.

## CORS

Já habilitado para `*` na função. Ajuste conforme necessário.

## Segurança

- Considere restringir `--allow-unauthenticated` e usar IAP, API Key ou autenticação própria.
- Não exponha secrets no repo; use Secret Manager em produção (pode ser mapeado via `--set-secrets`).
