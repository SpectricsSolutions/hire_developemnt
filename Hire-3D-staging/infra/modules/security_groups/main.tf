resource "aws_security_group" "alb" {
  name        = "${var.environment}-alb"
  description = "ALB: accepts public HTTPS, forwards to ECS"
  vpc_id      = var.vpc_id

  ingress {
    description = "HTTP"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTPS"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.environment}-alb"
  }
}

resource "aws_security_group" "ecs" {
  name        = "${var.environment}-ecs"
  description = "ECS tasks: accepts ALB, reaches RDS/Redis/AWS APIs"
  vpc_id      = var.vpc_id

  tags = {
    Name = "${var.environment}-ecs"
  }
}

resource "aws_security_group" "rds" {
  name        = "${var.environment}-rds"
  description = "RDS: accepts PostgreSQL from ECS only"
  vpc_id      = var.vpc_id

  tags = {
    Name = "${var.environment}-rds"
  }
}

resource "aws_security_group" "redis" {
  name        = "${var.environment}-redis"
  description = "Redis: accepts connections from ECS only"
  vpc_id      = var.vpc_id

  tags = {
    Name = "${var.environment}-redis"
  }
}

resource "aws_security_group" "vpc_endpoints" {
  name        = "${var.environment}-vpc-endpoints"
  description = "VPC interface endpoints: accepts HTTPS from within the VPC"
  vpc_id      = var.vpc_id

  ingress {
    description = "HTTPS from VPC"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = [var.vpc_cidr]
  }

  tags = {
    Name = "${var.environment}-vpc-endpoints"
  }
}

resource "aws_security_group_rule" "ecs_egress_https" {
  type              = "egress"
  description       = "HTTPS to AWS APIs (ECR, S3, CloudWatch, Secrets Manager)"
  from_port         = 443
  to_port           = 443
  protocol          = "tcp"
  security_group_id = aws_security_group.ecs.id
  cidr_blocks       = ["0.0.0.0/0"]
}

resource "aws_security_group_rule" "alb_egress_ecs" {
  type                     = "egress"
  description              = "ECS app port"
  from_port                = 8000
  to_port                  = 8000
  protocol                 = "tcp"
  security_group_id        = aws_security_group.alb.id
  source_security_group_id = aws_security_group.ecs.id
}

resource "aws_security_group_rule" "ecs_ingress_alb" {
  type                     = "ingress"
  description              = "From ALB"
  from_port                = 8000
  to_port                  = 8000
  protocol                 = "tcp"
  security_group_id        = aws_security_group.ecs.id
  source_security_group_id = aws_security_group.alb.id
}

resource "aws_security_group_rule" "ecs_egress_rds" {
  type                     = "egress"
  description              = "PostgreSQL"
  from_port                = 5432
  to_port                  = 5432
  protocol                 = "tcp"
  security_group_id        = aws_security_group.ecs.id
  source_security_group_id = aws_security_group.rds.id
}

resource "aws_security_group_rule" "rds_ingress_ecs" {
  type                     = "ingress"
  description              = "PostgreSQL from ECS"
  from_port                = 5432
  to_port                  = 5432
  protocol                 = "tcp"
  security_group_id        = aws_security_group.rds.id
  source_security_group_id = aws_security_group.ecs.id
}

resource "aws_security_group_rule" "ecs_egress_redis" {
  type                     = "egress"
  description              = "Redis"
  from_port                = 6379
  to_port                  = 6379
  protocol                 = "tcp"
  security_group_id        = aws_security_group.ecs.id
  source_security_group_id = aws_security_group.redis.id
}

resource "aws_security_group_rule" "redis_ingress_ecs" {
  type                     = "ingress"
  description              = "Redis from ECS"
  from_port                = 6379
  to_port                  = 6379
  protocol                 = "tcp"
  security_group_id        = aws_security_group.redis.id
  source_security_group_id = aws_security_group.ecs.id
}
