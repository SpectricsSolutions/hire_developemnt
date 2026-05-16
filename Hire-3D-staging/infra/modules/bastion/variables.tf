variable "environment" {
  type = string
}

variable "enabled" {
  type        = bool
  default     = true
  description = "Set to false to destroy all bastion resources. Always false in production."
}

variable "vpc_id" {
  type = string
}

variable "subnet_id" {
  type        = string
  description = "Public subnet to place the bastion in."
}

variable "rds_security_group_id" {
  type        = string
  description = "RDS security group to allow bastion → PostgreSQL ingress."
}

variable "key_name" {
  type        = string
  default     = ""
  description = "EC2 key pair name for SSH access. Required when enabled = true."
}

variable "allowed_cidr_blocks" {
  type        = list(string)
  default     = []
  description = "CIDRs permitted to SSH into the bastion. Required when enabled = true."
}

variable "instance_type" {
  type    = string
  default = "t3.micro"
}
