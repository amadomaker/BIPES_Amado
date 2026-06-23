output "bucket_name" {
  value       = google_storage_bucket.tfstate.name
  description = "Nome do bucket — usar em backend \"gcs\" { bucket = ... }"
}

output "bucket_url" {
  value       = google_storage_bucket.tfstate.url
  description = "gs:// URL do bucket"
}
