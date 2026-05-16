provider "aws" {
  region = "eu-west-2"

  default_tags {
    tags = {
      Project   = "hire3d"
      ManagedBy = "terraform"
    }
  }
}

module "github_actions" {
  source = "../../modules/github_actions"

  github_repo      = "techardent-in/hire3d"
  allowed_branches = ["master", "staging"]
}
