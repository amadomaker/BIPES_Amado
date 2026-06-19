variable "project_id" {
  type    = string
  default = "dblocks-499511"
}

variable "region" {
  type    = string
  default = "us-central1"
}

variable "mongo_uri" {
  type      = string
  sensitive = true
}

variable "subscriber_image" {
  type        = string
  description = "Imagem do subscriber no Artifact Registry, ex: us-central1-docker.pkg.dev/dblocks-499511/dblocks/subscriber:latest"
}

variable "ui_image" {
  type        = string
  description = "Imagem do frontend no Artifact Registry, ex: us-central1-docker.pkg.dev/dblocks-499511/dblocks/ui:latest"
}
