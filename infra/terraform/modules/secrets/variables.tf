variable "project_id" {
  type = string
}

variable "mongo_uri" {
  type      = string
  sensitive = true
}
