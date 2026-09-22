import type { SiteManifest } from "@/lib/types";

const site: SiteManifest = {
  project: "delta-cloud",
  kind: "demo",
  displayName: "Delta Cloud",
  fakeDomain: "cloud.davids.net",
  liveUrl: "/demos/delta-cloud",
  tagline:
    "The AWS platform behind Katalyxt, drawn from its Terraform: an agent-orchestrated control plane on Fargate, a stateless GPU compute engine on Batch and EC2, and the private VPC that keeps them apart.",
  description:
    "An interactive architecture map of the Katalyxt platform's cloud infrastructure, read from the private Terraform repository: one VPC per environment with public, app, and data subnets; a Fargate control plane (DELTA) that owns state and credentials; a stateless compute engine (GAMMA) on two GPU planes — AWS Batch for bursty ingest and an always-warm ECS service for search; PostgreSQL, Redis, and three private S3 buckets; VPC endpoints, Secrets Manager, ECR, CloudWatch, EventBridge schedules, an audit root, and GitHub OIDC deploys with ephemeral EC2 runners. Click any box for what it is and why it is there, or trace a query, an ingest, and a deploy across the map.",
  accentColor: "#EC7211",
  favicon: "☁️",
  techStack: ["Terraform", "AWS", "ECS Fargate", "AWS Batch", "EC2 GPU", "RDS", "TypeScript", "SVG"],
  needsDatabase: false,
  deepLinks: [
    {
      path: "#cloud-map",
      title: "The environment map",
      snippet:
        "One VPC end to end: load balancers in public subnets, the Fargate control plane and GPU planes in app subnets, PostgreSQL and Redis in data subnets, and the account-wide ring of secrets, registry, observability, schedules, and audit. Click a box for its role; trace a query, an ingest, or a deploy.",
      keywords: ["vpc", "architecture diagram", "fargate", "load balancer", "subnets", "aws"],
    },
    {
      path: "#compute-planes",
      title: "Two GPU compute planes",
      snippet:
        "AWS Batch on GPU EC2 for long, bursty ingest — scale-to-zero, a warm floor, a burst ceiling, a pre-baked AMI — beside an always-warm GPU search service so a query never waits for a cold start.",
      keywords: ["aws batch", "gpu", "ec2", "cold start", "scale to zero", "nvidia l4"],
    },
    {
      path: "#two-environments",
      title: "Staging vs production",
      snippet:
        "The same Terraform root behind two thin wrappers: production adds availability zones, larger tasks, a warm GPU floor, a failover cache, deletion protection, and a reviewed plan → apply gate.",
      keywords: ["staging", "production", "terraform", "environments", "deploy"],
    },
  ],
  images: [],
  videos: [],
  keywords: [
    "katalyxt",
    "delta",
    "terraform",
    "aws",
    "infrastructure",
    "cloud architecture",
    "vpc",
    "fargate",
    "aws batch",
    "gpu",
    "rds",
    "postgres",
    "redis",
    "s3",
    "secrets manager",
    "vpc endpoints",
    "github oidc",
    "bedrock",
    "agent platform",
  ],
  knowledgePanel: {
    type: "Infrastructure map",
    facts: {
      Source: "Katalyxt's private Terraform for AWS, read and redrawn (no code reproduced)",
      Shape: "One VPC per environment · Fargate control plane · GPU Batch + warm GPU search · RDS, Redis, S3",
      "Kept private": "Account ids, CIDRs, resource and secret names, hostnames, exact sizes",
      "On this page": "Clickable map, three traced flows, a plane-vs-plane figure, an environment table",
    },
  },
  docs: { readme: false, spec: false, decisions: false },
};

export default site;
