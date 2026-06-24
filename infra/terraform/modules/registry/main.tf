resource "google_artifact_registry_repository" "dblocks" {
  project       = var.project_id
  repository_id = "dblocks"
  location      = var.region
  format        = "DOCKER"
  description   = "BIPES container images"
}
