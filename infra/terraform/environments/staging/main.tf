terraform {
  required_version = ">= 1.8"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

module "apis" {
  source     = "../../modules/apis"
  project_id = var.project_id
}

module "registry" {
  source     = "../../modules/registry"
  project_id = var.project_id
  region     = var.region
  depends_on = [module.apis]
}

module "secrets" {
  source     = "../../modules/secrets"
  project_id = var.project_id
  mongo_uri  = var.mongo_uri
  depends_on = [module.apis]
}

module "iam" {
  source               = "../../modules/iam"
  project_id           = var.project_id
  region               = var.region
  mongo_secret_id      = module.secrets.mongo_uri_secret_id
  subscriber_run_name  = module.subscriber.service_name
  depends_on           = [module.secrets, module.subscriber]
}

module "subscriber" {
  source            = "../../modules/subscriber"
  project_id        = var.project_id
  region            = var.region
  image             = var.subscriber_image
  subscriber_sa     = module.iam.subscriber_sa_email
  mongo_secret_id   = module.secrets.mongo_uri_secret_id
  depends_on        = [module.iam, module.secrets]
}

module "pubsub" {
  source               = "../../modules/pubsub"
  project_id           = var.project_id
  publisher_sa_email   = module.iam.publisher_sa_email
  pubsub_invoker_email = module.iam.pubsub_invoker_email
  subscriber_url       = module.subscriber.url
  depends_on           = [module.iam, module.subscriber]
}

module "publisher" {
  source           = "../../modules/publisher"
  project_id       = var.project_id
  region           = var.region
  publisher_sa     = module.iam.publisher_sa_email
  pubsub_topic     = module.pubsub.topic_name
  source_dir       = "${path.module}/../../../cloud-functions/publisher"
  depends_on       = [module.pubsub, module.iam]
}
