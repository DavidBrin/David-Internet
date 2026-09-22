# 17 — Delta Cloud

Slug: `delta-cloud` · Fake domain: `cloud.davids.net` · Archetype: **one interactive SVG map + a comparison figure**

Status: built 2026-09-21.

## Summary

Unlike the coursework demos, this one draws current company infrastructure: the AWS
platform behind Katalyxt, read from the private `Infrastructure` Terraform repository.
The page is a big-picture map — the cloud management layer, not the app — and stays at
whiteboard resolution: EC2 GPU instances under AWS Batch, the VPC and its subnets, the
databases, the Fargate services, the VPC endpoints, and the account-level ring around
them (secrets, registry, observability, schedules, audit, CI).

The framing phrases are deliberate: **agent-orchestrated platform** (DELTA, the control
plane that owns state and credentials) with a **stateless compute engine** (GAMMA, which
holds nothing and receives signed URLs per request).

## Source material and truth boundaries

| Claim | Source | Drawn as |
| --- | --- | --- |
| One VPC per env; public / app / data subnets; NAT; per-service security groups | `Cloud/AWS/modules/networking` | VPC frame + three bands |
| VPC endpoints (ECR, Secrets, Logs, KMS, STS, Bedrock, S3 gateway) | `modules/networking/endpoints.tf` | "VPC endpoints" node |
| DELTA on Fargate, autoscaled; web on Fargate; four ALBs (two public, two internal); WAF; ACM | `modules/compute/main.tf`, `waf.tf` | app band + public band |
| GPU plane: Batch on pinned g6 (L4), warm floor/ceiling; warm GPU search ECS on EC2; AMI bakery + auto-adopt | `gamma_gpu.tf`, `gamma_batch_ami_*.tf`, `Cloud/README.md` §12 | GPU band + `#compute-planes` |
| CPU Fargate Batch plane; source-prep plane declared dark | `gamma_cpu_batch.tf`, `source_prep_batch.tf` | "AWS Batch · CPU jobs" node |
| RDS PostgreSQL, ElastiCache Redis, three private S3 buckets | `modules/data` | data band |
| Secrets Manager injection at task start; Auth0 split of credentials vs URLs | `modules/secrets`, `Cloud/README.md` §6 | secrets + identity nodes |
| Bedrock as LLM provider, scoped invoke, VPC endpoint | root `main.tf`, `image_digests`/IAM | "LLM inference" node |
| Schedules, Lambdas, alarms, dashboards, digest, purge task | `modules/compute/*schedule*.tf`, `alarm_digest.tf`, … | schedules + observability nodes |
| Audit root: CloudTrail, GuardDuty (+ Claude triage), Security Hub, Config, Access Analyzer | `Cloud/AWS/audit` | "Security & audit" node |
| Bootstrap: S3 state, OIDC, ECR, budget, cross-env deny boundary | `Cloud/AWS/bootstrap` | GitHub + state + registry nodes |
| Ephemeral + persistent CI runners | `Cloud/AWS/CICD/*`, `modules/ci-runner*` | "Ephemeral CI runners" node |

**Deliberately omitted:** account ids, CIDRs, resource/secret names, hostnames, exact
sizes and counts, the retired Azure mirror. A unit test greps the model for account-id
and CIDR shapes and for the resource-name prefixes.

**Known doc/code disagreement not drawn:** whether production RDS is multi-AZ (README
says no, wrapper says yes). The page does not claim either.

## Stage

- `#cloud-map` — inline SVG (viewBox 1000×620): left column "People & partners", the
  VPC frame with public / app / compute-plane / data bands, right column "Account &
  region services". Nodes are keyboard-focusable buttons; clicking opens a detail card
  (group kicker, title, broad phrase in italics, specifics as bullets, "Talks to" chips
  that jump to neighbours). Edges route border-to-border; quiet edges sit at 22% opacity
  until a flow lights them; dashed = out-of-band.
- Three animated flows (`Trace a query`, `Trace an ingest`, `Trace a deploy`): a pulse
  walks each edge in order at 1.5 s per step; the card lists the captions with the
  current step bold; steps are clickable; Replay when done.
- `#compute-planes` — a second SVG drawn as the *difference*: queue → Batch with a warm
  instance and ghost instances up to the ceiling, versus internal ALB → one always-warm
  search instance; a "no shared capacity" divider between them.
- `#two-environments` — a staging vs production table (same shape, different numbers).

## Story rail

Seven beats: the DELTA/GAMMA split; the VPC; traffic that never leaves it; GPU
optimization two ways; the account-level ring; two environments one shape; what is
left out on purpose.

## Source drawer

The demo's own `model.ts`, `geometry.ts`, `CloudMap.tsx`, `ComputePlanes.tsx`. No
Terraform is vendored. Footer states the private source and the September 2026 read.

## Tech

TypeScript + React + inline SVG, no libraries. Static export; no data fetch.

## Manifest fields

`content/delta-cloud/site.ts` — kind `demo`, accent AWS orange `#EC7211`, favicon ☁️,
three deep links matching the stage sections, knowledge panel "Infrastructure map".

## Attribution

Infrastructure authored by the Katalyxt team; this page is David's reading of it.
Written with AI coding tools, 2026-09-21.

## Out of scope

Live cloud data, cost figures, the application layer (agents, connectors, product), the
Azure mirror, per-tenant onboarding kits.
