resource "google_cloud_run_v2_service" "subscriber" {
  project  = var.project_id
  name     = "bipes-subscriber"
  location = var.region
  ingress  = "INGRESS_TRAFFIC_ALL"

  template {
    service_account = var.subscriber_sa

    containers {
      image = var.image

      env {
        name = "MONGO_URI"
        value_source {
          secret_key_ref {
            secret  = var.mongo_secret_id
            version = "latest"
          }
        }
      }

      resources {
        limits = {
          cpu    = "1"
          memory = "512Mi"
        }
      }
    }

    scaling {
      min_instance_count = 0
      max_instance_count = 5
    }
  }

  lifecycle {
    ignore_changes = [client, client_version]
  }
}
