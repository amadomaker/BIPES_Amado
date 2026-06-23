#!/bin/bash
# Configura Workload Identity Federation para GitHub Actions em um projeto GCP.
# Uso: ./setup-wif.sh <PROJECT_ID> <GITHUB_ORG/REPO>
# Exemplo: ./setup-wif.sh dblocks-499511 amadomaker/BIPES_Amado

set -euo pipefail

PROJECT_ID="${1:?Informe o PROJECT_ID}"
GITHUB_REPO="${2:?Informe o repositório GitHub no formato org/repo}"
GITHUB_ORG="${GITHUB_REPO%%/*}"

POOL_ID="github-actions"
PROVIDER_ID="github"
SA_NAME="github-actions-ci"
SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

echo "→ Projeto:    $PROJECT_ID"
echo "→ Repositório: $GITHUB_REPO"
echo ""

# 1. Habilita API IAM Credentials (necessária para WIF)
echo "[1/6] Habilitando API iamcredentials..."
gcloud services enable iamcredentials.googleapis.com --project="$PROJECT_ID"

# 2. Cria o Workload Identity Pool
echo "[2/6] Criando Workload Identity Pool '$POOL_ID'..."
gcloud iam workload-identity-pools create "$POOL_ID" \
  --project="$PROJECT_ID" \
  --location="global" \
  --display-name="GitHub Actions Pool" 2>/dev/null || echo "  (já existe, ignorando)"

# 3. Cria o Provider OIDC do GitHub
echo "[3/6] Criando Provider OIDC '$PROVIDER_ID'..."
gcloud iam workload-identity-pools providers create-oidc "$PROVIDER_ID" \
  --project="$PROJECT_ID" \
  --location="global" \
  --workload-identity-pool="$POOL_ID" \
  --display-name="GitHub" \
  --issuer-uri="https://token.actions.githubusercontent.com" \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.repository_owner=assertion.repository_owner" \
  --attribute-condition="assertion.repository_owner == '${GITHUB_ORG}'" 2>/dev/null || echo "  (já existe, ignorando)"

# 4. Cria a Service Account de CI
echo "[4/6] Criando Service Account '$SA_NAME'..."
gcloud iam service-accounts create "$SA_NAME" \
  --project="$PROJECT_ID" \
  --display-name="GitHub Actions CI" 2>/dev/null || echo "  (já existe, ignorando)"

# 5. Concede permissões à SA (Artifact Registry writer + Cloud Run developer)
echo "[5/6] Concedendo permissões à SA..."
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/artifactregistry.writer" --quiet

gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/run.developer" --quiet

# 6. Permite que o pool impersone a SA (escopo: repositório específico)
echo "[6/6] Vinculando pool → SA (repositório: $GITHUB_REPO)..."
POOL_NAME=$(gcloud iam workload-identity-pools describe "$POOL_ID" \
  --project="$PROJECT_ID" \
  --location="global" \
  --format="value(name)")

gcloud iam service-accounts add-iam-policy-binding "$SA_EMAIL" \
  --project="$PROJECT_ID" \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/${POOL_NAME}/attribute.repository/${GITHUB_REPO}"

# Exibe os valores para configurar no GitHub
PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format="value(projectNumber)")
PROVIDER_RESOURCE="projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${POOL_ID}/providers/${PROVIDER_ID}"

echo ""
echo "✅ WIF configurado. Adicione estes secrets no GitHub Environment:"
echo ""
echo "  WIF_PROVIDER       = ${PROVIDER_RESOURCE}"
echo "  WIF_SERVICE_ACCOUNT = ${SA_EMAIL}"
echo "  PROJECT_ID         = ${PROJECT_ID}"
