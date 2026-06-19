output "artifact_registry_url" {
  value       = module.registry.repository_url
  description = "Base URL do Artifact Registry para docker push"
}

output "publisher_url" {
  value       = module.publisher.url
  description = "URL pública da Cloud Function publisher"
}

output "subscriber_url" {
  value       = module.subscriber.url
  description = "URL do Cloud Run subscriber"
}
