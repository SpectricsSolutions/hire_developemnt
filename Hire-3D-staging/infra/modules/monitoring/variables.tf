variable "environment" {
  type = string
}

variable "alarm_email" {
  type = string
}

variable "rds_instance_id" {
  type = string
}

variable "ecs_cluster_name" {
  type = string
}

variable "alb_arn_suffix" {
  type = string
}

variable "rds_allocated_storage_gb" {
  type    = number
  default = 20
}
