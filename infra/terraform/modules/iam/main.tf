# SA do Cloud Run subscriber
resource "google_service_account" "subscriber" {
  project      = var.project_id
  account_id   = "bipes-subscriber"
  display_name = "BIPES Subscriber — Cloud Run"
}

# SA usado pelo Pub/Sub para push autenticado (OIDC) ao Cloud Run
resource "google_service_account" "pubsub_invoker" {
  project      = var.project_id
  account_id   = "pubsub-invoker"
  display_name = "Pub/Sub → Cloud Run invoker"
}

# SA da Cloud Function publisher
resource "google_service_account" "publisher" {
  project      = var.project_id
  account_id   = "bipes-publisher"
  display_name = "BIPES Publisher — Cloud Function"
}

# Subscriber SA lê o secret MONGO_URI
resource "google_secret_manager_secret_iam_binding" "subscriber_reads_mongo" {
  project   = var.project_id
  secret_id = var.mongo_secret_id
  role      = "roles/secretmanager.secretAccessor"
  members   = ["serviceAccount:${google_service_account.subscriber.email}"]
}

# pubsub-invoker SA pode invocar o Cloud Run subscriber
resource "google_cloud_run_v2_service_iam_binding" "pubsub_invokes_subscriber" {
  project  = var.project_id
  location = var.region
  name     = var.subscriber_run_name
  role     = "roles/run.invoker"
  members  = ["serviceAccount:${google_service_account.pubsub_invoker.email}"]
}
