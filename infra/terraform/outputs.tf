output "artifact_registry_url" {
  value       = "${var.region}-docker.pkg.dev/${var.project_id}/dblocks"
  description = "Base URL do Artifact Registry para push de imagens"
}

output "publisher_url" {
  value       = google_cloudfunctions2_function.publisher.service_config[0].uri
  description = "URL da Cloud Function publisher"
}

output "subscriber_url" {
  value       = google_cloud_run_v2_service.subscriber.uri
  description = "URL do Cloud Run subscriber"
}
