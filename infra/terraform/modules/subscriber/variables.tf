variable "project_id" {
  type = string
}

variable "region" {
  type = string
}

variable "image" {
  type        = string
  description = "Full image path no Artifact Registry"
}

variable "subscriber_sa" {
  type        = string
  description = "Email do service account do subscriber"
}

variable "mongo_secret_id" {
  type        = string
  description = "ID do secret mongo-uri no Secret Manager"
}
