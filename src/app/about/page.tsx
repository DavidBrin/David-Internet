/**
 * About David, content team owns this file.
 * Bio distilled from the résumé (db_resume_2026.pdf; the chronology is mirrored
 * in docs/superpowers/specs Appendix A) and from the story copy in
 * content/path/journey.ts. The same text is indexed as the "about" SearchDoc in
 * src/lib/content.server.ts (ABOUT_BODY); keep them in step.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { WIKIPEDIA_BASE_URL } from "@/lib/wiki";
import { demos } from "@/lib/demos";
import "./about.css";

export const metadata: Metadata = {
  title: "About David",
  description:
    "David Brin, co-founder of Katalyxt AI and computer engineer in San Diego. The person behind David's Internet.",
};

const GITHUB_URL = "https://github.com/DavidBrin";
const KATALYXT_URL = "https://katalyxt.ai";

const SKILLS = [
  "Python",
  "C / C++",
  "Java",
  "TypeScript",
  "MATLAB",
  "Verilog / VHDL",
  "LangChain",
  "LLM agents & orchestration",
  "Context / memory systems",
  "n8n",
  "PyTorch",
  "Deep learning",
  "Computer vision",
  "Embedded systems",
  "AWS",
  "Azure",
  "Linux",
  "Git / Bitbucket",
  "IAM / Auth0",
  "Claude, Codex & Cursor",
  "ROS 2",
  "MQTT",
  "Altium",
];

export default function AboutPage() {
  return (
    <main className="aboutPage">
      <div className="aboutBar">
        <div className="aboutBarInner">
          <span>about.davids.net</span>
          <span>
            <Link href="/">David&apos;s Internet</Link> ·{" "}
            <a href={WIKIPEDIA_BASE_URL} target="_blank" rel="noopener noreferrer">
              Wikipedia
            </a>
          </span>
        </div>
      </div>

      <div className="aboutMain">
        <header className="aboutHeader">
          <p className="aboutCrumb">👤 about.davids.net</p>
          <h1 className="aboutName">David Brin</h1>
          <p className="aboutRole">
            Co-founder, Katalyxt AI · San Diego, California
          </p>
          <p className="aboutLinks">
            <a href="mailto:david.e.brin@gmail.com">david.e.brin@gmail.com</a>
            <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer">
              github.com/DavidBrin
            </a>
            <a href={KATALYXT_URL} target="_blank" rel="noopener noreferrer">
              katalyxt.ai
            </a>
          </p>
        </header>

        <p className="aboutLede">
          David&apos;s Internet indexes his personal projects. Every result is something
          he built. Search for anything.
        </p>

        <section className="aboutSection">
          <h2 className="aboutSectionTitle">The short version</h2>
          <p>
            Computer engineer, currently building an AI company. The pattern started
            early and hasn&apos;t changed much: take the thing apart, find out how it
            actually works, then build one. That has meant robots, a garage band, PCBs
            for aircraft that had to fly, neural recordings, embedded C that ships to
            hardware, and now a platform that makes a company&apos;s own knowledge
            useful to a model.
          </p>
          <p>
            A sentence carved into a school desk still runs underneath all of it:{" "}
            <em>don&apos;t find your place in the world, make it</em>. The long version
            of that story is <Link href="/path">The Path</Link>, a river you scroll from
            the first robotics kit to now.
          </p>
        </section>

        <section className="aboutSection">
          <h2 className="aboutSectionTitle">Now</h2>
          <div className="aboutEntry">
            <div className="aboutEntryHead">
              <h3 className="aboutEntryTitle">
                Co-founder,{" "}
                <a href={KATALYXT_URL} target="_blank" rel="noopener noreferrer">
                  Katalyxt AI
                </a>
              </h3>
              <span className="aboutEntryMeta">Apr 2026 – present</span>
            </div>
            <p>
              An agent-orchestrated enterprise AI platform that turns fragmented business
              data and organizational context into reliable workflows. Raised a $200K
              pre-seed from NFX, KP Scout and Long Journey; generated $30K ARR in a
              one-month sprint and secured four industry design partners. Leads applied AI
              engineering: LangChain agent orchestration, LLM context and memory systems,
              workflow automation, DevOps, cloud infrastructure and security.
            </p>
          </div>
        </section>

        <section className="aboutSection">
          <h2 className="aboutSectionTitle">Education</h2>
          <div className="aboutEntry">
            <div className="aboutEntryHead">
              <h3 className="aboutEntryTitle">
                B.S. Computer Engineering, UC San Diego
              </h3>
              <span className="aboutEntryMeta">2026</span>
            </div>
            <p>
              Regents Scholar, 3.9 GPA. Coursework across machine learning, computer
              vision I and II, embedded systems, computer architecture, data structures
              and algorithms, circuits and systems, and signal analysis.
            </p>
          </div>
          <div className="aboutEntry">
            <div className="aboutEntryHead">
              <h3 className="aboutEntryTitle">
                Exchange semester, Technical University of Denmark (DTU)
              </h3>
              <span className="aboutEntryMeta">Fall 2025</span>
            </div>
            <p>
              Graduate coursework in Kongens Lyngby: Quantum Information, Databases,
              Computational Data Science and Deep Learning.
            </p>
          </div>
          <div className="aboutEntry">
            <div className="aboutEntryHead">
              <h3 className="aboutEntryTitle">Awards &amp; certifications</h3>
              <span className="aboutEntryMeta">2023 – 2026</span>
            </div>
            <p>
              Regents Scholarship (2023–2026) and a CRA Undergraduate Research Award
              (2025–2026). Microsoft Azure Fundamentals AZ-900 (Jul 2024) and Databricks
              Fundamentals (Aug 2026).
            </p>
          </div>
        </section>

        <section className="aboutSection">
          <h2 className="aboutSectionTitle">Previously</h2>
          <ul className="aboutList">
            <li>
              <strong>General Atomics</strong> (Jun 2025 – Jun 2026): electrical
              technologies intern — embedded firmware in C for a camera driver and
              control system, shipped through Git/Bitbucket feature branches and pull
              requests with Linux tooling and hardware validation; optical-controls
              experiments alongside optical scientists, and development boards
              configured for system testing and integration.
            </li>
            <li>
              <strong>Voytek Lab, UC San Diego</strong> (Apr 2024 – Jun 2025):
              undergraduate researcher building neural-data pipelines for patch-clamp
              action potentials and organoid multi-electrode-array field potentials, in
              MATLAB scripts and Python notebooks.
            </li>
            <li>
              <strong>Triton Unmanned Aerial Systems</strong> (Sep 2023 – Apr 2024):
              embedded-systems project team — PCB design in Altium Designer and
              mechanical / electrical design in AutoCAD for aircraft that had to
              actually fly.
            </li>
            <li>
              <strong>Berkeley Coding Academy</strong> (Jul – Aug 2022): cohort lead,
              teaching intro data science and machine learning in Python and Google
              Colab notebooks.
            </li>
          </ul>
        </section>

        <section className="aboutSection">
          <h2 className="aboutSectionTitle">Selected projects</h2>
          <ul className="aboutList">
            <li>
              <Link href="/demos/crossteach">Cross-teaching segmentation</Link> (Fall
              2025) — a U-Net and a ViT grading each other&apos;s pseudo-labels on 22
              labeled micro-CT slices. The demo runs the real checkpoints and curves.
            </li>
            <li>
              <Link href="/demos/nocturnal">Nocturnal Neuro</Link> (Winter 2024) — an
              EEG-based ML diagnostic-device concept for bipolar disorder, spanning
              hardware, signal processing and the technical pitch: reworked board,
              schematic and BOM, and a real recording with the DSP pipeline live.
            </li>
            <li>
              <Link href="/demos/hardhack">IEEE HardHacks 2026</Link> (Jan 2026) — a
              microcontroller-based embedded security system talking to a mobile app
              over MQTT, built in a weekend and rebuilt here as one connected
              simulation: house, firmware, MQTT, phone.
            </li>
            <li>
              <strong>Data Refinement Pipeline</strong> (Jan 2026) — a web-based
              refinery platform for organizing and improving data assets, built in a
              sprint in the run-up to founding Katalyxt.
            </li>
            <li>
              <Link href="/demos/organoids">Organoids on psychedelics</Link> and{" "}
              <Link href="/demos/spikes">Anatomy of a spike</Link> — the Voytek Lab work,
              replayed on real public recordings.
            </li>
            <li>
              <strong>Autonomous car</strong> (Spring 2025) — ROS 2 on Linux with
              onboard NVIDIA compute and a Roboflow vision stack. No interactive rebuild
              yet; it sits on <Link href="/path">The Path</Link> as an honest gap.
            </li>
          </ul>
          <p className="aboutNote">
            {demos.length} demos are playable in the browser —{" "}
            <Link href="/demos">see all the demos</Link>, or read the write-ups on{" "}
            <a href={WIKIPEDIA_BASE_URL} target="_blank" rel="noopener noreferrer">
              David&apos;s Wikipedia
            </a>
            .
          </p>
        </section>

        <section className="aboutSection">
          <h2 className="aboutSectionTitle">Skills</h2>
          <ul className="aboutChips">
            {SKILLS.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </section>

        <section className="aboutSection">
          <h2 className="aboutSectionTitle">Elsewhere</h2>
          <ul className="aboutList">
            <li>
              <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer">
                GitHub
              </a>{" "}
              — where the research code lives.
            </li>
            <li>
              <a href={KATALYXT_URL} target="_blank" rel="noopener noreferrer">
                katalyxt.ai
              </a>{" "}
              — the company.
            </li>
            <li>
              <Link href="/path">The Path</Link> — the same story as a river you scroll.
            </li>
            <li>
              <a href="mailto:david.e.brin@gmail.com">david.e.brin@gmail.com</a> — the
              fastest way to reach him.
            </li>
          </ul>
        </section>

        <footer className="aboutFooter">
          <p>
            Everything on David&apos;s Internet is a replica he built from scratch.{" "}
            <Link href="/">Back to search</Link>.{" "}
            <a href={WIKIPEDIA_BASE_URL} target="_blank" rel="noopener noreferrer">
              Visit Wikipedia
            </a>
          </p>
        </footer>
      </div>
    </main>
  );
}
