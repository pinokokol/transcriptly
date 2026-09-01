"use client";

/**
 * Small looping illustrations for the four surfaces on the landing page.
 * Pure SVG driven by CSS keyframes in globals.css (transform and opacity only),
 * brand palette via tokens: currentColor for ink lines, --play-red, --ice.
 */

export type SurfaceKind = "cli" | "mcp" | "rest" | "webmcp";

const RED = "var(--play-red)";
const ICE = "var(--ice)";

function Frame({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <svg
      viewBox="0 0 320 96"
      preserveAspectRatio="xMinYMid meet"
      role="img"
      aria-label={label}
      className="surface-art h-24 w-full text-foreground"
    >
      {children}
    </svg>
  );
}

/** Window chrome shared by the terminal and the browser. */
function WindowChrome({ children }: { children?: React.ReactNode }) {
  return (
    <>
      <rect x="8" y="6" width="304" height="84" rx="10" fill="none" stroke="currentColor" strokeOpacity="0.18" strokeWidth="1.25" />
      <line x1="8" y1="24" x2="312" y2="24" stroke="currentColor" strokeOpacity="0.12" strokeWidth="1" />
      <circle cx="20" cy="15" r="2.5" fill={RED} />
      <circle cx="30" cy="15" r="2.5" fill="currentColor" fillOpacity="0.2" />
      <circle cx="40" cy="15" r="2.5" fill="currentColor" fillOpacity="0.2" />
      {children}
    </>
  );
}

function CliArt() {
  const bars = [10, 18, 24, 14, 22, 12, 18];
  return (
    <Frame label="Terminal typing a transcriptly command and printing a transcript">
      <WindowChrome />
      {/* prompt + typed command + cursor */}
      <path d="M22 39 l5 5 -5 5" fill="none" stroke={RED} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
      <rect className="art-cli-cmd" x="34" y="41" width="118" height="6" rx="3" fill="currentColor" fillOpacity="0.8" />
      <rect className="art-cli-cursor" x="156" y="38" width="6" height="12" rx="1" fill={RED} />
      {/* waveform: audio in */}
      {bars.map((h, i) => (
        <rect
          key={i}
          className="art-wave"
          x={214 + i * 10}
          y={44 - h / 2}
          width="4"
          height={h}
          rx="2"
          fill={i === 3 ? RED : ICE}
          style={{ animationDelay: `${i * 0.12}s` }}
        />
      ))}
      {/* transcript lines: text out */}
      <rect className="art-cli-line-1" x="34" y="59" width="164" height="5" rx="2.5" fill="currentColor" fillOpacity="0.22" />
      <rect className="art-cli-line-2" x="34" y="69" width="118" height="5" rx="2.5" fill="currentColor" fillOpacity="0.22" />
      <rect className="art-cli-line-3" x="34" y="79" width="142" height="5" rx="2.5" fill="currentColor" fillOpacity="0.22" />
    </Frame>
  );
}

const MCP_PATH = "M76 48 C120 48 140 26 160 26 S200 48 244 48";

function McpArt() {
  return (
    <Frame label="An agent exchanging requests and transcripts with transcriptly over MCP">
      {/* listening arcs */}
      <path className="art-ear" d="M22 40 a9 9 0 0 0 0 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" style={{ animationDelay: "0s" }} />
      <path className="art-ear" d="M16 35 a15 15 0 0 0 0 26" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" style={{ animationDelay: "0.25s" }} />
      <path className="art-ear" d="M10 30 a21 21 0 0 0 0 36" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" style={{ animationDelay: "0.5s" }} />
      {/* agent node */}
      <rect x="28" y="24" width="48" height="48" rx="14" fill={ICE} />
      <circle cx="45" cy="46" r="2.75" fill="var(--ink)" />
      <circle cx="59" cy="46" r="2.75" fill="var(--ink)" />
      <path d="M46 56 q6 4 12 0" fill="none" stroke="var(--ink)" strokeWidth="1.5" strokeLinecap="round" />
      {/* link */}
      <path className="art-mcp-link" d={MCP_PATH} fill="none" stroke="currentColor" strokeOpacity="0.28" strokeWidth="1.25" strokeLinecap="round" />
      <circle className="art-mcp-req" r="4" fill={RED} />
      <circle className="art-mcp-res" r="4" fill={ICE} stroke="currentColor" strokeOpacity="0.35" strokeWidth="1" />
      {/* transcriptly node */}
      <circle className="art-mcp-ring art-mcp-ring-right" cx="268" cy="48" r="20" fill="none" stroke={RED} strokeWidth="1.25" />
      <circle className="art-mcp-ring art-mcp-ring-left" cx="52" cy="48" r="20" fill="none" stroke={ICE} strokeWidth="1.5" />
      <rect x="244" y="24" width="48" height="48" rx="14" fill="none" stroke="currentColor" strokeOpacity="0.28" strokeWidth="1.25" />
      <path d="M261 39 L277 48 L261 57 Z" fill={RED} />
    </Frame>
  );
}

