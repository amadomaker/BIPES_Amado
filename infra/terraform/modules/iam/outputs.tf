output "subscriber_sa_email" {
  value = google_service_account.subscriber.email
}

output "pubsub_invoker_email" {
  value = google_service_account.pubsub_invoker.email
}

output "publisher_sa_email" {
  value = google_service_account.publisher.email
}
