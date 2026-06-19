# Bucket GCS para o source zip da Cloud Function
resource "google_storage_bucket" "function_source" {
  project                     = var.project_id
  name                        = "${var.project_id}-cf-source"
  location                    = var.region
  uniform_bucket_level_access = true
  force_destroy               = true
}

# Empacota o código em zip — hash muda se qualquer arquivo mudar, forçando re-deploy
data "archive_file" "publisher_source" {
  type        = "zip"
  output_path = "/tmp/publisher.zip"
  source_dir  = var.source_dir
}

# Upload do zip ao GCS com nome baseado no hash
resource "google_storage_bucket_object" "publisher_source" {
  name   = "publisher-${data.archive_file.publisher_source.output_md5}.zip"
  bucket = google_storage_bucket.function_source.name
  source = data.archive_file.publisher_source.output_path
}

# Cloud Function v2 (gen2)
resource "google_cloudfunctions2_function" "publisher" {
  project  = var.project_id
  name     = "mqtt-publisher"
  location = var.region

  build_config {
    runtime     = "python312"
    entry_point = "publish_http"

    source {
      storage_source {
        bucket = google_storage_bucket.function_source.name
        object = google_storage_bucket_object.publisher_source.name
      }
    }
  }

  service_config {
    service_account_email = var.publisher_sa
    max_instance_count    = 10
    available_memory      = "256M"
    timeout_seconds       = 60

    environment_variables = {
      PROJECT_ID   = var.project_id
      PUBSUB_TOPIC = var.pubsub_topic
    }
  }
}

# Permite chamadas não-autenticadas (acesso público ao endpoint HTTP)
resource "google_cloudfunctions2_function_iam_binding" "publisher_public" {
  project        = var.project_id
  location       = var.region
  cloud_function = google_cloudfunctions2_function.publisher.name
  role           = "roles/cloudfunctions.invoker"
  members        = ["allUsers"]
}
