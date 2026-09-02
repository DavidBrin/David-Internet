/**
 * Manifest registry — content team owns this file.
 * Adding a new project to David's Internet = vendor its content into content/<project>/
 * (pnpm sync-content), write content/<project>/site.ts, and import it here.
 */
import type { SiteManifest } from "./types";

import linear from "@content/linear/site";
import youtube from "@content/youtube/site";
import superSmash from "@content/super-smash/site";
import fakePhone from "@content/fake-phone/site";
import bet from "@content/bet/site";
import dollarPixels from "@content/dollar-pixels/site";
import notion from "@content/notion/site";
import verilog from "@content/verilog/site";
import nocturnal from "@content/nocturnal/site";
import signals from "@content/signals/site";
import quantum from "@content/quantum/site";
import hardhack from "@content/hardhack/site";
import esp32 from "@content/esp32/site";
import organoids from "@content/organoids/site";
import spikes from "@content/spikes/site";
import vision from "@content/vision/site";
import arxiv from "@content/arxiv/site";
import crossteach from "@content/crossteach/site";
import p300 from "@content/p300/site";
import sql from "@content/sql/site";
import modeling from "@content/modeling/site";
import earlycode from "@content/earlycode/site";

export const manifests: SiteManifest[] = [
  linear,
  youtube,
  superSmash,
  fakePhone,
  bet,
  dollarPixels,
  notion,
  verilog,
  nocturnal,
  signals,
  quantum,
  hardhack,
  esp32,
  organoids,
  spikes,
  vision,
  arxiv,
  crossteach,
  p300,
  sql,
  modeling,
  earlycode,
];

export function getManifest(project: string): SiteManifest | undefined {
  return manifests.find((m) => m.project === project);
}
