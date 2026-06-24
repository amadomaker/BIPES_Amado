resource "google_pubsub_topic" "bipes_messages" {
  project = var.project_id
  name    = "bipes-messages"
}

# Publisher SA pode publicar neste topic
resource "google_pubsub_topic_iam_binding" "publisher_publishes" {
  project = var.project_id
  topic   = google_pubsub_topic.bipes_messages.name
  role    = "roles/pubsub.publisher"
  members = ["serviceAccount:${var.publisher_sa_email}"]
}

# Push subscription com OIDC → Cloud Run subscriber
resource "google_pubsub_subscription" "bipes_subscriber" {
  project = var.project_id
  name    = "bipes-subscriber"
  topic   = google_pubsub_topic.bipes_messages.name

  push_config {
    push_endpoint = "${var.subscriber_url}/"

    oidc_token {
      service_account_email = var.pubsub_invoker_email
    }
  }

  ack_deadline_seconds       = 20
  message_retention_duration = "604800s"

  retry_policy {
    minimum_backoff = "10s"
    maximum_backoff = "300s"
  }
}
