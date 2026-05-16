resource "aws_db_subnet_group" "this" {
  name       = "${var.environment}-rds"
  subnet_ids = var.subnet_ids

  tags = {
    Name = "${var.environment}-rds"
  }
}

resource "aws_db_parameter_group" "this" {
  name   = "${var.environment}-postgres17"
  family = "postgres17"

  parameter {
    name         = "rds.force_ssl"
    value        = "1"
    apply_method = "pending-reboot"
  }

  tags = {
    Name = "${var.environment}-postgres17"
  }
}

resource "aws_db_instance" "this" {
  identifier = "${var.environment}-postgres"

  engine         = "postgres"
  engine_version = "17"
  instance_class = var.instance_class

  db_name  = var.db_name
  username = var.db_username
  password = var.db_password

  db_subnet_group_name   = aws_db_subnet_group.this.name
  vpc_security_group_ids = [var.security_group_id]
  parameter_group_name   = aws_db_parameter_group.this.name

  multi_az          = var.multi_az
  storage_type      = "gp3"
  allocated_storage = 20
  storage_encrypted = true

  backup_retention_period = var.backup_retention_period
  backup_window           = "03:00-04:00"
  maintenance_window      = "mon:04:00-mon:05:00"
  copy_tags_to_snapshot   = true

  performance_insights_enabled = true

  deletion_protection       = var.deletion_protection
  skip_final_snapshot       = false
  final_snapshot_identifier = "${var.environment}-postgres-final"

  tags = {
    Name = "${var.environment}-postgres"
  }
}
