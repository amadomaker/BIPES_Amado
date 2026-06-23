resource "google_service_account" "ui" {
  project      = var.project_id
  account_id   = "bipes-ui"
  display_name = "BIPES UI — Cloud Run"
}

resource "google_cloud_run_v2_service" "ui" {
  project  = var.project_id
  name     = "bipes-ui"
  location = var.region
  ingress  = "INGRESS_TRAFFIC_ALL"

  template {
    service_account = google_service_account.ui.email

    containers {
      image = var.image

      env {
        name  = "PUBLISHER_URL"
        value = var.publisher_url
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
      max_instance_count = 3
    }
  }

  lifecycle {
    ignore_changes = [client, client_version]
  }
}

resource "google_cloud_run_v2_service_iam_binding" "ui_public" {
  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.ui.name
  role     = "roles/run.invoker"
  members  = ["allUsers"]
}
