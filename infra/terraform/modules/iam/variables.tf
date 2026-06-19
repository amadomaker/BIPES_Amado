variable "project_id" {
  type = string
}

variable "region" {
  type = string
}

variable "mongo_secret_id" {
  type        = string
  description = "ID do secret mongo-uri no Secret Manager"
}

variable "subscriber_run_name" {
  type        = string
  description = "Nome do Cloud Run service do subscriber"
}
