output "mongo_uri_secret_id" {
  value       = google_secret_manager_secret.mongo_uri.secret_id
  description = "ID do secret no Secret Manager"
}
