"use client";

import { useEffect, useRef } from "react";

const STEP = 120;
const START = -720;
const END = 2160;
const CELL = 720;

type NodeDef = { sx: number; delay: number };

function smoothLine(cy: number, pattern: number[]): string {
  const pts: [number, number][] = [];
  for (let x = START, i = 0; x <= END; x += STEP, i++) {
    pts.push([x, cy + pattern[i % pattern.length]]);
  }
  let d = `M ${pts[0][0]} ${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C ${c1x} ${c1y} ${c2x} ${c2y} ${p2[0]} ${p2[1]}`;
  }
  return d;
}

const LINES: {
  cy: number;
  pattern: number[];
  dur: number;
  reverse: boolean;
  nodes: NodeDef[];
}[] = [
  { cy: 100, pattern: [0, -55, 25, -15, 45, -35], dur: 26, reverse: false, nodes: [{ sx: 2, delay: 0 }, { sx: 4, delay: 1.5 }] },
  { cy: 190, pattern: [30, -40, 60, -20, 10, -50], dur: 34, reverse: true,  nodes: [{ sx: 1, delay: 0.8 }] },
  { cy: 280, pattern: [-25, 50, -45, 20, -60, 35], dur: 22, reverse: false, nodes: [{ sx: 3, delay: 1.9 }] },
  { cy: 360, pattern: [40, -30, 15, -55, 30, -10], dur: 38, reverse: true,  nodes: [{ sx: 1, delay: 0.4 }, { sx: 5, delay: 2.3 }] },
  { cy: 450, pattern: [-50, 20, -35, 55, -15, 40], dur: 28, reverse: false, nodes: [{ sx: 2, delay: 1.2 }] },
  { cy: 520, pattern: [25, -60, 40, -25, 50, -45], dur: 32, reverse: true,  nodes: [{ sx: 4, delay: 0.6 }] },
];

export function AnimatedLines() {
  const layerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = layerRef.current;
    if (!el) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        el.style.transform = `translateY(${window.scrollY * 0.2}px)`;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div ref={layerRef} className="absolute inset-x-0 -top-1/2 h-[200%]">
        <svg
          className="h-full w-full"
          viewBox="0 0 1440 600"
          preserveAspectRatio="none"
          fill="none"
        >
          {LINES.map((l, i) => (
            <g
              key={i}
              className="vz-line"
              style={{
                animationDuration: `${l.dur}s`,
                animationDirection: l.reverse ? "reverse" : "normal",
              }}
            >
              <path
                d={smoothLine(l.cy, l.pattern)}
                stroke="white"
                strokeOpacity={0.12}
                strokeWidth={1.5}
              />
              {l.nodes.flatMap((n, ni) =>
                [0, 1, 2].map((cell) => (
                  <circle
                    key={`${ni}-${cell}`}
                    cx={n.sx * STEP + cell * CELL}
                    cy={l.cy + l.pattern[n.sx % l.pattern.length]}
                    r={3}
                    fill="#c8911f"
                    className="vz-node"
                    style={{ animationDelay: `${n.delay}s` }}
                  />
                ))
              )}
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
}
