/**
 * Batch vs warm search, drawn as the difference: the same image on the same GPU
 * class, but one plane scales between a floor and a ceiling on a queue while
 * the other is a fixed warm service on a load balancer.
 */
export default function ComputePlanes() {
  return (
    <figure className="dcFigure">
      <svg
        className="dcPlanes"
        viewBox="0 0 900 250"
        role="img"
        aria-label="Left: a job queue feeding AWS Batch, which scales GPU instances between a warm floor and a burst ceiling. Right: an internal load balancer feeding a single always-warm GPU search service. Neither plane shares capacity with the other."
      >
        <defs>
          <marker id="dcArrow2" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill="currentColor" />
          </marker>
        </defs>

        {/* ---- left: Batch ---- */}
        <text className="dcPlaneTitle" x={20} y={26}>
          Plane 1 · AWS Batch — async refine &amp; ingest
        </text>
        <rect className="dcPlaneBox" x={20} y={60} width={110} height={44} rx={6} />
        <text className="dcPlaneLabel" x={75} y={78} textAnchor="middle">
          job queue
        </text>
        <text className="dcPlaneSub" x={75} y={94} textAnchor="middle">
          from the control plane
        </text>
        <line className="dcPlaneEdge" x1={132} y1={82} x2={172} y2={82} markerEnd="url(#dcArrow2)" />

        {/* instances: one warm + ghosts up to the ceiling */}
        <rect className="dcGpu isWarm" x={176} y={58} width={54} height={48} rx={6} />
        <text className="dcPlaneSub" x={203} y={86} textAnchor="middle">
          warm
        </text>
        {[0, 1, 2, 3, 4].map((i) => (
          <rect key={i} className="dcGpu isGhost" x={238 + i * 40} y={58} width={34} height={48} rx={6} />
        ))}
        <text className="dcPlaneSub" x={176} y={126}>
          1 GPU per job · floor: 1 instance (prod), 0 (staging)
        </text>
        <text className="dcPlaneSub" x={176} y={142}>
          ceiling: the account&apos;s GPU quota
        </text>
        <line className="dcPlaneEdge isDashed" x1={176} y1={160} x2={430} y2={160} markerEnd="url(#dcArrow2)" />
        <text className="dcPlaneSub" x={303} y={176} textAnchor="middle">
          scales on queue depth · burst boots from a pre-baked AMI
        </text>
        <text className="dcPlaneSub" x={20} y={210}>
          long, queueable, bursty · pinned on-demand instance type · byte-identical replays
        </text>
        <text className="dcPlaneSub" x={20} y={228}>
          progress back to the control plane by HMAC-signed webhook
        </text>

        {/* divider */}
        <line className="dcDivider" x1={450} y1={20} x2={450} y2={236} />
        <text className="dcPlaneSub" x={450} y={130} textAnchor="middle" transform="rotate(-90 450 130)">
          no shared capacity
        </text>

        {/* ---- right: warm search ---- */}
        <text className="dcPlaneTitle" x={470} y={26}>
          Plane 2 · warm GPU service — synchronous search
        </text>
        <rect className="dcPlaneBox" x={470} y={60} width={120} height={44} rx={6} />
        <text className="dcPlaneLabel" x={530} y={78} textAnchor="middle">
          internal ALB
        </text>
        <text className="dcPlaneSub" x={530} y={94} textAnchor="middle">
          VPC-only, from DELTA
        </text>
        <line className="dcPlaneEdge" x1={592} y1={82} x2={632} y2={82} markerEnd="url(#dcArrow2)" />
        <text className="dcPlaneSub" x={612} y={74} textAnchor="middle">
          /search
        </text>
        <rect className="dcGpu isWarm" x={636} y={50} width={120} height={64} rx={6} />
        <text className="dcPlaneLabel" x={696} y={78} textAnchor="middle">
          ECS on EC2
        </text>
        <text className="dcPlaneSub" x={696} y={96} textAnchor="middle">
          same image, same GPU
        </text>
        <line className="dcPlaneEdge" x1={632} y1={96} x2={594} y2={96} markerEnd="url(#dcArrow2)" />
        <text className="dcPlaneSub" x={636} y={136}>
          always warm → a query never waits for a boot
        </text>
        <text className="dcPlaneSub" x={636} y={152}>
          no scale-from-zero: off means 503
        </text>
        <text className="dcPlaneSub" x={470} y={210}>
          user-facing, latency-sensitive · one task per instance
        </text>
        <text className="dcPlaneSub" x={470} y={228}>
          staging swaps the task in place; production rolls with zero downtime
        </text>
      </svg>
      <figcaption className="demoNote">
        Enabling the GPU plane replaced the original CPU-only Fargate compute service with both of these. A third,
        CPU Fargate Batch plane still handles ingest that needs no accelerator.
      </figcaption>
    </figure>
  );
}
