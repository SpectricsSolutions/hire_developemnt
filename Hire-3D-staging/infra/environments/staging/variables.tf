variable "db_username" {
  type      = string
  sensitive = true
}

variable "db_password" {
  type      = string
  sensitive = true
}

variable "aws_account_id" {
  type = string
}

variable "alarm_email" {
  type = string
}

variable "jwt_secret" {
  type      = string
  sensitive = true
}

variable "bastion_key_name" {
  type        = string
  description = "EC2 key pair name for bastion SSH access."
}

variable "bastion_allowed_cidrs" {
  type        = list(string)
  description = "CIDRs allowed to SSH into the bastion (e.g. [\"1.2.3.4/32\"])."
}
