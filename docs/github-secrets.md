# GitHub Secrets Configuration

Para que os pipelines funcionem corretamente, configure os seguintes secrets no repositório GitHub:

## Secrets Obrigatórios

### `GCP_SA_KEY`

- **Descrição**: JSON completo da Service Account do Google Cloud
- **Como obter**:
  1. No GCP Console → IAM & Admin → Service Accounts
  2. Selecione ou crie uma SA com permissões: Cloud Functions Developer, Cloud Run Developer, Artifact Registry Administrator
  3. Crie uma chave JSON e copie todo o conteúdo

### `MQTT_USER`

- **Descrição**: Usuário para autenticação no broker MQTT
- **Valor sugerido**: `bipes`
- **Usado em**: Cloud Function Publisher, configuração do mosquitto

### `MQTT_PASS`

- **Descrição**: Senha para autenticação no broker MQTT
- **Valor sugerido**: Gere uma senha forte
- **Usado em**: Cloud Function Publisher, configuração do mosquitto

## Infraestrutura Simplificada

### VM Única (broker-subscriber)

- **IP**: 34.71.118.245
- **Função**: Broker MQTT + Subscriber para MongoDB
- **Usado em**: Staging e Production

### Cloud Functions URLs

- **Staging**: https://mqtt-publisher-staging-tgtkazakja-uc.a.run.app
- **Production**: https://mqtt-publisher-tgtkazakja-uc.a.run.app

## Configuração no GitHub

1. Vá em Settings → Secrets and variables → Actions
2. Clique em "New repository secret"
3. Adicione cada secret listado acima

## Testes

Após configurar os secrets, teste os pipelines fazendo push para:

- Branch `staging`: deploys staging
- Branch `master`: deploys production
