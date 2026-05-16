# Infrastructure (Terraform)

State is managed in HCP Terraform. Each environment is a separate workspace with isolated state.

## Structure

```
infra/
  environments/
    staging/       ← workspace: hire3d-staging
    production/    ← workspace: hire3d-production
  modules/
    vpc/           ← VPC, subnets, NAT, route tables
```

## Prerequisites

- [Terraform](https://developer.hashicorp.com/terraform/install) >= 1.10
- HCP Terraform account with organisation and workspaces created
- AWS credentials configured (via environment variables or AWS CLI)

## Setup

Set your HCP Terraform organisation name, then authenticate:

```sh
export TF_CLOUD_ORGANIZATION="your-org-name"
terraform login
```

## Usage

All commands run from within the environment directory.

```sh
cd infra/environments/staging   # or production

terraform init
terraform plan
terraform apply
```

## Environments

| Environment | Workspace | VPC CIDR | NAT Gateways |
|---|---|---|---|
| Staging | staging | 10.1.0.0/16 | 1 (cost saving) |
| Production | production | 10.0.0.0/16 | 2 (one per AZ) |

## Subnet Layout

Each environment has three subnet tiers across two AZs (eu-west-2a, eu-west-2b):

| Tier | Purpose | Staging CIDRs | Production CIDRs |
|---|---|---|---|
| Public | ALB | 10.x.0.0/24, 10.x.1.0/24 | same pattern |
| Private App | ECS tasks | 10.x.10.0/24, 10.x.11.0/24 | same pattern |
| Private Data | RDS, Redis | 10.x.20.0/24, 10.x.21.0/24 | same pattern |

## Tagging

All resources inherit these tags via the provider `default_tags` block:

| Tag | Value |
|---|---|
| Project | hire3d |
| Environment | staging / production |
| ManagedBy | terraform |
