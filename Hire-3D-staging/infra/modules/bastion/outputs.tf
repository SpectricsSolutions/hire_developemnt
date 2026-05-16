output "public_ip" {
  value       = var.enabled ? aws_eip.bastion[0].public_ip : null
  description = "Stable public IP — use this for SSH tunnels and Retool. null when disabled."
}

output "instance_id" {
  value = var.enabled ? aws_instance.bastion[0].id : null
}
