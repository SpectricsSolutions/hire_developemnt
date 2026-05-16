data "aws_ami" "amazon_linux" {
  count = var.enabled ? 1 : 0

  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["al2023-ami-*-x86_64"]
  }

  filter {
    name   = "state"
    values = ["available"]
  }
}

resource "aws_security_group" "bastion" {
  count = var.enabled ? 1 : 0

  name        = "${var.environment}-bastion"
  description = "Bastion: SSH from allowed CIDRs"
  vpc_id      = var.vpc_id

  ingress {
    description = "SSH"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = var.allowed_cidr_blocks
  }

  egress {
    description = "All outbound"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.environment}-bastion"
  }
}

resource "aws_security_group_rule" "rds_ingress_bastion" {
  count = var.enabled ? 1 : 0

  type                     = "ingress"
  description              = "PostgreSQL from bastion"
  from_port                = 5432
  to_port                  = 5432
  protocol                 = "tcp"
  security_group_id        = var.rds_security_group_id
  source_security_group_id = aws_security_group.bastion[0].id
}

resource "aws_instance" "bastion" {
  count = var.enabled ? 1 : 0

  ami                         = data.aws_ami.amazon_linux[0].id
  instance_type               = var.instance_type
  subnet_id                   = var.subnet_id
  vpc_security_group_ids      = [aws_security_group.bastion[0].id]
  key_name                    = var.key_name
  associate_public_ip_address = true

  metadata_options {
    http_tokens = "required"
  }

  tags = {
    Name = "${var.environment}-bastion"
  }
}

resource "aws_eip" "bastion" {
  count = var.enabled ? 1 : 0

  instance = aws_instance.bastion[0].id
  domain   = "vpc"

  tags = {
    Name = "${var.environment}-bastion"
  }
}
