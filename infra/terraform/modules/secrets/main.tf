resource "google_secret_manager_secret" "mongo_uri" {
  project   = var.project_id
  secret_id = "mongo-uri"

  replication {
    auto {}
  }
}

resource "google_secret_manager_secret_version" "mongo_uri" {
  secret      = google_secret_manager_secret.mongo_uri.id
  secret_data = var.mongo_uri
}
