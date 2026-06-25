variable "project_id" {
  type    = string
  default = "dblocks-500317"
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
  description = "Imagem do subscriber no Artifact Registry"
}

variable "ui_image" {
  type        = string
  description = "Imagem do frontend no Artifact Registry"
}
