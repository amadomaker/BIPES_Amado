variable "project_id" {
  type = string
}

variable "bucket_name" {
  type        = string
  description = "Nome global único do bucket GCS para o Terraform state"
}

variable "location" {
  type    = string
  default = "us-central1"
}
