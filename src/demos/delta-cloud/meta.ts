import type { DemoMeta } from "@/lib/demos";

const meta: DemoMeta = {
  slug: "delta-cloud",
  theme: { bg: "#f3f6f9", panel: "#e6ecf2" }, // cool slate — a cloud console's page
  what: "the AWS platform behind Katalyxt, drawn from its Terraform: one VPC, a Fargate control plane, a GPU compute plane, and the data tier",
  why: "an agent platform is only as trustworthy as the boundaries around it — where credentials live, what can reach the database, what scales to zero",
  when: "Katalyxt AI, 2026 — read from the private Infrastructure repo, redrawn here without names or numbers",
  story: [
    {
      title: "Agent-orchestrated platform, stateless compute engine",
      body:
        "Two services carry the platform. DELTA is the control plane: it owns tenants, state, and every credential, and its agents call Claude on Bedrock. GAMMA is the compute engine: it runs the heavy models and holds nothing — no database, no bucket, no cache — just a signed URL per request and a shared secret to sign its answers with. Everything else on the map exists to keep that split honest.",
      anchor: "#cloud-map",
    },
    {
      title: "One VPC, private by default",
      body:
        "Each environment is one VPC with public, app, and data subnets across several availability zones. Only load balancers live in public subnets. Fargate tasks and the GPU plane sit in app subnets; the database and cache sit in data subnets that accept connections from the control plane's security group and nothing else. Security groups are split per service, so the compute engine cannot reach the data tier even if it wanted to.",
      anchor: "#cloud-map",
    },
    {
      title: "Traffic that never leaves the VPC",
      body:
        "The control plane and compute engine talk through two internal load balancers: one for synchronous search, one for the engine's progress webhooks, which are HMAC-signed. Container pulls, secret injection, logs, KMS, STS and Bedrock calls all go through VPC endpoints. The NAT gateway is still there, but the tens-of-gigabytes model image no longer crosses it on every task placement — that bill is what made the endpoints worth it.",
      anchor: "#cloud-map",
    },
    {
      title: "GPU optimization, two ways",
      body:
        "Heavy models outgrew CPU containers, so the compute engine got two GPU planes split by workload shape. Long, bursty ingest goes to AWS Batch on GPU EC2 instances that scale between a warm floor and a burst ceiling; user-facing search gets a separate always-warm GPU service so a query never waits for a boot. Cold starts are attacked in layers: a warm floor, a boot-time image pre-pull, and a pre-baked machine image that a Lambda adopts into Terraform when a new bake lands.",
      anchor: "#compute-planes",
    },
    {
      title: "Around the VPC",
      body:
        "The account-level ring is where the operational work is: Secrets Manager injecting credentials at task start, an immutable container registry, CloudWatch dashboards and alarms rolled into a weekly digest, EventBridge schedules that scale staging to zero overnight, a launch-template guard, and an audit root with CloudTrail, GuardDuty (triaged by a Claude classifier), Security Hub, Config, and Access Analyzer. CI reaches all of it over GitHub OIDC; ephemeral EC2 runners build the big image one job at a time.",
      anchor: "#cloud-map",
    },
    {
      title: "Two environments, one shape",
      body:
        "Staging and production are the same Terraform root called by two thin wrappers. Production is the same drawing with bigger numbers: more availability zones, larger and more tasks, a warm GPU floor, a failover cache, deletion protection, and a reviewed plan → apply gate behind required reviewers. A per-environment deny boundary on the deploy role means a staging apply cannot touch production state, secrets, or data.",
      anchor: "#two-environments",
    },
    {
      title: "What this page leaves out, on purpose",
      body:
        "The Terraform itself is private and stays that way. Account ids, CIDRs, resource names, secret names, hostnames, and exact sizes are omitted; the diagram is the shape, drawn in September 2026 from reading the modules, the state ledger, and the architecture decisions. A retired Azure mirror of the same shape is still in the repo for rollback and is not drawn.",
    },
  ],
  sources: [
    {
      name: "model.ts",
      path: "src/demos/delta-cloud/core/model.ts",
      lang: "ts",
      note: "The diagram's data: every box, arrow, and traced flow, with the plain-language detail behind each.",
    },
    {
      name: "geometry.ts",
      path: "src/demos/delta-cloud/core/geometry.ts",
      lang: "ts",
      note: "Border-to-border edge routing so arrowheads land on boxes, not their centres.",
    },
    {
      name: "CloudMap.tsx",
      path: "src/demos/delta-cloud/CloudMap.tsx",
      lang: "tsx",
      note: "The inline SVG map: bands, nodes as buttons, edges, and the pulse that walks a flow.",
    },
    {
      name: "ComputePlanes.tsx",
      path: "src/demos/delta-cloud/ComputePlanes.tsx",
      lang: "tsx",
      note: "Batch vs warm search, drawn as the difference between two scaling contracts.",
    },
  ],
  sourceFooter:
    "Drawn from Katalyxt's private Infrastructure repository (Terraform for AWS) in September 2026. No Terraform is reproduced here; the model is a hand-written summary at the resolution of a whiteboard. Built with AI coding tools for this page.",
};

export default meta;
