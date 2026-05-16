variable "github_repo" {
  type        = string
  description = "GitHub repo in org/repo format"
}

variable "allowed_branches" {
  type        = list(string)
  description = "Branches allowed to assume the role"
  default     = ["master", "staging"]
}
