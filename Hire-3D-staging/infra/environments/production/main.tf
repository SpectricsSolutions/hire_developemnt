provider "aws" {
  region = "eu-west-2"

  default_tags {
    tags = {
      Project     = "hire3d"
      Environment = "production"
      ManagedBy   = "terraform"
    }
  }
}

module "vpc" {
  source = "../../modules/vpc"

  environment               = "production"
  vpc_cidr                  = "10.0.0.0/16"
  availability_zones        = ["eu-west-2a", "eu-west-2b"]
  public_subnet_cidrs       = ["10.0.0.0/24", "10.0.1.0/24"]
  private_app_subnet_cidrs  = ["10.0.10.0/24", "10.0.11.0/24"]
  private_data_subnet_cidrs = ["10.0.20.0/24", "10.0.21.0/24"]
  single_nat_gateway        = false
}

module "security_groups" {
  source = "../../modules/security_groups"

  environment = "production"
  vpc_id      = module.vpc.vpc_id
  vpc_cidr    = "10.0.0.0/16"
}

module "rds" {
  source = "../../modules/rds"

  environment       = "production"
  vpc_id            = module.vpc.vpc_id
  subnet_ids        = module.vpc.private_data_subnet_ids
  security_group_id = module.security_groups.rds_id

  db_name     = "hire3d"
  db_username = var.db_username
  db_password = var.db_password

  instance_class      = "db.t4g.medium"
  multi_az            = true
  deletion_protection = true
}

module "alb" {
  source = "../../modules/alb"

  environment       = "production"
  vpc_id            = module.vpc.vpc_id
  subnet_ids        = module.vpc.public_subnet_ids
  security_group_id = module.security_groups.alb_id
  certificate_arn   = var.certificate_arn
}

module "ecr" {
  source = "../../modules/ecr"

  environment          = "production"
  image_tag_mutability = "IMMUTABLE"
}

# Bastion is intentionally disabled in production.
# Direct DB access is not permitted in prod — use staging for local queries.
# To enable temporarily (e.g. incident response), set enabled = true, supply
# key_name and allowed_cidr_blocks, apply, then revert and apply again.
module "bastion" {
  source = "../../modules/bastion"

  environment           = "production"
  vpc_id                = module.vpc.vpc_id
  subnet_id             = module.vpc.public_subnet_ids[0]
  rds_security_group_id = module.security_groups.rds_id
  enabled               = false
}

module "redis" {
  source = "../../modules/redis"

  environment       = "production"
  subnet_ids        = module.vpc.private_data_subnet_ids
  security_group_id = module.security_groups.redis_id

  node_type                  = "cache.t4g.small"
  num_cache_clusters         = 2
  automatic_failover_enabled = true
  multi_az_enabled           = true
}
