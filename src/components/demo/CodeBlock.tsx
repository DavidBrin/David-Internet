/**
 * Build-time syntax highlighting with shiki. Server-only — the highlighter never ships
 * to the client; pages receive static HTML.
 */
import { codeToHtml } from "shiki";

const LANG_ALIASES: Record<string, string> = {
  sv: "system-verilog",
  systemverilog: "system-verilog",
  verilog: "verilog",
  ts: "typescript",
  py: "python",
  cpp: "cpp",
  java: "java",
  matlab: "matlab",
  json: "json",
  text: "text",
};

export async function highlight(code: string, lang: string): Promise<string> {
  const id = LANG_ALIASES[lang] ?? lang;
  try {
    return await codeToHtml(code, { lang: id, theme: "github-light" });
  } catch {
    return await codeToHtml(code, { lang: "text", theme: "github-light" });
  }
}

export default async function CodeBlock({ code, lang }: { code: string; lang: string }) {
  const html = await highlight(code, lang);
  return <div className="demoCode" dangerouslySetInnerHTML={{ __html: html }} />;
}
