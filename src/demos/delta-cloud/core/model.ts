/**
 * Delta Cloud — the diagram's data model.
 *
 * One environment of the Katalyxt platform (staging and production share the
 * architecture; production is the same shape with bigger sizes). Every box on
 * the map is a `CloudNode`, every arrow a `CloudEdge`, and a `Flow` is an
 * ordered walk over edges that the stage animates.
 *
 * Deliberately big-picture: no account ids, CIDRs, resource names, or secret
 * names — those live in the private Terraform this was drawn from.
 */

export type NodeGroup =
  | "outside"
  | "edge"
  | "public"
  | "app"
  | "gpu"
  | "data"
  | "account";

export interface CloudNode {
  id: string;
  /** Box title (one line). */
  label: string;
  /** Second line under the title: the AWS service or a two-word role. */
  sub?: string;
  group: NodeGroup;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Detail card. `phrase` is the broad-strokes one-liner; `points` the specifics. */
  detail: {
    phrase: string;
    points: string[];
  };
}

export interface CloudEdge {
  id: string;
  from: string;
  to: string;
  /** Short verb on the arrow: "HTTPS", "submits jobs", ... */
  label?: string;
  /** Faint at rest; drawn in full only while a flow lights it. */
  quiet?: boolean;
  /** Dashed = out-of-band (schedules, deploys, cold starts). */
  dashed?: boolean;
  /** For edges between stacked boxes: how far the side elbow bulges out (px). */
  bulge?: number;
  /** Where along the edge the label sits, 0 (start) … 1 (end). Default 0.5. */
  labelAt?: number;
}

export interface FlowStep {
  edge: string;
  caption: string;
}

export interface Flow {
  id: string;
  title: string;
  blurb: string;
  steps: FlowStep[];
}

export interface Band {
  id: string;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Nested inside the VPC frame. */
  inVpc?: boolean;
}

export const VIEW = { w: 1000, h: 620 } as const;

export const VPC_FRAME = { x: 236, y: 22, w: 520, h: 580 } as const;

export const BANDS: Band[] = [
  { id: "outside", label: "People & partners", x: 16, y: 22, w: 200, h: 580 },
  { id: "public", label: "Public subnets · 2 AZs", x: 248, y: 50, w: 496, h: 84, inVpc: true },
  { id: "app", label: "App subnets · 3–4 AZs · Fargate", x: 248, y: 150, w: 496, h: 116, inVpc: true },
  { id: "gpu", label: "Compute planes · Batch + warm GPU", x: 248, y: 282, w: 496, h: 118, inVpc: true },
  { id: "data", label: "Data subnets · 2 AZs", x: 248, y: 430, w: 496, h: 100, inVpc: true },
  { id: "account", label: "Account & region services", x: 772, y: 22, w: 212, h: 580 },
];

