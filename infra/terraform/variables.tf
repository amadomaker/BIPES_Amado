variable "project_id" {
  type    = string
  default = "dblocks-499511"
}

variable "region" {
  type    = string
  default = "us-central1"
}

variable "mongo_uri" {
  type        = string
  sensitive   = true
  description = "MongoDB Atlas connection string"
}

variable "subscriber_image" {
  type        = string
  description = "Full Artifact Registry path para a imagem do subscriber, ex: us-central1-docker.pkg.dev/dblocks-499511/dblocks/subscriber:latest"
}
