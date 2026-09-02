"use client";

/**
 * SQL Playground demo stage.
 *
 * Panel contracts (each panel is self-contained: fetches its data from
 * /demos/sql/, owns its CSS file with its class prefix):
 *   schemas/SchemaPanel — #schemas section · prefix qS
 *   runner/QueryPanel   — #queries section · prefix qQ
 *   modify/ModifyPanel  — #modify section  · prefix qM
 * Shared classes (sql.css): sqSection sqPanel sqH2 sqIntro sqChip sqBtn
 * sqNote sqRow sqMono sqTableWrap. NEVER scroll the page from an animation.
 * sql.js loads once via src/demos/sql/core/engine.ts (shared singleton).
 */
import "./sql.css";
import SchemaPanel from "./schemas/SchemaPanel";
import QueryPanel from "./runner/QueryPanel";
import ModifyPanel from "./modify/ModifyPanel";

export default function Stage() {
  return (
    <div className="sqStage">
      <section id="schemas" className="sqSection">
        <SchemaPanel />
      </section>
      <section id="queries" className="sqSection">
        <QueryPanel />
      </section>
      <section id="modify" className="sqSection">
        <ModifyPanel />
      </section>
    </div>
  );
}