export const NODES: CloudNode[] = [
  // ---- outside the VPC (left column) ----
  {
    id: "users",
    label: "Users & agents",
    sub: "browsers · API clients",
    group: "outside",
    x: 28, y: 52, w: 176, h: 52,
    detail: {
      phrase: "People and the AI agents working for them, arriving over HTTPS.",
      points: [
        "Two front doors: a web app and a JSON API, on separate hostnames per environment.",
        "Uploads never pass through the API servers — the browser is handed a short-lived signed URL and writes straight to object storage.",
        "Long jobs stream progress back over server-sent events with heartbeats, so the load balancer is tuned to keep those connections open.",
      ],
    },
  },
  {
    id: "auth0",
    label: "Identity provider",
    sub: "Auth0 · OIDC",
    group: "outside",
    x: 28, y: 124, w: 176, h: 48,
    detail: {
      phrase: "Login lives outside the platform; the API only ever validates tokens.",
      points: [
        "The web tier holds the OAuth client credentials; the API holds none — it verifies JWTs against the issuer's public keys.",
        "A compromised web callback handler therefore cannot read backend credentials.",
        "Tenant Actions on the identity tenant are themselves Terraform-managed and CI-applied.",
      ],
    },
  },
  {
    id: "connectors",
    label: "Customer systems",
    sub: "Salesforce · customer AWS",
    group: "outside",
    x: 28, y: 192, w: 176, h: 52,
    detail: {
      phrase: "Business knowledge is pulled from where customers already keep it.",
      points: [
        "The control plane assumes narrowly named roles inside a customer's own AWS account, gated by that customer's trust policy and a per-tenant external id.",
        "A Salesforce connector is authorized through an external client app the customer installs; its health has its own alarms.",
        "No wildcard grants: the role-name pattern is enforced in code as well as in IAM.",
      ],
    },
  },
  {
    id: "weights",
    label: "Model weights",
    sub: "Hugging Face · baked at build",
    group: "outside",
    x: 28, y: 264, w: 176, h: 48,
    detail: {
      phrase: "Models ship inside the compute image, not as a runtime download.",
      points: [
        "Weight bundles are pre-staged in a private bucket and baked into the GPU image at build time, so image builds never depend on a flaky download.",
        "The resulting image is tens of gigabytes — which is why the platform bothers with pre-baked machine images and a warm floor (see the GPU plane).",
        "A gated-model token is the compute engine's only external-service secret.",
      ],
    },
  },
  {
    id: "github",
    label: "GitHub Actions",
    sub: "OIDC → Terraform",
    group: "outside",
    x: 28, y: 340, w: 176, h: 52,
    detail: {
      phrase: "Everything on this map is declared in Terraform and applied from CI.",
      points: [
        "GitHub's OIDC provider is trusted directly; there are no long-lived cloud keys in the CI system.",
        "Staging auto-applies when the app repos push; production runs a reviewed plan, then a fresh re-plan and apply behind required reviewers.",
        "Each environment's deploy role carries a deny boundary that walls it off from the other environment's state, secrets, and data — even though both share one account.",
        "A separate, hand-applied bootstrap root owns the chicken-and-egg pieces: state buckets, the OIDC provider, container registries.",
      ],
    },
  },
  {
    id: "ci-runners",
    label: "Ephemeral CI runners",
    sub: "EC2 · SQS · DynamoDB lease",
    group: "outside",
    x: 28, y: 412, w: 176, h: 56,
    detail: {
      phrase: "Self-hosted build machines that exist only for the length of one job.",
      points: [
        "GitHub-hosted runners cannot hold the multi-stage GPU image build on disk, so a webhook enqueues each job and a scale-up function launches a right-sized EC2 instance for it.",
        "A DynamoDB lease is the hard concurrency cap; a sweeper reclaims instances that never reported back.",
        "The runner AMI is rebaked on a schedule with bounded retention, so a fresh instance already has the toolchain and a warm layer cache.",
        "Shell access is through Session Manager only — no SSH, no inbound ports.",
        "One persistent runner with a large disk and a warm layer cache remains for trusted builds, parked nightly by a schedule.",
      ],
    },
  },

  // ---- edge / public subnets ----
  {
    id: "waf",
    label: "Web application firewall",
    sub: "WAF · managed rule sets",
    group: "public",
    x: 262, y: 72, w: 150, h: 50,
    detail: {
      phrase: "A managed firewall in front of the public load balancer.",
      points: [
        "Attached to both public load balancers; AWS managed rule groups run mostly in observe mode with the IP-reputation list blocking, and a rule-set version alarm so a deprecated group does not silently expire.",
        "TLS terminates just behind it on a DNS-validated certificate that covers each environment's app and API hostnames.",
        "Port 80 exists only to redirect to 443.",
      ],
    },
  },
  {
    id: "alb",
    label: "Public load balancers",
    sub: "ALB · HTTPS · two of them",
    group: "public",
    x: 428, y: 72, w: 150, h: 50,
    detail: {
      phrase: "The only things on the map with a public IP that answer requests.",
      points: [
        "Two of them: the web hostname fronts the web tier, the API hostname fronts the control plane; health checks gate every rolling deploy.",
        "Its idle timeout is deliberately longer than the platform's slowest synchronous call, so a slow request gets a typed error from the app rather than a bare gateway timeout.",
        "Two more, internal ones, carry control-plane ↔ compute-engine traffic so it never leaves the VPC (the box to the right).",
      ],
    },
  },
  {
    id: "nat",
    label: "NAT gateway",
    sub: "outbound only",
    group: "public",
    x: 594, y: 72, w: 138, h: 50,
    detail: {
      phrase: "The one path from private subnets to the internet, and it is mostly bypassed.",
      points: [
        "Private tasks reach identity, customer systems, and package sources through it.",
        "Container pulls, secret reads, logs, KMS and STS go through VPC endpoints instead — the GPU image alone is tens of gigabytes per pull, and paying NAT data-processing on every placement was the original bill shock.",
      ],
    },
  },

  // ---- app subnets ----
  {
    id: "web",
    label: "Web app",
    sub: "Fargate service",
    group: "app",
    x: 262, y: 178, w: 118, h: 68,
    detail: {
      phrase: "A stateless web front end on serverless containers.",
      points: [
        "Runs on Fargate behind the public load balancer with its own execution role and a minimal task role — no object storage, no secrets beyond its identity-provider client.",
        "Deployed by re-tagging the task definition and waiting for the service to reach steady state, then a health check.",
      ],
    },
  },
  {
    id: "delta",
    label: "DELTA control plane",
    sub: "Fargate service · autoscaled",
    group: "app",
    x: 396, y: 178, w: 168, h: 68,
    detail: {
      phrase: "Agent-orchestrated platform: the one service that owns state, tenants, and every credential.",
      points: [
        "Serverless containers on Fargate with CPU-target autoscaling; production runs more and larger tasks than staging, but the same shape.",
        "It is the only tier allowed to talk to the database and cache, the only tier with object-storage permissions, and the only one that can assume customer connector roles.",
        "It hands the compute engine short-lived signed URLs per request instead of storage credentials, and receives the engine's progress webhooks over an HMAC-signed, VPC-internal hop.",
        "Its agents call Claude on Bedrock through a private VPC endpoint; the task role is scoped to the exact models it may invoke.",
        "Schema migrations and the row-level-security role bootstrap run as one-off ECS tasks from the same image.",
        "Runtime secrets are injected at task start from the secrets manager; nothing is baked into images or logged.",
      ],
    },
  },
  {
    id: "internal-alb",
    label: "Internal LBs",
    sub: "VPC-only hops",
    group: "app",
    x: 616, y: 178, w: 116, h: 68,
    detail: {
      phrase: "Two private load balancers keep control plane and compute engine talking without leaving the VPC.",
      points: [
        "One fronts the compute engine's synchronous search service; only the control plane's security group may reach it.",
        "The other fronts the control plane for the engine's callbacks — progress, completion, signed-URL requests — signed with a shared HMAC secret.",
        "Security groups are split per service, so the compute engine cannot reach the data tier at all.",
      ],
    },
  },

  // ---- GPU plane ----
  {
    id: "batch",
    label: "AWS Batch · GPU jobs",
    sub: "EC2 g6 · NVIDIA L4",
    group: "gpu",
    x: 262, y: 312, w: 164, h: 74,
    detail: {
      phrase: "Stateless compute engine, plane one: long, bursty ingest and refine work on GPU-optimized instances.",
      points: [
        "A managed Batch compute environment of GPU EC2 instances: one GPU per job, a warm floor of one instance so ingest skips the cold start, and a burst ceiling equal to the account's GPU quota.",
        "The instance type is pinned so a re-run on identical hardware replays byte-for-byte; the image refuses to boot without its determinism environment.",
        "Cold-start mitigation is layered: warm floor, a boot-time image pre-pull, and a pre-baked machine image from an Image Builder pipeline that a Lambda auto-adopts into Terraform when a new bake lands.",
        "Jobs hold no credentials — they get signed URLs from the control plane and report back through the internal load balancer; Batch's own success and failure events are reconciled through an EventBridge → SQS poller so nothing is lost if a webhook is.",
        "No Spot anywhere: the plane is pinned on-demand for determinism, and scales between a warm floor and a burst ceiling equal to the account's GPU quota.",
      ],
    },
  },
  {
    id: "cpu-batch",
    label: "AWS Batch · CPU jobs",
    sub: "Fargate · scale-to-zero",
    group: "gpu",
    x: 440, y: 312, w: 148, h: 74,
    detail: {
      phrase: "A serverless Batch plane for text and structured ingest that needs no GPU.",
      points: [
        "Fargate compute environment that scales to zero between jobs; same job contract as the GPU plane, minus the accelerator.",
        "Keeps cheap work off the expensive instances so the GPU floor is reserved for the models that need it.",
        "A third, source-preparation plane with its own separated IAM roles is declared but dark in both environments.",
      ],
    },
  },
  {
    id: "search",
    label: "Warm GPU search",
    sub: "ECS on EC2 · no cold start",
    group: "gpu",
    x: 602, y: 312, w: 130, h: 74,
    detail: {
      phrase: "Stateless compute engine, plane two: a warm GPU service for user-facing search, so a query never waits for a cold start.",
      points: [
        "A separate ECS service on its own EC2 capacity provider, registered on the internal load balancer — it shares no capacity with the Batch plane.",
        "Staging replaces the task in place on the same warm, image-cached instance; production keeps zero-downtime rolling deploys.",
        "Production keeps one instance warm around the clock; staging runs it only when a test needs it and parks it off-hours.",
      ],
    },
  },

  // ---- data subnets ----
  {
    id: "rds",
    label: "PostgreSQL",
    sub: "RDS · encrypted · backups",
    group: "data",
    x: 262, y: 454, w: 150, h: 62,
    detail: {
      phrase: "The system of record: one relational database per environment.",
      points: [
        "Managed PostgreSQL, encrypted at rest, daily backups, never publicly reachable; only the control plane's security group can open a connection.",
        "Production adds deletion protection and a final snapshot; every environment marks it prevent-destroy in Terraform.",
        "A connection-count alarm watches it; a nightly stop/start schedule is declared for staging but currently dark.",
      ],
    },
  },
  {
    id: "redis",
    label: "Redis",
    sub: "ElastiCache · TLS",
    group: "data",
    x: 428, y: 454, w: 150, h: 62,
    detail: {
      phrase: "Cache and coordination for the control plane.",
      points: [
        "Encrypted in transit and at rest with an auth token; reachable from the control plane only.",
        "Production runs two nodes with automatic failover across zones; staging runs one.",
      ],
    },
  },
  {
    id: "s3",
    label: "Object storage",
    sub: "S3 · three private buckets",
    group: "data",
    x: 594, y: 454, w: 138, h: 62,
    detail: {
      phrase: "Three private buckets, reached through a gateway endpoint, never a public URL.",
      points: [
        "Uploads, artifacts, and intermediates are logically separate buckets: versioned, encrypted, public access blocked, prevent-destroy.",
        "Browsers write and read them only through short-lived presigned URLs minted by the control plane, with server-side checksum verification on completion.",
        "CORS origins are concrete per environment, never a wildcard.",
      ],
    },
  },

  // ---- account & region services (right column) ----
  {
    id: "endpoints",
    label: "VPC endpoints",
    sub: "ECR · Secrets · Logs · KMS · Bedrock · S3",
    group: "account",
    x: 784, y: 232, w: 188, h: 50,
    detail: {
      phrase: "Private doors to AWS services so the busiest traffic never crosses the NAT.",
      points: [
        "Interface endpoints for the container registry, secrets manager, logs, KMS, STS and Bedrock, plus a gateway endpoint for object storage.",
        "Turned on in both environments after the first GPU image pulls made the NAT bill visible.",
        "The CI runner's security group is appended to the endpoint ingress so image builds also reach the registry privately.",
      ],
    },
  },
  {
    id: "ecr",
    label: "Container registry",
    sub: "ECR · immutable tags",
    group: "account",
    x: 784, y: 108, w: 188, h: 50,
    detail: {
      phrase: "Shared across environments; images are pushed once and promoted by tag.",
      points: [
        "Scan-on-push, immutable tags, prevent-destroy.",
        "Pushes come from per-source-repo OIDC roles scoped to a single repository; pulls use each service's execution role.",
        "Deploys resolve the other services' currently running tags so a single-service release never clobbers the rest.",
      ],
    },
  },
  {
    id: "secrets",
    label: "Secrets Manager",
    sub: "per-env namespace",
    group: "account",
    x: 784, y: 170, w: 188, h: 50,
    detail: {
      phrase: "Every runtime secret has one home and is injected at container start.",
      points: [
        "Database URL, cache token, identity-provider credentials, and the two shared secrets that let control plane and compute engine trust each other's messages.",
        "Namespaced per environment; production keeps a 30-day recovery window.",
        "Secrets that rotate outside Terraform are marked ignore-changes so an apply never overwrites a live rotation.",
      ],
    },
  },
  {
    id: "bedrock",
    label: "LLM inference",
    sub: "Bedrock · Claude",
    group: "account",
    x: 784, y: 46, w: 188, h: 50,
    detail: {
      phrase: "The models behind the agents are managed inference, reached privately.",
      points: [
        "The control plane's agents invoke Claude on Bedrock; the task role may call only the listed inference profiles and foundation models.",
        "Calls stay on the AWS backbone through a Bedrock VPC endpoint rather than crossing the NAT.",
        "The same service powers the security triage classifier in the audit root, and trace data goes to an LLM-observability service in staging.",
      ],
    },
  },
  {
    id: "observability",
    label: "Observability",
    sub: "CloudWatch · SNS · digest",
    group: "account",
    x: 784, y: 294, w: 188, h: 50,
    detail: {
      phrase: "Dashboards and alarms, with a digest so alerts arrive as one message, not forty.",
      points: [
        "Container Insights on the cluster; per-service dashboards; alarms on the database connection count, the Batch queue depth, the search service, the catalog head, and the connector.",
        "Alarms fan into critical and notice SNS topics; a weekly digest Lambda rolls the notices up so people read one message, not forty.",
        "Log groups carry data-protection policies that mask credentials, and a scheduled purge task bounds retention so observability does not become the storage bill.",
      ],
    },
  },
  {
    id: "schedules",
    label: "Schedules & Lambdas",
    sub: "EventBridge · off-hours",
    group: "account",
    x: 784, y: 356, w: 188, h: 50,
    detail: {
      phrase: "Small schedules and functions that turn expensive things off and keep launch settings honest.",
      points: [
        "EventBridge schedules scale the staging control plane and web tier to zero overnight, park the GPU search service, stop the Batch warm floor on weekends, and pre-warm it before a known busy window.",
        "A launch-template guard blocks unauthorized launch-template versions on the GPU plane and a sweeper cleans up after it.",
        "An AMI auto-adopt function opens a deploy when a fresh GPU image bake lands; a retention function prunes superseded images; a queue probe publishes Batch queue age as a metric.",
      ],
    },
  },
  {
    id: "audit",
    label: "Security & audit",
    sub: "CloudTrail · GuardDuty · Config",
    group: "account",
    x: 784, y: 418, w: 188, h: 50,
    detail: {
      phrase: "Account-wide detection and posture, applied from its own Terraform root.",
      points: [
        "A multi-region CloudTrail; GuardDuty findings pass through a triage Lambda — a Claude classifier on Bedrock — before they page anyone; Security Hub aggregates CIS and AWS foundational standards; AWS Config enforces required tags; Access Analyzer watches for unused access.",
        "Controls are duplicated across two regions, and an account-wide monthly budget caps the bill.",
        "An IAM password policy and the rule that the account root user is never used day to day round it out.",
      ],
    },
  },
  {
    id: "terraform-state",
    label: "Terraform state",
    sub: "S3 · versioned · locked",
    group: "account",
    x: 784, y: 480, w: 188, h: 50,
    detail: {
      phrase: "One encrypted, versioned state bucket and key per environment, with native locking.",
      points: [
        "Separate state per environment and per root (audit, CI runners, bootstrap), so a bad apply in one cannot reach into another.",
        "The production plan is never uploaded as a CI artifact, because a saved plan carries secrets.",
      ],
    },
  },
  {
    id: "email",
    label: "Transactional email",
    sub: "SES",
    group: "account",
    x: 784, y: 542, w: 188, h: 50,
    detail: {
      phrase: "Invites and notifications go out through SES on a verified sending domain.",
      points: ["Sending identities are Terraform-managed alongside everything else on this map."],
    },
  },
];

