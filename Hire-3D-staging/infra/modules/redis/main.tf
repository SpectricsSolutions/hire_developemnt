resource "aws_elasticache_subnet_group" "this" {
  name       = "${var.environment}-redis"
  subnet_ids = var.subnet_ids

  tags = {
    Name = "${var.environment}-redis"
  }
}

resource "aws_elasticache_replication_group" "this" {
  replication_group_id = "${var.environment}-redis"
  description          = "Redis for background job processing"

  node_type          = var.node_type
  num_cache_clusters = var.num_cache_clusters
  port               = 6379

  subnet_group_name  = aws_elasticache_subnet_group.this.name
  security_group_ids = [var.security_group_id]

  engine_version = "7.1"

  at_rest_encryption_enabled = true
  transit_encryption_enabled = true

  automatic_failover_enabled = var.automatic_failover_enabled
  multi_az_enabled           = var.multi_az_enabled

  maintenance_window       = "mon:05:00-mon:06:00"
  snapshot_window          = "04:00-05:00"
  snapshot_retention_limit = 7

  apply_immediately = false

  tags = {
    Name = "${var.environment}-redis"
  }
}
