output "bucket_name" {
  value       = module.backend_bucket.bucket_name
  description = "Bucket do Terraform state — referenciar em environments/production/main.tf"
}

output "bucket_url" {
  value = module.backend_bucket.bucket_url
}
