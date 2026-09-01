import type { Metadata } from "next";
import Link from "next/link";
import { CodeBlock } from "@/components/code-block";
import { Shell } from "@/components/shell";
import { SiteHeader } from "@/components/site-header";

const GITHUB_URL = "https://github.com/pinokokol/transcriptly";
const INLINE_LINK_CLASS_NAME =
  "text-foreground underline decoration-foreground/20 underline-offset-4 transition-colors hover:decoration-foreground/50";
const INLINE_CODE_CLASS_NAME = "font-mono text-[0.92em] text-foreground";

const QUICK_START = `npm install -g transcriptly
transcriptly setup
transcriptly https://youtu.be/dQw4w9WgXcQ`;

const CLI_HELP = `Usage: transcriptly <url-or-file> [options]
       transcriptly setup
       transcriptly mcp

Transcribe video and audio from a URL or local file.

Options:
  -f, --format <md|txt|json|srt>  Output format (default: md)
  -o, --output <file>             Write transcript to a file
      --mode <asr|captions>       Transcription mode (default: asr)
      --model <name>              Local Whisper model name or path
      --lang <code>               Spoken or caption language
      --engine <local|groq>       ASR engine (default: local)
  -y, --yes                       Download --model without prompting
      --version                   Print version
  -h, --help                      Show help

Commands:
  setup  Check dependencies and choose a local model
  mcp    Start the stdio MCP server`;

const LIBRARY_EXAMPLE = `import { transcribe, formatTranscript } from "transcriptly";

const transcript = await transcribe("https://youtu.be/dQw4w9WgXcQ");
console.log(transcript.text);
console.log(formatTranscript(transcript, "srt"));`;

const DOC_SECTIONS = [
  ["quick-start", "Quick start"],
  ["models", "Models"],
  ["cli", "CLI"],
  ["library", "Library"],
  ["mcp", "MCP"],
  ["api", "API"],
  ["webmcp", "WebMCP"],
] as const;

export const metadata: Metadata = {
  title: "docs - transcriptly",
  description:
    "Paste a video URL or drop a file, get a clean transcript. Open source: CLI, MCP server, REST API, and WebMCP tools agents can call right on this page.",
};