export const EDGES: CloudEdge[] = [
  { id: "users-waf", from: "users", to: "waf", label: "HTTPS" },
  { id: "waf-alb", from: "waf", to: "alb" },
  { id: "alb-web", from: "alb", to: "web", label: "app host" },
  { id: "alb-delta", from: "alb", to: "delta", label: "API host" },
  { id: "auth0-delta", from: "auth0", to: "delta", label: "JWT verify", quiet: true },
  { id: "delta-connectors", from: "delta", to: "connectors", label: "assume role", quiet: true },
  { id: "delta-internal", from: "delta", to: "internal-alb", label: "search" },
  { id: "internal-search", from: "internal-alb", to: "search" },
  { id: "delta-batch", from: "delta", to: "batch", label: "submits jobs", labelAt: 0.3 },
  { id: "batch-internal", from: "batch", to: "internal-alb", label: "signed webhooks", labelAt: 0.72 },
  { id: "internal-delta", from: "internal-alb", to: "delta", label: "callbacks", quiet: true },
  { id: "delta-rds", from: "delta", to: "rds" },
  { id: "delta-redis", from: "delta", to: "redis" },
  { id: "delta-s3", from: "delta", to: "s3", label: "presigns", labelAt: 0.82 },
  { id: "users-s3", from: "users", to: "s3", label: "direct upload", quiet: true, labelAt: 0.62 },
  { id: "batch-s3", from: "batch", to: "s3", label: "signed URLs only", quiet: true },
  { id: "nat-out", from: "nat", to: "auth0", label: "egress", quiet: true, dashed: true },
  { id: "vpc-endpoints", from: "internal-alb", to: "endpoints", label: "private", quiet: true },
  { id: "endpoints-ecr", from: "endpoints", to: "ecr", quiet: true, bulge: 26 },
  { id: "endpoints-secrets", from: "endpoints", to: "secrets", quiet: true },
  { id: "weights-ecr", from: "weights", to: "ecr", label: "baked in", quiet: true, dashed: true },
  { id: "github-state", from: "github", to: "terraform-state", label: "plan · apply", quiet: true, dashed: true },
  { id: "github-ecr", from: "github", to: "ecr", label: "push", quiet: true, dashed: true },
  { id: "runners-ecr", from: "ci-runners", to: "ecr", label: "build", quiet: true, dashed: true },
  { id: "schedules-batch", from: "schedules", to: "batch", label: "weekends", quiet: true, dashed: true },
  { id: "schedules-search", from: "schedules", to: "search", label: "off-hours", quiet: true, dashed: true },
  { id: "delta-bedrock", from: "delta", to: "bedrock", label: "invokes Claude", labelAt: 0.62 },
  { id: "delta-cpu-batch", from: "delta", to: "cpu-batch", label: "text ingest", quiet: true, labelAt: 0.65 },
  { id: "observability-delta", from: "delta", to: "observability", label: "metrics · logs", quiet: true },
];

