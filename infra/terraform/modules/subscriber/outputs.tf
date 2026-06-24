output "url" {
  value       = google_cloud_run_v2_service.subscriber.uri
  description = "URL do Cloud Run subscriber (usada como push endpoint do Pub/Sub)"
}

output "service_name" {
  value       = google_cloud_run_v2_service.subscriber.name
  description = "Nome do serviço Cloud Run (usado no IAM binding)"
}
