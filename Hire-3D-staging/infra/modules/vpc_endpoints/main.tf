data "aws_region" "current" {}

locals {
  region = data.aws_region.current.name

  interface_services = [
    "ecr.api",
    "ecr.dkr",
    "logs",
    "secretsmanager",
    "ecs",
    "ecs-agent",
    "ecs-telemetry",
  ]
}

# S3 — Gateway type, free, no security group needed
resource "aws_vpc_endpoint" "s3" {
  vpc_id            = var.vpc_id
  service_name      = "com.amazonaws.${local.region}.s3"
  vpc_endpoint_type = "Gateway"
  route_table_ids   = var.private_route_table_ids

  tags = {
    Name = "${var.environment}-vpce-s3"
  }
}

# Interface endpoints — one per service
resource "aws_vpc_endpoint" "interface" {
  for_each = toset(local.interface_services)

  vpc_id              = var.vpc_id
  service_name        = "com.amazonaws.${local.region}.${each.key}"
  vpc_endpoint_type   = "Interface"
  subnet_ids          = var.subnet_ids
  security_group_ids  = [var.security_group_id]
  private_dns_enabled = true

  tags = {
    Name = "${var.environment}-vpce-${each.key}"
  }
}
