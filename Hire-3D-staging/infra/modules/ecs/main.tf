data "aws_region" "current" {}

locals {
  image = "${var.ecr_repository_url}:${var.image_tag}"

  env_vars = [
    for k, v in var.environment_variables : { name = k, value = v }
  ]

  log_options = {
    "awslogs-region"        = data.aws_region.current.name
    "awslogs-stream-prefix" = "ecs"
  }

  min_healthy = var.environment == "production" ? 100 : 50
}

resource "aws_ecs_cluster" "this" {
  name = var.environment

  setting {
    name  = "containerInsights"
    value = "enabled"
  }

  tags = {
    Name = var.environment
  }
}

resource "aws_cloudwatch_log_group" "api" {
  name              = "/ecs/${var.environment}/api"
  retention_in_days = var.log_retention_days

  tags = {
    Name = "${var.environment}-api"
  }
}

resource "aws_cloudwatch_log_group" "worker" {
  name              = "/ecs/${var.environment}/worker"
  retention_in_days = var.log_retention_days

  tags = {
    Name = "${var.environment}-worker"
  }
}

resource "aws_ecs_task_definition" "api" {
  family                   = "${var.environment}-api"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.api_cpu
  memory                   = var.api_memory
  execution_role_arn       = aws_iam_role.execution.arn
  task_role_arn            = aws_iam_role.task.arn

  container_definitions = jsonencode([
    {
      name      = "api"
      image     = local.image
      essential = true

      portMappings = [
        { containerPort = 8000, protocol = "tcp" }
      ]

      environment = local.env_vars
      secrets     = var.secrets

      logConfiguration = {
        logDriver = "awslogs"
        options   = merge(local.log_options, { "awslogs-group" = aws_cloudwatch_log_group.api.name })
      }
    }
  ])

  tags = {
    Name = "${var.environment}-api"
  }
}

resource "aws_ecs_task_definition" "worker" {
  family                   = "${var.environment}-worker"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.worker_cpu
  memory                   = var.worker_memory
  execution_role_arn       = aws_iam_role.execution.arn
  task_role_arn            = aws_iam_role.task.arn

  container_definitions = jsonencode([
    {
      name      = "worker"
      image     = local.image
      essential = true
      command   = ["uv", "run", "arq", "workers.main.WorkerSettings"]

      environment = local.env_vars
      secrets     = var.secrets

      logConfiguration = {
        logDriver = "awslogs"
        options   = merge(local.log_options, { "awslogs-group" = aws_cloudwatch_log_group.worker.name })
      }
    }
  ])

  tags = {
    Name = "${var.environment}-worker"
  }
}

resource "aws_ecs_service" "api" {
  name            = "api"
  cluster         = aws_ecs_cluster.this.id
  task_definition = aws_ecs_task_definition.api.arn
  launch_type     = "FARGATE"
  desired_count   = var.api_desired_count

  network_configuration {
    subnets          = var.subnet_ids
    security_groups  = [var.security_group_id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = var.target_group_arn
    container_name   = "api"
    container_port   = 8000
  }

  deployment_minimum_healthy_percent = local.min_healthy
  deployment_maximum_percent         = 200

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  lifecycle {
    ignore_changes = [task_definition]
  }

  tags = {
    Name = "${var.environment}-api"
  }
}

resource "aws_ecs_service" "worker" {
  name            = "worker"
  cluster         = aws_ecs_cluster.this.id
  task_definition = aws_ecs_task_definition.worker.arn
  launch_type     = "FARGATE"
  desired_count   = var.worker_desired_count

  network_configuration {
    subnets          = var.subnet_ids
    security_groups  = [var.security_group_id]
    assign_public_ip = false
  }

  deployment_minimum_healthy_percent = local.min_healthy
  deployment_maximum_percent         = 200

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  lifecycle {
    ignore_changes = [task_definition]
  }

  tags = {
    Name = "${var.environment}-worker"
  }
}
