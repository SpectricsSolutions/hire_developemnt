terraform {
  cloud {
    organization = "EliteEmployee"

    workspaces {
      name = "shared"
    }
  }

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  required_version = ">= 1.10"
}
