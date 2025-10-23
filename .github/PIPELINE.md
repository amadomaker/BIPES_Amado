# 🚀 BIPES CI/CD Pipeline Documentation

## 📋 **Arquitetura de Deploy**

Nossa arquitetura segue esta ordem de dependência:

```
1. VM (MQTT + Subscriber) ← Base da infraestrutura
2. Publisher Function ← Precisa do MQTT rodando
3. API Cloud Run ← Precisa do MQTT + Function + MongoDB
4. UI Cloud Run ← Precisa da API + Function rodando
```

## 🔄 **Workflows Disponíveis**

### 1. **Deploy Publisher Function** (`.github/workflows/deploy-publisher.yml`)

- **Trigger**: Push em `master`/`staging` + mudanças em `infra/cloud-functions/publisher/**`
- **Manual**: Workflow dispatch
- **Faz**: Deploy da Cloud Function HTTP para publicar no MQTT
- **Testa**: Health check + test publish

### 2. **Deploy API** (`.github/workflows/deploy-api.yml`)

- **Trigger**: Push em `master`/`staging` + mudanças em `easymqtt/**`
- **Manual**: Workflow dispatch
- **Faz**: Build/push Docker + deploy no Cloud Run
- **Testa**: Health check + test publish endpoint

### 3. **Deploy UI** (`.github/workflows/deploy-ui.yml`)

- **Trigger**: Push em `master`/`staging` + mudanças em `ui/**` ou `Dockerfile`
- **Manual**: Workflow dispatch
- **Faz**: Build/push Docker + deploy no Cloud Run com submodules
- **Testa**: Health check + content verification

### 4. **Full Stack Deploy** (`.github/workflows/deploy-full-stack.yml`)

- **Trigger**: Push em `master`/`staging` (qualquer mudança)
- **Manual**: Workflow dispatch
- **Faz**: Detecta mudanças + deploy em ordem + teste de integração
- **Inteligente**: Só deploy o que mudou

### 5. **VM Setup** (`.github/workflows/vm-setup.yml`)

- **Manual**: Workflow dispatch (documentação)
- **Faz**: Mostra instruções completas para setup da VM

## 🌍 **Ambientes**

### **Staging** (branch `staging`)

- Publisher: `https://mqtt-publisher-staging-tgtka7akja-uc.a.run.app`
- API: `https://bipes-api-staging-tgtka7akja-uc.a.run.app`
- UI: `https://bipes-ui-staging-tgtka7akja-uc.a.run.app`

### **Production** (branch `master`)

- Publisher: `https://mqtt-publisher-tgtka7akja-uc.a.run.app`
- API: `https://bipes-api-tgtka7akja-uc.a.run.app`
- UI: `https://bipes-ui-tgtka7akja-uc.a.run.app`

### **Infraestrutura Compartilhada**

- VM MQTT: `34.71.118.245:1883` (broker-subscriber)
- MongoDB: Atlas (externa)

## 🔐 **Secrets Necessários**

Configure estes secrets no GitHub:

```
GCP_SA_KEY - Service Account JSON para autenticação
GCP_PROJECT_ID - ID do projeto GCP
PROD_MQTT_HOST - IP da VM de produção
STAGING_MQTT_HOST - IP da VM de staging
MQTT_USER - Usuário do broker MQTT
MQTT_PASS - Senha do broker MQTT
```

## 📦 **Como Usar**

### **Deploy Automático**

1. Faça um PR para `staging` ou `master`
2. Merge aciona o workflow `deploy-full-stack.yml`
3. Só deploy o que mudou na ordem correta

### **Deploy Manual**

1. Vá em Actions → escolha o workflow
2. Click "Run workflow"
3. Selecione ambiente (staging/production)

### **Deploy Individual**

Use os workflows específicos:

- `deploy-publisher.yml` - Só a Function
- `deploy-api.yml` - Só a API
- `deploy-ui.yml` - Só a UI

## 🔧 **Setup Inicial**

### 1. **VM Setup** (uma vez por ambiente)

```bash
# Execute o workflow vm-setup.yml para ver instruções completas
# Ou siga os passos:

# Criar VM
gcloud compute instances create bipes-mqtt-vm \\
  --zone=us-central1-a \\
  --machine-type=e2-micro \\
  --boot-disk-size=10GB \\
  --tags=mqtt-server

# SSH e configurar
gcloud compute ssh bipes-mqtt-vm --zone=us-central1-a
cd BIPES_Amado/infra/gce-mqtt
cp .env.example .env
# Edite .env com suas credenciais
docker compose up -d
```

### 2. **GitHub Secrets**

```bash
# Service Account (com permissões Cloud Run, Functions, Artifact Registry)
# Project ID
# IPs das VMs
# Credenciais MQTT
```

### 3. **Primeiro Deploy**

```bash
# Push para staging para testar
git push origin staging

# Depois para produção
git push origin master
```

## 🔍 **Troubleshooting**

### **VM não responde**

```bash
# Verifique status
gcloud compute instances describe bipes-mqtt-vm --zone=us-central1-a

# SSH e verificar serviços
docker compose ps
docker logs mqtt -f
docker logs subscriber -f
```

### **Function falha**

```bash
# Logs da função
gcloud functions logs read mqtt-publisher --region=us-central1 --limit=50
```

### **API/UI falha**

```bash
# Logs do Cloud Run
gcloud run services logs read bipes-api --region=us-central1 --limit=100
```

### **Teste de conectividade**

```bash
# Test MQTT direto na VM (34.71.118.245)
mosquitto_pub -h 34.71.118.245 -p 1883 -u bipes -P PASSWORD -t "test/topic" -m "hello"

# Test Function - Staging
curl "https://mqtt-publisher-staging-tgtka7akja-uc.a.run.app?session=test&topic=health&value=1"

# Test Function - Production
curl "https://mqtt-publisher-tgtka7akja-uc.a.run.app?session=test&topic=health&value=1"

# Test API - Staging
curl "https://bipes-api-staging-tgtka7akja-uc.a.run.app/"

# Test API - Production
curl "https://bipes-api-tgtka7akja-uc.a.run.app/"

# Test UI - Staging
curl "https://bipes-ui-staging-tgtka7akja-uc.a.run.app/"

# Test UI - Production
curl "https://bipes-ui-tgtka7akja-uc.a.run.app/"
```

## 📊 **Monitoramento**

Cada workflow inclui:

- ✅ **Health checks** automáticos
- 🧪 **Testes de integração**
- 📋 **Sumário de deploy** com URLs
- ⚠️ **Falha rápida** se dependências quebram

## 🎯 **Benefícios da Pipeline**

1. **Deploy Inteligente**: Só deploy o que mudou
2. **Ordem Correta**: Respeita dependências da arquitetura
3. **Ambiente Isolado**: Staging/Production separados
4. **Testes Automáticos**: Verifica se tudo funciona
5. **Rollback Fácil**: Workflows independentes
6. **Manual Override**: Sempre pode fazer deploy manual
