"use client";

import { useEffect } from "react";

/**
 * Client-side forward for the retired cached-docs pages. On Vercel the
 * vercel.json redirect fires first and this never renders; it covers local
 * dev and any host without redirect support.
 */
export default function RedirectToWiki({ url }: { url: string }) {
  useEffect(() => {
    window.location.replace(url);
  }, [url]);
  return null;
}
