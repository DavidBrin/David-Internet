"use client";

/**
 * Delta Cloud demo stage.
 *
 * Sections (each an anchor the manifest deep-links to):
 *   #cloud-map        — the environment map + detail card + three animated flows
 *   #compute-planes   — Batch vs warm GPU search, drawn as the difference
 *   #two-environments — staging vs production, same shape, different sizes
 * Classes are prefixed `dc`. NEVER scroll the page from an animation.
 */
import { useEffect, useMemo, useState } from "react";
import CloudMap from "./CloudMap";
import ComputePlanes from "./ComputePlanes";
import { EDGES, FLOWS, GROUP_LABEL, NODES, edgeById, nodeById } from "./core/model";
import "./delta-cloud.css";

const STEP_MS = 1500;

const ENVIRONMENTS: { row: string; staging: string; production: string }[] = [
  { row: "Architecture", staging: "identical", production: "identical — the contract CI enforces" },
  { row: "App subnets", staging: "3 availability zones", production: "4 availability zones" },
  { row: "Control plane", staging: "one small Fargate task, autoscales to two", production: "larger tasks, autoscales 3 → 8" },
  { row: "Compute engine task", staging: "4 vCPU / 16 GiB", production: "8 vCPU / 32 GiB" },
  { row: "GPU Batch floor", staging: "scale-to-zero", production: "one warm GPU instance" },
  { row: "GPU search", staging: "off unless a test needs it", production: "one warm instance" },
  { row: "PostgreSQL", staging: "small, no deletion protection", production: "larger, deletion protection + final snapshot" },
  { row: "Redis", staging: "one node", production: "two nodes, automatic failover, multi-AZ" },
  { row: "Secret recovery window", staging: "7 days", production: "30 days" },
  { row: "Deploy", staging: "auto-apply on push", production: "reviewed plan → re-plan → apply, required reviewers" },
];

