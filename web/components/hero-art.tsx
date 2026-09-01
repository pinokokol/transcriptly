"use client";

/**
 * Hero illustration: sources stream into the transcriptly tile, a timestamped
 * transcript writes itself out. The two URL pills cycle through platforms.
 * CSS keyframes live in globals.css (art-hero-*).
 */

const RED = "var(--play-red)";
const ICE = "var(--ice)";

type Glyph = "play" | "note" | "file" | "camera" | "x" | "f" | "bubble" | "reddit" | "bars";

const SLOTS: ReadonlyArray<{ y: number; variants: ReadonlyArray<{ label: string; glyph: Glyph }> }> = [
  {
    y: 52,
    variants: [
      { label: "youtube.com/watch?v=…", glyph: "play" },
      { label: "instagram.com/reel/…", glyph: "camera" },
      { label: "facebook.com/watch/…", glyph: "f" },
      { label: "twitch.tv/…/clip/…", glyph: "bubble" },
    ],
  },
  {
    y: 120,
    variants: [
      { label: "tiktok.com/@tiktok/…", glyph: "note" },
      { label: "x.com/…/status/…", glyph: "x" },
      { label: "reddit.com/r/videos/…", glyph: "reddit" },
      { label: "soundcloud.com/…", glyph: "bars" },
    ],
  },
  { y: 188, variants: [{ label: "interview.mp4", glyph: "file" }] },
];

const PATHS = [
  "M158 52 C184 52 184 120 206 120",
  "M158 120 H206",
  "M158 188 C184 188 184 120 206 120",
];

const ROWS = [
  { y: 84, time: "00:04", width: 44 },
  { y: 102, time: "00:12", width: 38 },
  { y: 120, time: "00:19", width: 46 },
  { y: 138, time: "00:27", width: 32 },
  { y: 156, time: "00:33", width: 42 },
];

