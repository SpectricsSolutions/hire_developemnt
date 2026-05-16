# Pre-Launch Checklist

Everything that must be in place before applying Terraform or deploying to production.

---

## 1. HCP Terraform

### Create Organisation and Workspaces

1. Sign in at [app.terraform.io](https://app.terraform.io)
2. Create an organisation named `EliteEmployee`
3. Create three workspaces: `shared`, `staging` and `production`
4. For each workspace → **Settings → General**:
   - Set **Working Directory** to `infra/environments/<workspace-name>`
   - Set **Execution Mode** to `Remote`
   - Set **Terraform Version** to `>= 1.10`

### Terraform Variables (set per workspace under Variables tab)

| Variable | Workspace | Type | Sensitive | Notes |
|---|---|---|---|---|
| `db_username` | staging, production | Terraform | Yes | Postgres superuser name |
| `db_password` | staging, production | Terraform | Yes | Min 16 chars, no `@` or `/` |
| `aws_account_id` | staging | Terraform | No | 12-digit AWS account ID |
| `alarm_email` | staging | Terraform | No | Receives CloudWatch alert emails |
| `jwt_secret` | staging, production | Terraform | Yes | Min 32 chars random string — signs JWT access tokens |
| `bastion_key_name` | staging | Terraform | No | Name of the EC2 key pair created in step 1a below |
| `bastion_allowed_cidrs` | staging | Terraform | No | JSON list of IPs allowed to SSH, e.g. `["1.2.3.4/32"]` |

### Environment Variables (set per workspace under Variables tab)

| Variable | Sensitive | Notes |
|---|---|---|
| `AWS_ACCESS_KEY_ID` | No | IAM user with infra provisioning permissions |
| `AWS_SECRET_ACCESS_KEY` | Yes | Corresponding secret key |
| `AWS_REGION` | No | `eu-west-2` |

### 1a. Bastion Key Pair (staging only)

The bastion EC2 requires an SSH key pair created manually — AWS does not let Terraform generate and download private keys.

1. Go to **AWS Console → EC2 → Key Pairs → Create key pair** (region: `eu-west-2`)
2. Name it `hire3d-bastion`, type `RSA`, format `.pem`
3. Download and store the `.pem` securely (e.g. `~/.ssh/hire3d-bastion.pem`)
4. `chmod 400 ~/.ssh/hire3d-bastion.pem`
5. Set `bastion_key_name = "hire3d-bastion"` in the staging workspace variables
6. Get your public IP and set `bastion_allowed_cidrs`:
   ```sh
   curl -s https://checkip.amazonaws.com
   # → set variable to ["<your-ip>/32"]
   ```
   Add all developer IPs that need direct DB access.

> **Production:** bastion is disabled (`enabled = false`) — no key pair needed.

---

## 2. AWS — OIDC and GitHub Actions Role (Terraform)

The OIDC provider and IAM role are managed in the `shared` workspace — no manual AWS console steps needed.

```sh
cd infra/environments/shared
terraform init
terraform apply
```

This creates:
- The GitHub OIDC identity provider in IAM
- An IAM role scoped to `master` and `staging` branches with ECR push and ECS deploy permissions

After apply, get the role ARN:

```sh
terraform output github_actions_role_arn
```

---

## 3. GitHub — Repository Secrets

Go to **repo → Settings → Secrets and variables → Actions → New repository secret**.

| Secret | Value |
|---|---|
| `AWS_ROLE_ARN` | Output of `terraform output github_actions_role_arn` from the `shared` workspace |

---

## 4. DNS — ACM Certificate Validation

ACM validates domain ownership via a CNAME record regardless of DNS provider (Cloudflare, Route 53, GoDaddy, etc.). The certificate stays in `PENDING_VALIDATION` until the record is added.

### Steps

1. Run the first `terraform apply` — it will partially succeed and output the validation records
2. Get the CNAME details:
   ```sh
   cd infra/environments/staging   # or production
   terraform output validation_records
   ```
3. Add the returned CNAME record in your DNS provider
4. Wait a few minutes for the certificate to move to `ISSUED`
5. Re-run `terraform apply` to complete the `aws_acm_certificate_validation` step
6. Point your app subdomain to the ALB:
   ```sh
   terraform output alb_dns_name
   ```
   Add a CNAME record: `app.yourdomain.com` → ALB DNS name

> **For client domains:** share the `name` and `value` from `terraform output validation_records` with the client — they add it in their DNS provider. Record type is always `CNAME`.

### Checklist

- [ ] Client's domain and DNS provider confirmed
- [ ] Update `domain` in `infra/environments/<env>/main.tf` to the client's domain before applying
- [ ] CNAME validation record added in the DNS provider
- [ ] Certificate status is `ISSUED` in ACM console before final apply
- [ ] App subdomain CNAME points to the ALB DNS name

---

## 5. Production-specific Checks

- [ ] `deletion_protection = true` on RDS (default — do not override)
- [ ] `backup_retention_period` is `14` (default)
- [ ] `multi_az = true` on RDS
- [ ] `enable_deletion_protection = true` on ALB (set automatically for production)
- [ ] `single_nat_gateway = false` (two NAT gateways, one per AZ)
- [ ] Alarm email subscription confirmed — SNS sends a confirmation email on first apply, must be accepted before alerts fire