export default function Stage() {
  const [selected, setSelected] = useState<string | null>("delta");
  const [flowId, setFlowId] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);

  const flow = useMemo(() => FLOWS.find((f) => f.id === flowId) ?? null, [flowId]);

  useEffect(() => {
    if (!flow || !playing) return;
    if (step >= flow.steps.length - 1) {
      setPlaying(false);
      return;
    }
    const t = window.setTimeout(() => setStep((s) => s + 1), STEP_MS);
    return () => window.clearTimeout(t);
  }, [flow, playing, step]);

  function startFlow(id: string) {
    setSelected(null);
    setFlowId(id);
    setStep(0);
    setPlaying(true);
  }

  function stopFlow() {
    setFlowId(null);
    setStep(0);
    setPlaying(false);
  }

  const litEdges = flow ? flow.steps.slice(0, step + 1).map((s) => s.edge) : [];
  const activeEdge = flow ? flow.steps[step].edge : null;
  const node = selected ? nodeById(selected) : null;

  return (
    <div className="dcStage">
      <section id="cloud-map" className="demoPanel dcSection">
        <div className="demoPanelHead">
          <h2>One environment, end to end</h2>
          <p>Click any box for what it is and why it is there. Or trace a request through the map.</p>
        </div>

        <div className="dcFlowBar" role="group" aria-label="Trace a flow">
          {FLOWS.map((f) => (
            <button
              key={f.id}
              type="button"
              className={`demoBtn${flowId === f.id ? " isActive" : ""}`}
              onClick={() => startFlow(f.id)}
            >
              {f.title}
            </button>
          ))}
          {flow ? (
            <button type="button" className="demoBtn" onClick={stopFlow}>
              Clear
            </button>
          ) : null}
        </div>

        <div className="dcMapWrap">
          <CloudMap selected={selected} onSelect={setSelected} litEdges={litEdges} activeEdge={activeEdge} />
        </div>

        <div className="dcCard" aria-live="polite">
          {flow ? (
            <FlowCard
              title={flow.title}
              blurb={flow.blurb}
              steps={flow.steps.map((s) => s.caption)}
              step={step}
              playing={playing}
              onStep={(i) => {
                setPlaying(false);
                setStep(i);
              }}
              onReplay={() => {
                setStep(0);
                setPlaying(true);
              }}
            />
          ) : node ? (
            <NodeCard
              group={GROUP_LABEL[node.group]}
              label={node.label}
              sub={node.sub}
              phrase={node.detail.phrase}
              points={node.detail.points}
              links={EDGES.filter((e) => e.from === node.id || e.to === node.id).map((e) => {
                const other = e.from === node.id ? e.to : e.from;
                return { id: other, label: nodeById(other).label, verb: e.label, outbound: e.from === node.id };
              })}
              onJump={setSelected}
            />
          ) : (
            <p className="demoNote">
              {NODES.length} boxes, {EDGES.length} arrows. Solid arrows carry requests; dashed ones are out-of-band
              (deploys, schedules, bakes). Faint arrows light up when a flow uses them.
            </p>
          )}
        </div>
      </section>

      <section id="compute-planes" className="demoPanel dcSection">
        <div className="demoPanelHead">
          <h2>Two compute planes, split by workload shape</h2>
          <p>Same image, same GPU, two very different scaling contracts.</p>
        </div>
        <ComputePlanes />
      </section>

      <section id="two-environments" className="demoPanel dcSection">
        <div className="demoPanelHead">
          <h2>Two environments, one shape</h2>
          <p>Staging and production are the same Terraform root with different numbers in the wrapper.</p>
        </div>
        <table className="dcEnvTable">
          <thead>
            <tr>
              <th scope="col"> </th>
              <th scope="col">Staging</th>
              <th scope="col">Production</th>
            </tr>
          </thead>
          <tbody>
            {ENVIRONMENTS.map((r) => (
              <tr key={r.row}>
                <th scope="row">{r.row}</th>
                <td>{r.staging}</td>
                <td>{r.production}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="demoNote">
          Both live in one AWS account and one region. A per-environment deny boundary on the deploy role keeps a
          staging apply from touching production state, secrets, or data.
        </p>
      </section>
    </div>
  );
}

function NodeCard({
  group,
  label,
  sub,
  phrase,
  points,
  links,
  onJump,
}: {
  group: string;
  label: string;
  sub?: string;
  phrase: string;
  points: string[];
  links: { id: string; label: string; verb?: string; outbound: boolean }[];
  onJump: (id: string) => void;
}) {
  return (
    <div className="dcNodeCard">
      <div className="dcCardKicker">{group}</div>
      <h3 className="dcCardTitle">
        {label}
        {sub ? <span className="dcCardSub">{sub}</span> : null}
      </h3>
      <p className="dcCardPhrase">{phrase}</p>
      <ul className="dcCardPoints">
        {points.map((p, i) => (
          <li key={i}>{p}</li>
        ))}
      </ul>
      {links.length ? (
        <p className="dcCardLinks">
          <span>Talks to:</span>
          {links.map((l) => (
            <button key={`${l.id}-${l.outbound}`} type="button" className="dcLinkChip" onClick={() => onJump(l.id)}>
              {l.outbound ? "→" : "←"} {l.label}
              {l.verb ? <em> {l.verb}</em> : null}
            </button>
          ))}
        </p>
      ) : null}
    </div>
  );
}

function FlowCard({
  title,
  blurb,
  steps,
  step,
  playing,
  onStep,
  onReplay,
}: {
  title: string;
  blurb: string;
  steps: string[];
  step: number;
  playing: boolean;
  onStep: (i: number) => void;
  onReplay: () => void;
}) {
  return (
    <div className="dcFlowCard">
      <div className="dcCardKicker">{playing ? "Tracing…" : "Traced"}</div>
      <h3 className="dcCardTitle">{title}</h3>
      <p className="dcCardPhrase">{blurb}</p>
      <ol className="dcSteps">
        {steps.map((c, i) => (
          <li key={i} className={i === step ? "isCurrent" : i < step ? "isDone" : ""}>
            <button type="button" onClick={() => onStep(i)}>
              {c}
            </button>
          </li>
        ))}
      </ol>
      {!playing ? (
        <button type="button" className="demoBtn" onClick={onReplay}>
          Replay
        </button>
      ) : null}
    </div>
  );
}

/** Exported for tests: which edges a flow would light, in order. */
export function flowEdgeIds(flowId: string): string[] {
  const f = FLOWS.find((x) => x.id === flowId);
  if (!f) return [];
  return f.steps.map((s) => edgeById(s.edge).id);
}
