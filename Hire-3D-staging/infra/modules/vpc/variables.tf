variable "environment" {
  type = string
}

variable "vpc_cidr" {
  type = string
}

variable "availability_zones" {
  type = list(string)
}

variable "public_subnet_cidrs" {
  type = list(string)
}

variable "private_app_subnet_cidrs" {
  type = list(string)
}

variable "private_data_subnet_cidrs" {
  type = list(string)
}

variable "single_nat_gateway" {
  description = "Use a single NAT gateway instead of one per AZ. Reduces cost for non-production environments."
  type        = bool
  default     = false
}
