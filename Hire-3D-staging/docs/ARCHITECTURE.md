# Infrastructure Architecture

**Region:** AWS eu-west-2 (London) — UK data residency for GDPR compliance  
**IaC:** Terraform, state managed in HCP Terraform (locked)  
**Version:** Final | Cycle 0 Sign-Off | 17 April 2026

---

## Traffic Flow

```
Browser → Cloudflare (DNS + DDoS) → ALB (ACM TLS) → ECS → RDS / S3 / Redis
```

All ECS ↔ AWS service communication (S3, SES, etc.) uses VPC Endpoints — traffic never crosses the public internet.

---

## Environments

| Environment | Hosting | Notes |
|---|---|---|
| Dev | Local (Docker) | Test data only, never visible to client |
| Staging | AWS | Auto-deployed on merge to `staging` |
| Production | AWS | Tagged release or manual approval required |

Separate databases, S3 buckets, and IAM roles per environment. Cross-environment access is enforced impossible via isolated IAM and separate Terraform state.

---

## Core Components

### ECS
- API service and Worker service
- Tasks run across multiple AZs by default

### RDS (PostgreSQL)
- Multi-AZ deployment
- Encryption at rest: AES-256 via AWS KMS (set at creation — cannot be retrofitted)
- TLS enforced: `rds.force_ssl = 1` on parameter group; connection string uses `sslmode=require`
- **Backups:** Daily automated, 14-day retention, Point-in-Time Recovery to any second within window
- Backup runs from Multi-AZ standby — zero performance impact on primary
- **Cross-region:** Weekly snapshot copy to eu-west-1 (Ireland) for region-level DR

### S3
- Private buckets
- Default encryption: SSE-S3 on all buckets
- Versioning enabled — full version history for evidence files

### Redis (ElastiCache)
- Background job processing only (not a cache)
- Covers: 5-day evidence reminder, notification bell, async report generation
- TLS in-transit encryption enabled

### ALB
- Sits behind Cloudflare
- TLS via ACM certificate
- Cloudflare SSL/TLS mode: Full (Strict) — validates origin cert, prevents MITM between Cloudflare and ALB

---

## Disaster Recovery

| Scenario | Mechanism | RTO |
|---|---|---|
| Single AZ failure | Multi-AZ RDS automatic failover | < 60 seconds |
| Region failure (eu-west-2) | Restore from weekly eu-west-1 snapshot | Hours; max 1 week data loss |

---

## Security

### Encryption
- **At rest:** AES-256 (KMS on RDS, SSE-S3 on S3)
- **In transit:** End-to-end — Browser→CF (HTTPS), CF→ALB (HTTPS/ACM), ECS→RDS (PostgreSQL TLS), ECS→Redis (ElastiCache TLS)

### Auth
- JWT access tokens, 15-minute expiry
- Server-side refresh tokens stored in DB, admin-configurable TTL (= session timeout)
- Instant revocation by Admin
- TOTP 2FA: required for Admin, recommended for Operator, optional for Read-Only

### RBAC
- Enforced at application layer, single source of truth
- Roles: Admin (full access), Operator (own clients only), Read-Only (view only)
- Audit table: append-only, no UPDATE/DELETE for any application role
- Every change logged: user ID, timestamp, field name, old value, new value

---

## Observability

- **Logs:** CloudWatch Logs for all ECS containers — structured JSON with request ID, user ID, action, timestamp
- **RDS:** Performance Insights enabled
- **Alarms:**
  - RDS CPU > 80%
  - RDS free storage < 20%
  - ECS task count drops to 0
  - ALB 5xx error rate > 5%

> Operational logs (CloudWatch) are separate from the business audit trail (append-only DB table). Operational logs serve debugging; the audit table serves compliance.

---

## CI/CD

GitHub Actions pipeline: `lint → test → build → ECR → ECS deploy`

- Staging: auto-deploy on merge to `staging`
- Production: tagged release or manual approval
