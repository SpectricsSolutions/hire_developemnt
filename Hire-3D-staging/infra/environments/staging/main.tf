provider "aws" {
  region = "eu-west-2"

  default_tags {
    tags = {
      Project     = "hire3d"
      Environment = "staging"
      ManagedBy   = "terraform"
    }
  }
}

module "vpc" {
  source = "../../modules/vpc"

  environment               = "staging"
  vpc_cidr                  = "10.1.0.0/16"
  availability_zones        = ["eu-west-2a", "eu-west-2b"]
  public_subnet_cidrs       = ["10.1.0.0/24", "10.1.1.0/24"]
  private_app_subnet_cidrs  = ["10.1.10.0/24", "10.1.11.0/24"]
  private_data_subnet_cidrs = ["10.1.20.0/24", "10.1.21.0/24"]
  single_nat_gateway        = true
}

module "security_groups" {
  source = "../../modules/security_groups"

  environment = "staging"
  vpc_id      = module.vpc.vpc_id
  vpc_cidr    = "10.1.0.0/16"
}

module "rds" {
  source = "../../modules/rds"

  environment       = "staging"
  vpc_id            = module.vpc.vpc_id
  subnet_ids        = module.vpc.private_data_subnet_ids
  security_group_id = module.security_groups.rds_id

  db_name     = "hire3d"
  db_username = var.db_username
  db_password = var.db_password

  instance_class          = "db.t4g.micro"
  multi_az                = false
  deletion_protection     = false
  backup_retention_period = 0
}

module "acm" {
  source = "../../modules/acm"

  domain = "app.hire3d.fun"
}

module "alb" {
  source = "../../modules/alb"

  environment       = "staging"
  vpc_id            = module.vpc.vpc_id
  subnet_ids        = module.vpc.public_subnet_ids
  security_group_id = module.security_groups.alb_id
  certificate_arn   = module.acm.certificate_arn
}

module "ecr" {
  source = "../../modules/ecr"

  environment          = "staging"
  image_tag_mutability = "MUTABLE"
}

module "redis" {
  source = "../../modules/redis"

  environment       = "staging"
  subnet_ids        = module.vpc.private_data_subnet_ids
  security_group_id = module.security_groups.redis_id

  node_type                  = "cache.t4g.micro"
  num_cache_clusters         = 1
  automatic_failover_enabled = false
  multi_az_enabled           = false
}

module "vpc_endpoints" {
  source = "../../modules/vpc_endpoints"

  environment             = "staging"
  vpc_id                  = module.vpc.vpc_id
  subnet_ids              = module.vpc.private_app_subnet_ids
  security_group_id       = module.security_groups.vpc_endpoints_id
  private_route_table_ids = module.vpc.private_route_table_ids
}

module "s3" {
  source = "../../modules/s3"

  environment = "staging"
}

module "monitoring" {
  source = "../../modules/monitoring"

  environment      = "staging"
  alarm_email      = var.alarm_email
  rds_instance_id  = module.rds.instance_id
  ecs_cluster_name = module.ecs.cluster_name
  alb_arn_suffix   = module.alb.arn_suffix
}

resource "aws_secretsmanager_secret" "db_host" {
  name = "staging/db_host"
}

resource "aws_secretsmanager_secret_version" "db_host" {
  secret_id     = aws_secretsmanager_secret.db_host.id
  secret_string = module.rds.address
}

resource "aws_secretsmanager_secret" "db_username" {
  name = "staging/db_username"
}

resource "aws_secretsmanager_secret_version" "db_username" {
  secret_id     = aws_secretsmanager_secret.db_username.id
  secret_string = var.db_username
}

resource "aws_secretsmanager_secret" "db_password" {
  name = "staging/db_password"
}

resource "aws_secretsmanager_secret_version" "db_password" {
  secret_id     = aws_secretsmanager_secret.db_password.id
  secret_string = var.db_password
}

resource "aws_secretsmanager_secret" "jwt_secret" {
  name = "staging/jwt_secret"
}

resource "aws_secretsmanager_secret_version" "jwt_secret" {
  secret_id     = aws_secretsmanager_secret.jwt_secret.id
  secret_string = var.jwt_secret
}

module "bastion" {
  source = "../../modules/bastion"

  environment           = "staging"
  vpc_id                = module.vpc.vpc_id
  subnet_id             = module.vpc.public_subnet_ids[0]
  rds_security_group_id = module.security_groups.rds_id
  key_name              = var.bastion_key_name
  allowed_cidr_blocks   = var.bastion_allowed_cidrs
}

module "ecs" {
  source = "../../modules/ecs"

  environment        = "staging"
  subnet_ids         = module.vpc.private_app_subnet_ids
  security_group_id  = module.security_groups.ecs_id
  target_group_arn   = module.alb.target_group_arn
  ecr_repository_url = module.ecr.repository_url
  image_tag          = "latest"

  api_cpu    = 256
  api_memory = 512

  worker_cpu           = 256
  worker_memory        = 512
  worker_desired_count = 0

  environment_variables = {
    ENVIRONMENT = "STAGING"
    DB_NAME     = module.rds.db_name
    DB_PORT     = "5432"
    REDIS_URL   = "rediss://${module.redis.primary_endpoint}:${module.redis.port}"
    BUCKET_NAME = module.s3.bucket_name
  }

  secrets = [
    { name = "DB_HOST", valueFrom = aws_secretsmanager_secret.db_host.arn },
    { name = "DB_USERNAME", valueFrom = aws_secretsmanager_secret.db_username.arn },
    { name = "DB_PASSWORD", valueFrom = aws_secretsmanager_secret.db_password.arn },
    { name = "JWT_SECRET", valueFrom = aws_secretsmanager_secret.jwt_secret.arn },
  ]
}
