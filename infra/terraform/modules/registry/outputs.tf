output "repository_url" {
  value       = "${var.region}-docker.pkg.dev/${var.project_id}/dblocks"
  description = "Base URL do repositório para docker push/pull"
}
