output "topic_name" {
  value       = google_pubsub_topic.bipes_messages.name
  description = "Nome do topic Pub/Sub (usado pelo publisher)"
}