function RestArt() {
  return (
    <Frame label="A GET request travelling to the transcriptly API and a transcript coming back">
      {/* client chip */}
      <rect x="16" y="32" width="64" height="32" rx="8" fill="none" stroke="currentColor" strokeOpacity="0.28" strokeWidth="1.25" />
      <text x="48" y="52" textAnchor="middle" fontSize="11" fontWeight="700" letterSpacing="0.1em" fill={RED} className="font-mono">
        GET
      </text>
      <text className="art-rest-status font-mono" x="48" y="24" textAnchor="middle" fontSize="10" fontWeight="700" letterSpacing="0.08em" fill={RED}>
        200
      </text>
      {/* wire */}
      <line x1="80" y1="48" x2="240" y2="48" stroke="currentColor" strokeOpacity="0.16" strokeWidth="1.25" />
      {/* request packet */}
      <g transform="translate(84 44)">
        <rect className="art-rest-req" width="18" height="8" rx="4" fill={ICE} />
      </g>
      {/* response document */}
      <g transform="translate(222 38)">
        <g className="art-rest-res">
          <rect width="14" height="20" rx="2.5" fill="var(--card)" stroke="currentColor" strokeOpacity="0.4" strokeWidth="1.25" />
          <rect x="3.5" y="5" width="7" height="1.75" rx="0.9" fill="currentColor" fillOpacity="0.45" />
          <rect x="3.5" y="9" width="7" height="1.75" rx="0.9" fill="currentColor" fillOpacity="0.45" />
          <rect x="3.5" y="13" width="4.5" height="1.75" rx="0.9" fill="currentColor" fillOpacity="0.45" />
        </g>
      </g>
      {/* server rack */}
      {[26, 44, 62].map((y, i) => (
        <g key={y}>
          <rect x="240" y={y} width="64" height="14" rx="4" fill="none" stroke="currentColor" strokeOpacity="0.28" strokeWidth="1.25" />
          <circle className={i === 1 ? "art-rest-led" : undefined} cx="250" cy={y + 7} r="2" fill={i === 1 ? RED : ICE} />
          <rect x="258" y={y + 6} width="34" height="2" rx="1" fill="currentColor" fillOpacity="0.15" />
        </g>
      ))}
    </Frame>
  );
}

function WebMcpArt() {
  return (
    <Frame label="A browser agent clicking a transcriptly tool on the page and a transcript appearing">
      <WindowChrome>
        <rect x="52" y="10" width="110" height="10" rx="5" fill="currentColor" fillOpacity="0.07" />
      </WindowChrome>
      {/* page: heading placeholders */}
      <rect x="22" y="36" width="92" height="6" rx="3" fill="currentColor" fillOpacity="0.3" />
      {/* transcript lines written by the agent call */}
      <rect className="art-write-1" x="22" y="52" width="150" height="5" rx="2.5" fill={ICE} />
      <rect className="art-write-2" x="22" y="62" width="112" height="5" rx="2.5" fill={ICE} />
      <rect className="art-write-3" x="22" y="72" width="134" height="5" rx="2.5" fill={ICE} />
      {/* tool card */}
      <rect x="196" y="34" width="100" height="42" rx="8" fill={ICE} fillOpacity="0.35" />
      <rect className="art-card-flash" x="196" y="34" width="100" height="42" rx="8" fill="none" stroke={RED} strokeWidth="1.5" />
      <circle className="art-ping" cx="218" cy="55" r="9" fill="none" stroke={RED} strokeWidth="1.25" />
      <circle className="art-ping art-ping-late" cx="218" cy="55" r="9" fill="none" stroke={RED} strokeWidth="1.25" />
      <path d="M213 48 L224 55 L213 62 Z" fill={RED} />
      <rect x="234" y="48" width="48" height="4" rx="2" fill="currentColor" fillOpacity="0.4" />
      <rect x="234" y="57" width="30" height="4" rx="2" fill="currentColor" fillOpacity="0.25" />
      {/* the agent's pointer */}
      <g transform="translate(118 78)">
        <path
          className="art-pointer"
          d="M0 0 L0 12.5 L3.3 9.6 L5.6 14.6 L7.7 13.7 L5.4 8.8 L9.4 8.8 Z"
          fill="currentColor"
          stroke="var(--card)"
          strokeWidth="1"
          strokeLinejoin="round"
        />
      </g>
    </Frame>
  );
}

export function SurfaceArt({ kind }: { kind: SurfaceKind }) {
  switch (kind) {
    case "cli":
      return <CliArt />;
    case "mcp":
      return <McpArt />;
    case "rest":
      return <RestArt />;
    case "webmcp":
      return <WebMcpArt />;
  }
}