export const FLOWS: Flow[] = [
  {
    id: "query",
    title: "Trace a query",
    blurb: "A user asks a question; the answer needs a GPU, but nothing on the GPU ever sees a credential.",
    steps: [
      { edge: "users-waf", caption: "The request arrives over HTTPS and passes the managed firewall." },
      { edge: "waf-alb", caption: "TLS terminates on the public load balancer." },
      { edge: "alb-delta", caption: "The API hostname routes to the control plane, which verifies the caller's JWT." },
      { edge: "delta-rds", caption: "The control plane resolves the tenant and its permitted datasets from PostgreSQL." },
      { edge: "delta-internal", caption: "It calls the compute engine through the VPC-only internal load balancer." },
      { edge: "internal-search", caption: "The warm GPU search service answers immediately — no cold start on a query." },
      { edge: "delta-bedrock", caption: "The agent reasons over the results with Claude on Bedrock, through a private endpoint." },
      { edge: "delta-redis", caption: "Results are cached and the response streams back to the user." },
    ],
  },
  {
    id: "ingest",
    title: "Trace an ingest",
    blurb: "A customer adds a document; it is refined on a GPU that scaled up for the job and can scale back to zero.",
    steps: [
      { edge: "delta-s3", caption: "The control plane mints a short-lived presigned upload URL." },
      { edge: "users-s3", caption: "The browser writes the file straight to the uploads bucket; the API never proxies bytes." },
      { edge: "delta-batch", caption: "A Batch job is submitted; the warm floor picks it up, or a burst instance boots from the pre-baked GPU image." },
      { edge: "batch-s3", caption: "The job reads and writes only through signed URLs handed to it per request." },
      { edge: "batch-internal", caption: "Progress and completion webhooks travel back over the internal load balancer, HMAC-signed." },
      { edge: "internal-delta", caption: "The control plane records the outcome and streams progress to the user." },
      { edge: "delta-rds", caption: "The new artifact becomes part of the tenant's catalog." },
    ],
  },
  {
    id: "deploy",
    title: "Trace a deploy",
    blurb: "How a change reaches the map: no human holds a cloud key.",
    steps: [
      { edge: "runners-ecr", caption: "An ephemeral EC2 runner builds the multi-gigabyte compute image and pushes it to the registry." },
      { edge: "github-ecr", caption: "The app CI pushes the control-plane and web images under immutable tags." },
      { edge: "github-state", caption: "GitHub assumes the environment's role over OIDC; Terraform plans against the locked state bucket, then applies." },
      { edge: "endpoints-ecr", caption: "Each ECS service rolls to the new task definition, pulling images privately through the VPC endpoint." },
      { edge: "endpoints-secrets", caption: "Secrets are injected at task start; the deploy waits for steady state and a health check before it reports success." },
    ],
  },
];

export const GROUP_LABEL: Record<NodeGroup, string> = {
  outside: "Outside the VPC",
  edge: "Edge",
  public: "Public subnets",
  app: "App subnets · Fargate",
  gpu: "GPU compute plane",
  data: "Data subnets",
  account: "Account & region",
};

export function nodeById(id: string): CloudNode {
  const n = NODES.find((x) => x.id === id);
  if (!n) throw new Error(`unknown node ${id}`);
  return n;
}

export function edgeById(id: string): CloudEdge {
  const e = EDGES.find((x) => x.id === id);
  if (!e) throw new Error(`unknown edge ${id}`);
  return e;
}
