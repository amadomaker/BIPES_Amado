output "url" {
  value       = google_cloud_run_v2_service.ui.uri
  description = "URL pública do frontend BIPES"
}
