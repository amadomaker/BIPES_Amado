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

variable "publisher_url" {
  type        = string
  description = "URL da Cloud Function publisher (passada ao PHP via PUBLISHER_URL)"
}
