variable "project_id" {
  type = string
}

variable "region" {
  type = string
}

variable "publisher_sa" {
  type        = string
  description = "Email do service account do publisher"
}

variable "pubsub_topic" {
  type        = string
  description = "Nome do Pub/Sub topic onde publicar (ex: bipes-messages)"
}

variable "source_dir" {
  type        = string
  description = "Path absoluto ou relativo ao diretório com o código da Cloud Function"
}