export default function DocsPage() {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 sm:px-6">
      <SiteHeader current="docs" />

      <div className="min-w-0 max-w-3xl pt-12 pb-20 sm:pt-16 sm:pb-28">
        <header className="animate-fade-up">
          <h1 className="text-4xl font-bold tracking-tighter sm:text-5xl">Documentation</h1>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground sm:text-lg">
            Install transcriptly, choose how it runs, and turn any supported video URL or media file into a clean
            transcript.
          </p>
          <nav aria-label="Documentation sections" className="mt-8 flex flex-wrap gap-2">
            {DOC_SECTIONS.map(([id, label]) => (
              <Link
                key={id}
                href={`#${id}`}
                className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:border-foreground/25 hover:text-foreground active:scale-[0.98]"
              >
                {label}
              </Link>
            ))}
          </nav>
        </header>

        <div className="mt-14 space-y-14 sm:mt-16 sm:space-y-16">
          <section id="quick-start" className="scroll-mt-8 border-t border-border pt-12">
            <h2 className="text-2xl font-bold tracking-tight">Quick start</h2>
            <p className="mt-4 leading-relaxed text-muted-foreground">
              Transcriptly supports platform URLs handled by{" "}
              <a href="https://github.com/yt-dlp/yt-dlp" className={INLINE_LINK_CLASS_NAME}>
                yt-dlp
              </a>
              , direct media URLs, and local video or audio files.
            </p>
            <CodeBlock code={QUICK_START} className="mt-5" />
            <p className="mt-4 leading-relaxed text-muted-foreground">
              <code className={INLINE_CODE_CLASS_NAME}>transcriptly setup</code> checks your tools and lets you choose a
              Whisper model with arrow keys. For one-off use without installing, run{" "}
              <code className={INLINE_CODE_CLASS_NAME}>npx -y transcriptly &lt;url&gt;</code>.
            </p>

            <h3 className="mt-8 text-lg font-semibold tracking-tight">Requirements</h3>
            <ul className="mt-4 list-disc space-y-2 pl-5 leading-relaxed text-muted-foreground marker:text-foreground/40">
              <li>
                <strong className="font-medium text-foreground">Node 20 or newer</strong>, npm, pnpm, yarn, and bun all
                work.
              </li>
              <li>
                <code className={INLINE_CODE_CLASS_NAME}>ffmpeg</code> for audio extraction.
              </li>
              <li>
                <code className={INLINE_CODE_CLASS_NAME}>yt-dlp</code> for URL sources. It is not needed for local files.
              </li>
              <li>
                <code className={INLINE_CODE_CLASS_NAME}>whisper-cli</code> for local transcription, install it with{" "}
                <code className={INLINE_CODE_CLASS_NAME}>brew install whisper-cpp</code>, or use a{" "}
                <a href="https://console.groq.com" className={INLINE_LINK_CLASS_NAME}>
                  Groq
                </a>{" "}
                API key instead.
              </li>
            </ul>
            <p className="mt-4 leading-relaxed text-muted-foreground">
              The setup command tells you exactly what is missing and how to install it.
            </p>
          </section>

          <section id="models" className="scroll-mt-8 border-t border-border pt-12">
            <h2 className="text-2xl font-bold tracking-tight">Models</h2>
            <p className="mt-4 leading-relaxed text-muted-foreground">
              Local Whisper models are downloaded once to{" "}
              <code className={INLINE_CODE_CLASS_NAME}>~/.cache/transcriptly/models</code>.
            </p>
            <Shell className="mt-5 min-w-0 max-w-full overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[36rem] border-collapse text-left">
                  <thead>
                    <tr className="border-b border-border">
                      <th scope="col" className="px-4 py-3 text-sm font-medium text-foreground">
                        Model
                      </th>
                      <th scope="col" className="px-4 py-3 text-sm font-medium text-foreground">
                        Size
                      </th>
                      <th scope="col" className="px-4 py-3 text-sm font-medium text-foreground">
                        Tradeoff
                      </th>
                    </tr>
                  </thead>
                  <tbody className="text-muted-foreground">
                    <tr className="border-b border-border">
                      <td className="px-4 py-3 text-sm">
                        <code className={INLINE_CODE_CLASS_NAME}>small</code>
                      </td>
                      <td className="px-4 py-3 text-sm">466 MB</td>
                      <td className="px-4 py-3 text-sm">fast, good accuracy on clear speech</td>
                    </tr>
                    <tr className="border-b border-border">
                      <td className="px-4 py-3 text-sm">
                        <code className={INLINE_CODE_CLASS_NAME}>large-v3-turbo</code>
                      </td>
                      <td className="px-4 py-3 text-sm">1.6 GB</td>
                      <td className="px-4 py-3 text-sm">best quality/speed balance (recommended)</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 text-sm">
                        <code className={INLINE_CODE_CLASS_NAME}>large-v3</code>
                      </td>
                      <td className="px-4 py-3 text-sm">2.9 GB</td>
                      <td className="px-4 py-3 text-sm">maximum accuracy, slowest</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </Shell>
          </section>

          <section id="cli" className="scroll-mt-8 border-t border-border pt-12">
            <h2 className="text-2xl font-bold tracking-tight">CLI</h2>
            <p className="mt-4 leading-relaxed text-muted-foreground">
              Run a transcription, configure local dependencies, or start the stdio MCP server from the command line.
            </p>
            <CodeBlock code={CLI_HELP} className="mt-5" />
            <p className="mt-4 leading-relaxed text-muted-foreground">
              <code className={INLINE_CODE_CLASS_NAME}>--mode captions</code> skips speech recognition and uses platform
              captions when they exist. It is faster, but caption quality varies.{" "}
              <code className={INLINE_CODE_CLASS_NAME}>--engine groq</code> sends audio to Groq&apos;s hosted Whisper instead
              of running locally. Set <code className={INLINE_CODE_CLASS_NAME}>GROQ_API_KEY</code> in your environment.
            </p>
          </section>

          <section id="library" className="scroll-mt-8 border-t border-border pt-12">
            <h2 className="text-2xl font-bold tracking-tight">Library</h2>
            <p className="mt-4 leading-relaxed text-muted-foreground">
              Import transcriptly directly when you need transcription inside a TypeScript or JavaScript project.
            </p>
            <CodeBlock code={LIBRARY_EXAMPLE} className="mt-5" />
            <p className="mt-4 leading-relaxed text-muted-foreground">
              <code className={INLINE_CODE_CLASS_NAME}>transcribe(source, options)</code> accepts the CLI options{" "}
              <code className={INLINE_CODE_CLASS_NAME}>mode</code>, <code className={INLINE_CODE_CLASS_NAME}>lang</code>,{" "}
              <code className={INLINE_CODE_CLASS_NAME}>model</code>, and{" "}
              <code className={INLINE_CODE_CLASS_NAME}>engine</code>. It returns segments with timestamps, metadata, and
              plain text. Errors are typed, including <code className={INLINE_CODE_CLASS_NAME}>MissingBinaryError</code>{" "}
              and <code className={INLINE_CODE_CLASS_NAME}>UnsupportedUrlError</code>.
            </p>
          </section>

          <section id="mcp" className="scroll-mt-8 border-t border-border pt-12">
            <h2 className="text-2xl font-bold tracking-tight">MCP server</h2>
            <p className="mt-4 leading-relaxed text-muted-foreground">
              The MCP server gives AI agents two tools:{" "}
              <code className={INLINE_CODE_CLASS_NAME}>get_transcript(source, format?, mode?)</code> and{" "}
              <code className={INLINE_CODE_CLASS_NAME}>get_video_info(source)</code>.
            </p>

            <h3 className="mt-8 text-lg font-semibold tracking-tight">Claude Code</h3>
            <CodeBlock code="claude mcp add transcriptly -- npx -y transcriptly mcp" className="mt-4" />

            <h3 className="mt-8 text-lg font-semibold tracking-tight">Claude Desktop</h3>
            <p className="mt-3 leading-relaxed text-muted-foreground">
              Add the snippet from{" "}
              <a
                href="https://github.com/pinokokol/transcriptly/blob/main/examples/claude-desktop.json"
                className={INLINE_LINK_CLASS_NAME}
              >
                examples/claude-desktop.json
              </a>{" "}
              to your configuration.
            </p>

            <h3 className="mt-8 text-lg font-semibold tracking-tight">ChatGPT</h3>
            <p className="mt-3 leading-relaxed text-muted-foreground">
              ChatGPT connects through a Secure MCP Tunnel. Follow the setup in{" "}
              <a
                href="https://github.com/pinokokol/transcriptly/blob/main/examples/chatgpt.md"
                className={INLINE_LINK_CLASS_NAME}
              >
                examples/chatgpt.md
              </a>
              .
            </p>
          </section>

          <section id="api" className="scroll-mt-8 border-t border-border pt-12">
            <h2 className="text-2xl font-bold tracking-tight">Hosted demo API</h2>
            <p className="mt-4 leading-relaxed text-muted-foreground">
              This API is for demo purposes only and is heavily rate limited. The base URL is{" "}
              <code className={INLINE_CODE_CLASS_NAME}>https://transcriptly.dev</code>.
            </p>
            <Shell className="mt-5 min-w-0 max-w-full overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[52rem] border-collapse text-left">
                  <thead>
                    <tr className="border-b border-border">
                      <th scope="col" className="px-4 py-3 text-sm font-medium text-foreground">
                        Method
                      </th>
                      <th scope="col" className="px-4 py-3 text-sm font-medium text-foreground">
                        Endpoint
                      </th>
                      <th scope="col" className="px-4 py-3 text-sm font-medium text-foreground">
                        Request
                      </th>
                      <th scope="col" className="px-4 py-3 text-sm font-medium text-foreground">
                        What it does
                      </th>
                    </tr>
                  </thead>
                  <tbody className="text-muted-foreground">
                    <tr className="border-b border-border">
                      <td className="px-4 py-3 text-sm font-medium text-foreground">GET</td>
                      <td className="px-4 py-3 text-sm">
                        <code className={INLINE_CODE_CLASS_NAME}>
                          {"/api/transcript?url=<url>&format=<format>"}
                        </code>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <code className={INLINE_CODE_CLASS_NAME}>url</code> is required. Format is{" "}
                        <code className={INLINE_CODE_CLASS_NAME}>md</code>, <code className={INLINE_CODE_CLASS_NAME}>txt</code>,{" "}
                        <code className={INLINE_CODE_CLASS_NAME}>json</code>, or{" "}
                        <code className={INLINE_CODE_CLASS_NAME}>srt</code>, default{" "}
                        <code className={INLINE_CODE_CLASS_NAME}>md</code>.
                      </td>
                      <td className="px-4 py-3 text-sm">Transcribe a video URL.</td>
                    </tr>
                    <tr className="border-b border-border">
                      <td className="px-4 py-3 text-sm font-medium text-foreground">POST</td>
                      <td className="px-4 py-3 text-sm">
                        <code className={INLINE_CODE_CLASS_NAME}>/api/transcript</code>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        Multipart form data with a <code className={INLINE_CODE_CLASS_NAME}>file</code> field.
                      </td>
                      <td className="px-4 py-3 text-sm">Transcribe an uploaded file.</td>
                    </tr>
                    <tr className="border-b border-border">
                      <td className="px-4 py-3 text-sm font-medium text-foreground">GET</td>
                      <td className="px-4 py-3 text-sm">
                        <code className={INLINE_CODE_CLASS_NAME}>{"/api/info?url=<url>"}</code>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <code className={INLINE_CODE_CLASS_NAME}>url</code> is required.
                      </td>
                      <td className="px-4 py-3 text-sm">Return title, duration, and platform without transcribing.</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 text-sm font-medium text-foreground">POST</td>
                      <td className="px-4 py-3 text-sm">
                        <code className={INLINE_CODE_CLASS_NAME}>/api/waitlist</code>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        JSON with <code className={INLINE_CODE_CLASS_NAME}>{'{"email":"you@example.com"}'}</code>.
                      </td>
                      <td className="px-4 py-3 text-sm">Join the paid hosted version waitlist.</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </Shell>
            <p className="mt-5 leading-relaxed text-muted-foreground">
              <strong className="font-medium text-foreground">Demo limits:</strong> 5 transcripts per hour and 20 per
              day per IP, a 30 minute video cap, a 25 MB upload cap, plus a shared daily budget. Run the CLI locally for
              unlimited use.
            </p>
          </section>

          <section id="webmcp" className="scroll-mt-8 border-t border-border pt-12">
            <h2 className="text-2xl font-bold tracking-tight">WebMCP</h2>
            <p className="mt-4 leading-relaxed text-muted-foreground">
              The <Link href="/" className={INLINE_LINK_CLASS_NAME}>demo page</Link> registers{" "}
              <code className={INLINE_CODE_CLASS_NAME}>get_transcript</code>,{" "}
              <code className={INLINE_CODE_CLASS_NAME}>get_video_info</code>, and{" "}
              <code className={INLINE_CODE_CLASS_NAME}>transcribe_file</code> through{" "}
              <code className={INLINE_CODE_CLASS_NAME}>document.modelContext</code>. Browser agents can transcribe videos
              directly on the page, including a file the human drops into the drop zone. See the{" "}
              <a
                href="https://github.com/pinokokol/transcriptly/blob/main/web/lib/webmcp.ts"
                className={INLINE_LINK_CLASS_NAME}
              >
                WebMCP source
              </a>
              .
            </p>
          </section>
        </div>
      </div>

      <footer className="flex flex-col items-start gap-2 border-t border-border py-10 text-xs leading-relaxed text-muted-foreground">
        <p>
          MIT licensed · maintained casually ·{" "}
          <a
            href={GITHUB_URL}
            className="underline decoration-foreground/20 underline-offset-4 transition-colors hover:text-foreground"
          >
            source on GitHub
          </a>
        </p>
        <p className="max-w-lg">
          The hosted api transcribes with Groq (whisper-large-v3-turbo); the CLI runs Whisper fully locally.
        </p>
      </footer>
    </main>
  );
}
