output "github_actions_role_arn" {
  value       = module.github_actions.role_arn
  description = "Add this as AWS_ROLE_ARN in GitHub Actions secrets"
}
