terraform {
  required_version = ">= 1.8"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
  # Backend local intencional: esse config gerencia o bucket que é
  # o backend do production — não pode armazenar seu próprio state nele.
}

provider "google" {
  project = var.project_id
  region  = var.region
}

module "backend_bucket" {
  source      = "../../modules/backend-bucket"
  project_id  = var.project_id
  bucket_name = "${var.project_id}-tfstate"
  location    = var.region
}
