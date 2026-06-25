output "url" {
  value       = google_cloudfunctions2_function.publisher.service_config[0].uri
  description = "URL pública da Cloud Function publisher"
}