/** Simple monochrome glyphs in a 12px box centred on (25, y). Not brand logos on purpose. */
function SourceGlyph({ glyph, y }: { glyph: Glyph; y: number }) {
  const line = { fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round", strokeLinejoin: "round" } as const;
  switch (glyph) {
    case "play":
      return <path d={`M21 ${y - 5} L30 ${y} L21 ${y + 5} Z`} fill={RED} />;
    case "note":
      return (
        <g {...line}>
          <path d={`M28 ${y - 6} v9`} />
          <circle cx="25" cy={y + 4} r="3" fill={ICE} />
          <path d={`M28 ${y - 6} q3 2 5 0`} />
        </g>
      );
    case "file":
      return (
        <g {...line}>
          <path d={`M20 ${y - 7} h7 l4 4 v10 h-11 z`} fill={ICE} fillOpacity="0.6" />
          <path d={`M27 ${y - 7} v4 h4`} />
        </g>
      );
    case "camera":
      return (
        <g {...line}>
          <rect x="19" y={y - 6} width="12" height="12" rx="3.5" />
          <circle cx="25" cy={y} r="2.75" />
          <circle cx="28.6" cy={y - 3.6} r="0.9" fill="currentColor" stroke="none" />
        </g>
      );
    case "x":
      return <path d={`M20 ${y - 5} L30 ${y + 5} M30 ${y - 5} L20 ${y + 5}`} {...line} strokeWidth={1.75} />;
    case "f":
      return (
        <text x="25" y={y + 4.5} textAnchor="middle" fontSize="13" fontWeight="700" fill="currentColor" className="font-mono">
          f
        </text>
      );
    case "bubble":
      return (
        <g {...line}>
          <path d={`M19 ${y - 6} h12 v9 h-5 l-3 3 v-3 h-4 z`} />
          <path d={`M24 ${y - 3} v3 M27.5 ${y - 3} v3`} />
        </g>
      );
    case "reddit":
      return (
        <text x="25" y={y + 3.5} textAnchor="middle" fontSize="9.5" fontWeight="700" fill="currentColor" className="font-mono">
          r/
        </text>
      );
    case "bars":
      return (
        <g fill="currentColor">
          {[4, 8, 12, 7, 10].map((h, i) => (
            <rect key={i} x={19 + i * 3} y={y - h / 2} width="1.75" height={h} rx="0.9" />
          ))}
        </g>
      );
  }
}

export function HeroArt() {
  return (
    <svg
      viewBox="0 0 380 240"
      role="img"
      aria-label="YouTube, TikTok, Instagram, X, and file sources flowing into transcriptly and out as a timestamped transcript"
      className="surface-art h-auto w-full text-foreground"
    >
      {/* sources */}
      {SLOTS.map((slot, s) => (
        <g key={slot.y}>
          <rect
            className="art-hero-source"
            x="8"
            y={slot.y - 16}
            width="150"
            height="32"
            rx="9"
            fill="var(--card)"
            stroke="currentColor"
            strokeOpacity="0.25"
            strokeWidth="1.25"
            style={{ animationDelay: `${s * 1.6}s` }}
          />
          <clipPath id={`hero-pill-${s}`}>
            <rect x="8" y={slot.y - 16} width="144" height="32" />
          </clipPath>
          {slot.variants.map((variant, v) => (
            <g
              key={variant.label}
              className={slot.variants.length > 1 ? "art-hero-slot" : undefined}
              style={slot.variants.length > 1 ? { animationDelay: `${v * 4.8}s` } : undefined}
            >
              <SourceGlyph glyph={variant.glyph} y={slot.y} />
              <text
                x="38"
                y={slot.y + 3.5}
                fontSize="8.5"
                fill="currentColor"
                fillOpacity="0.72"
                className="font-mono"
                clipPath={`url(#hero-pill-${s})`}
              >
                {variant.label}
              </text>
            </g>
          ))}
        </g>
      ))}

      {/* streams into the tile */}
      {PATHS.map((d, i) => (
        <g key={d}>
          <path className="art-mcp-link" d={d} fill="none" stroke="currentColor" strokeOpacity="0.22" strokeWidth="1.25" />
          <circle
            className="art-hero-dot"
            r="3.5"
            fill={ICE}
            stroke="currentColor"
            strokeOpacity="0.35"
            strokeWidth="1"
            style={{ offsetPath: `path("${d}")`, animationDelay: `${i * 1.6}s` }}
          />
        </g>
      ))}

      {/* the transcriptly tile: card on an ice offset, red play mark */}
      <g className="art-hero-tile">
        <rect x="216" y="100" width="56" height="56" rx="16" fill={ICE} />
        <rect x="208" y="92" width="56" height="56" rx="16" fill="var(--card)" stroke="currentColor" strokeOpacity="0.28" strokeWidth="1.25" />
        <path d="M228 108 L248 120 L228 132 Z" fill={RED} />
      </g>
      <circle className="art-hero-pulse" cx="236" cy="120" r="34" fill="none" stroke={RED} strokeWidth="1.25" />

      {/* out to the transcript */}
      <path className="art-mcp-link" d="M266 120 H288" fill="none" stroke="currentColor" strokeOpacity="0.22" strokeWidth="1.25" />
      <circle className="art-hero-out" r="3.5" fill={RED} />

      {/* transcript document */}
      <rect x="290" y="60" width="82" height="120" rx="10" fill="var(--card)" stroke="currentColor" strokeOpacity="0.25" strokeWidth="1.25" />
      <rect x="300" y="70" width="34" height="5" rx="2.5" fill="currentColor" fillOpacity="0.5" />
      {ROWS.map((row, i) => (
        <g key={row.time}>
          <text className="art-hero-row" x="300" y={row.y + 3} fontSize="6.5" fontWeight="700" fill={RED} style={{ animationDelay: `${i * 0.45}s` }}>
            {row.time}
          </text>
          <rect
            className="art-hero-line"
            x="322"
            y={row.y - 2.5}
            width={row.width}
            height="5"
            rx="2.5"
            fill={i % 2 === 0 ? "currentColor" : ICE}
            fillOpacity={i % 2 === 0 ? 0.28 : 1}
            style={{ animationDelay: `${i * 0.45}s` }}
          />
        </g>
      ))}
    </svg>
  );
}
