// The dashboard's one UI scale for sizes set in JavaScript (owner, 2026-11-09). The CSS side is --ui-scale
// (components/mock-overview/mock.src.css, app/globals.css; scripts/ui-scale-css.mjs rewrites the stylesheets): 0.8 on
// laptop-sized windows (1024–1600px wide), 1.0 wider and below 1024px. No CSS zoom or transform.
//
//   scaled(n)      an inline style length that follows the scale with no re-render: "calc(14px * var(--ui-scale, 1))"
//   uiScale()      the scale now (a number), for one-off maths
//   useUiScale()   the scale as React state: re-renders when the window crosses 1024 / 1600px (layout that computes
//                  positions in pixels: Sentiment's bubbles and plots)
import { useEffect, useState } from "react";

export const LAPTOP_QUERY = "(min-width: 1024px) and (max-width: 1600px)";
export const LAPTOP_SCALE = 0.8;

export const scaled = (n) => `calc(${n}px * var(--ui-scale, 1))`;

export function uiScale() {
  if (typeof window === "undefined" || !window.matchMedia) return 1;
  return window.matchMedia(LAPTOP_QUERY).matches ? LAPTOP_SCALE : 1;
}

export function useUiScale() {
  const [s, setS] = useState(1);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return undefined;
    const mq = window.matchMedia(LAPTOP_QUERY);
    const on = () => setS(mq.matches ? LAPTOP_SCALE : 1);
    on();
    mq.addEventListener?.("change", on);
    return () => mq.removeEventListener?.("change", on);
  }, []);
  return s;
}
