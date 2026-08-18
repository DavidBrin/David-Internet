/**
 * About David — content team owns this file.
 * Preliminary bio distilled from the résumé; the same text is indexed as the
 * "about" SearchDoc in src/lib/content.server.ts (ABOUT_BODY) — keep them in step.
 */
import type { Metadata } from "next";
import Link from "next/link";
import "./about.css";

// <!-- TODO(David): flesh out this bio and keep it in sync with the résumé -->

export const metadata: Metadata = {
  title: "About David",
  description:
    "David Brin — co-founder of Katalyxt AI, computer engineer in San Diego. The person behind David's Internet.",
};

const SKILLS = [
  "Python",
  "C / C++",
  "TypeScript",
  "PyTorch",
  "Computer vision",
  "Embedded systems",
  "Linux",
  "ROS 2",
  "Azure",
];

export default function AboutPage() {
  return (
    <main className="aboutPage">
      <div className="aboutBar">
        <div className="aboutBarInner">
          <span>about.davids.net</span>
          <Link href="/">David&apos;s Internet</Link>
        </div>
      </div>

      <div className="aboutMain">
        <header className="aboutHeader">
          <p className="aboutCrumb">👤 about.davids.net</p>
          <h1 className="aboutName">David Brin</h1>
          <p className="aboutRole">
            Co-founder, Katalyxt AI · San Diego, California
          </p>
          <p className="aboutContact">
            <a href="mailto:david.e.brin@gmail.com">david.e.brin@gmail.com</a>
          </p>
        </header>

        {/* Anchor target for the site-wide footer's "How this works" link. */}
        <p className="aboutLede" id="how-this-works">
          This whole site is a tour of David&apos;s personal projects, dressed up as a
          search engine. Every result below the fold is something he built — search for
          anything.
        </p>

        <section className="aboutSection">
          <h2 className="aboutSectionTitle">Now</h2>
          <div className="aboutEntry">
            <div className="aboutEntryHead">
              <h3 className="aboutEntryTitle">Co-founder — Katalyxt AI</h3>
              <span className="aboutEntryMeta">Apr 2026 – present</span>
            </div>
            <p>
              An enterprise AI platform that translates fragmented business data and
              organizational context into AI-accessible insight. Raised a $200K pre-seed
              from NFX, KP Scout and Long Journey; reached $30K ARR in a one-month sprint
              with four industry design partners. Leads product and engineering end to
              end — design, DevOps, cloud infrastructure, security, and the ML / LLM /
              memory systems underneath.
            </p>
          </div>
        </section>

        <section className="aboutSection">
          <h2 className="aboutSectionTitle">Education</h2>
          <div className="aboutEntry">
            <div className="aboutEntryHead">
              <h3 className="aboutEntryTitle">
                B.S. Computer Engineering — UC San Diego
              </h3>
              <span className="aboutEntryMeta">2026</span>
            </div>
            <p>
              Regents Scholar, 3.9 GPA. Exchange semester at DTU (Technical University of
              Denmark) covering Deep Learning, Quantum Information, Databases and
              Computational Data Science.
            </p>
          </div>
        </section>

        <section className="aboutSection">
          <h2 className="aboutSectionTitle">Previously</h2>
          <ul className="aboutList">
            <li>
              <strong>General Atomics</strong> — embedded firmware in C for a camera
              driver and control system.
            </li>
            <li>
              <strong>Voytek Lab, UC San Diego</strong> — neural-data pipelines for
              patch-clamp and multi-electrode-array recordings.
            </li>
            <li>
              <strong>Berkeley Coding Academy</strong> — cohort lead.
            </li>
          </ul>
        </section>

        <section className="aboutSection">
          <h2 className="aboutSectionTitle">Selected projects</h2>
          <ul className="aboutList">
            <li>
              Semi-supervised microtomography segmentation — a U-Net and ViT
              cross-teaching ensemble.
            </li>
            <li>An autonomous car on ROS 2 with onboard NVIDIA compute.</li>
            <li>An EEG-based bipolar-disorder diagnostic concept.</li>
            <li>Drone PCB design in Altium.</li>
          </ul>
        </section>

        <section className="aboutSection">
          <h2 className="aboutSectionTitle">Skills</h2>
          <ul className="aboutChips">
            {SKILLS.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </section>

        <footer className="aboutFooter">
          <p>
            Everything on David&apos;s Internet is a replica he built from scratch.{" "}
            <Link href="/">Back to search</Link>
          </p>
        </footer>
      </div>
    </main>
  );
}
