output "vpc_id" {
  value = module.vpc.vpc_id
}

output "public_subnet_ids" {
  value = module.vpc.public_subnet_ids
}

output "private_app_subnet_ids" {
  value = module.vpc.private_app_subnet_ids
}

output "private_data_subnet_ids" {
  value = module.vpc.private_data_subnet_ids
}

output "rds_endpoint" {
  value = module.rds.endpoint
}

output "alb_dns_name" {
  value = module.alb.dns_name
}

output "acm_validation_records" {
  description = "Add these CNAME records in Cloudflare to validate the ACM certificate."
  value       = module.acm.validation_records
}

output "ecs_cluster_name" {
  value = module.ecs.cluster_name
}
