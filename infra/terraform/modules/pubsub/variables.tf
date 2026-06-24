variable "project_id" {
  type = string
}

variable "publisher_sa_email" {
  type        = string
  description = "Email do SA do publisher — recebe roles/pubsub.publisher no topic"
}

variable "pubsub_invoker_email" {
  type        = string
  description = "Email do SA pubsub-invoker — usado no OIDC token da push subscription"
}

variable "subscriber_url" {
  type        = string
  description = "URL do Cloud Run subscriber — endpoint de push do Pub/Sub"
}
