import type { SiteManifest } from "@/lib/types";

const site: SiteManifest = {
  project: "fl-studio",
  displayName: "FL Studio",
  fakeDomain: "flstudio.davids.net",
  liveUrl: "https://fl-studio-david.vercel.app",
  tagline:
    "Program it, arrange it, hear it, save it: a browser rebuild of FL Studio's core sequencing loop.",
  description:
    "A browser rebuild of FL Studio's Channel Rack, Piano Roll, Playlist, Mixer, and transport. The step grid and the piano roll edit the same list of notes. Every sound is synthesized from oscillators, noise, and filters at runtime; no sample files and no Image-Line assets ship. Press Play to create the AudioContext. Save and reload a project in the browser. No keys, no database, nothing to configure.",
  accentColor: "#C48A3A",
  favicon: "🎹",
  techStack: [
    "Next.js 16",
    "React 19",
    "TypeScript",
    "Tone.js",
    "Zustand",
    "Tailwind CSS 4",
    "Web Audio API",
    "Vitest",
    "Playwright",
  ],
  needsDatabase: false,
  deepLinks: [
    {
      path: "/",
      title: "FL Studio: Channel Rack, Piano Roll, Playlist, Mixer",
      snippet:
        "A docked DAW layout: transport across the top, Playlist, Mixer, and a Channel Rack whose steps are notes of length zero.",
      keywords: [
        "fl studio",
        "channel rack",
        "piano roll",
        "playlist",
        "mixer",
        "browser daw",
        "step sequencer",
      ],
    },
  ],
  images: [
    {
      src: "/content/fl-studio/screenshots/app.png",
      caption: "The docked layout: transport, Playlist, Mixer, and Channel Rack",
      targetPath: "/",
    },
    {
      src: "/content/fl-studio/screenshots/channel-rack.png",
      caption: "Channel Rack: seven instrument rows and a 16-step grid",
      targetPath: "/",
    },
    {
      src: "/content/fl-studio/screenshots/piano-roll.png",
      caption: "Piano Roll: notes with velocity stems, editing the same list as the rack",
      targetPath: "/",
    },
    {
      src: "/content/fl-studio/screenshots/playlist.png",
      caption: "Playlist: pattern clips with live miniatures of the notes inside",
      targetPath: "/",
    },
    {
      src: "/content/fl-studio/screenshots/mixer.png",
      caption: "Mixer: Master plus eight insert strips with faders and peak meters",
      targetPath: "/",
    },
  ],
  videos: [],
  keywords: [
    "fl studio",
    "fl studio replica",
    "browser daw",
    "channel rack",
    "piano roll",
    "step sequencer",
    "tone.js",
    "playlist",
    "mixer",
    "synthesized drums",
  ],
  knowledgePanel: {
    type: "Web application",
    facts: {
      Category: "Browser DAW: Channel Rack, Piano Roll, Playlist, Mixer, transport",
      Sounds: "Synthesized at runtime from oscillators, noise, and filters. No sample files.",
      Persistence: "Save and reload a project in the browser. No database.",
      "Test suite": "1,256 unit tests and 15 Playwright end-to-end tests",
      Architecture:
        "The step grid and the piano roll edit the same list: a rack step is a note of length zero",
    },
  },
  docs: { readme: true, spec: true, decisions: true },
};

export default site;
