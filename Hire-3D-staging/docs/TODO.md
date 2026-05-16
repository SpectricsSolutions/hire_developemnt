# TODO

Open items and operational notes. See [`PRODUCT_SPEC.md`](./PRODUCT_SPEC.md) for the full phase plan and `git log` for shipped work.

---

## Open

### Phase F — Admin Dashboard data

The home dashboard (`app/src/pages/home.tsx`) currently surfaces what's derivable from the existing data:

- Stat cards (clients by status — scoped to assigned for OPERATOR via `clients:read_all`)
- "Needs Attention" list (FOLLOW_UP_DUE + AUDIT_IN_PROGRESS, prioritised)
- Recent audit log feed (admin only)
- Operator leaderboard — CREATE/UPDATE counts over the last 30 days from `audit_logs`, joined with `users` (admin only)

Not yet exposed (depends on later phases):

- Active clients by product / pipeline value / revenue → needs Phase E billing data
- Audit completion rates per operator/period → needs Phase B–C engagement-status flow
- Outstanding findings, overdue evidence requests → needs Phase B–C tables
- Clients approaching review dates → `engagements.next_review_due` exists, not yet surfaced

The leaderboard pulls a single page of audit logs (`limit=200`) — fine for current volume, but a server-side `GET /audit-logs/leaderboard?days=30` is the right fix once volume grows.

### Phase B–F

Data models not yet started. See PRODUCT_SPEC §"Build Phases".

---

## Operational

### Bastion (staging only)

A bastion EC2 (t3.nano, Amazon Linux 2023) lives in `infra/modules/bastion/`. It sits in a public subnet with an Elastic IP and opens port 5432 on the RDS security group only when active.

**Staging** — enabled by default. Requires two HCP Terraform variables:
- `bastion_key_name` — EC2 key pair name (create in AWS Console → EC2 → Key Pairs, eu-west-2)
- `bastion_allowed_cidrs` — list of IPs allowed to SSH, e.g. `["1.2.3.4/32"]`

**Production** — `enabled = false`, no resources are created. Direct DB access is not permitted in prod. To enable temporarily for incident response: set `enabled = true`, add `key_name` and `allowed_cidr_blocks` to the production module call, apply, then revert and apply again.

**Local tunnel:**
```bash
ssh -i ~/.ssh/your-key.pem -L 5433:<rds-endpoint>:5432 ec2-user@<bastion-ip> -N
psql -h localhost -p 5433 -U <user> -d hire3d
```

**Retool:** PostgreSQL connection, host = RDS endpoint, port = 5432, SSH tunnel host = bastion public IP, user = `ec2-user`, upload the `.pem`.
