# transcriptly

Any video URL or file in, one clean transcript out.

Runs Whisper speech recognition on the audio, so it works on any video, not just ones with captions. One core, four ways to use it: a CLI, an MCP server for AI agents, a hosted demo API, and WebMCP tools on the [demo page](https://transcriptly.dev).

Supports platform URLs through [yt-dlp](https://github.com/yt-dlp/yt-dlp): YouTube, TikTok, Facebook, X, Reddit, Twitch clips, SoundCloud, Dailymotion, and most other sites yt-dlp handles (Instagram and Vimeo need a login). Also direct media URLs and local video or audio files.

## Quick start

```sh
npm install -g transcriptly
transcriptly setup
transcriptly https://youtu.be/dQw4w9WgXcQ
```

`setup` checks your tools and lets you pick a Whisper model with arrow keys. One-off use without installing: `npx -y transcriptly <url>`.

### Requirements

- Node 20 or newer (npm, pnpm, yarn, and bun all work)
- `ffmpeg` (audio extraction)
- `yt-dlp` (URL sources; not needed for local files)
- `whisper-cli` for local transcription (`brew install whisper-cpp`), or a [Groq](https://console.groq.com) API key instead

`transcriptly setup` tells you exactly what is missing and how to install it.

### Models

Downloaded once to `~/.cache/transcriptly/models`:

| Model | Size | Tradeoff |
| --- | --- | --- |
| `small` | 466 MB | fast, good accuracy on clear speech |
| `large-v3-turbo` | 1.6 GB | best quality/speed balance (recommended) |
| `large-v3` | 2.9 GB | maximum accuracy, slowest |

## CLI

```
Usage: transcriptly <url-or-file> [options]
       transcriptly setup
       transcriptly mcp

Options:
  -f, --format <md|txt|json|srt>  Output format (default: md)
  -o, --output <file>             Write transcript to a file
      --mode <asr|captions>       Transcription mode (default: asr)
      --model <name>              Local Whisper model name or path
      --lang <code>               Spoken or caption language
      --engine <local|groq>       ASR engine (default: local)
  -y, --yes                       Download --model without prompting
```

`--mode captions` skips speech recognition and uses the platform's captions when they exist. Faster, but caption quality varies. `--engine groq` sends the audio to Groq's hosted Whisper instead of running locally; set `GROQ_API_KEY` in your environment.

## Library

```ts
import { transcribe, formatTranscript } from "transcriptly";

const transcript = await transcribe("https://youtu.be/dQw4w9WgXcQ");
console.log(transcript.text);
console.log(formatTranscript(transcript, "srt"));
```

`transcribe(source, options)` accepts the same options as the CLI (`mode`, `lang`, `model`, `engine`) and returns segments with timestamps, metadata, and plain text. Errors are typed (`MissingBinaryError`, `UnsupportedUrlError`, and friends) so you can handle them precisely.

## MCP server

Gives AI agents two tools: `get_transcript(source, format?, mode?)` and `get_video_info(source)`.

Claude Code:

```sh
claude mcp add transcriptly -- npx -y transcriptly mcp
```

Claude Desktop: add the snippet from [examples/claude-desktop.json](examples/claude-desktop.json) to your config. ChatGPT connects through a Secure MCP Tunnel, see [examples/chatgpt.md](examples/chatgpt.md).

## Hosted demo API

For demo purposes only, heavily rate limited. Base URL: `https://transcriptly.dev`.

| Endpoint | What it does |
| --- | --- |
| `GET /api/transcript?url=<url>&format=md` | Transcribe a video URL |
| `POST /api/transcript` | Transcribe an uploaded file (multipart `file` field) |
| `GET /api/info?url=<url>` | Title, duration, and platform without transcribing |
| `POST /api/waitlist` | Interested in a paid hosted version? Leave your email |

Limits: 5 transcripts/hour and 20/day per IP, 30 minute video cap, 25 MB upload cap, plus a shared daily budget. Want more? Hit the waitlist and tell me.

## WebMCP

The [demo page](https://transcriptly.dev) registers WebMCP tools (`get_transcript`, `get_video_info`, `transcribe_file`) via `document.modelContext`, so browser agents can transcribe videos directly on the page, including a file the human drops into the drop zone. Source in [web/lib/webmcp.ts](web/lib/webmcp.ts).

## Honest notes

- URL support rides on yt-dlp. Platforms change things and break it sometimes; `pipx upgrade yt-dlp` usually fixes it.
- YouTube, Facebook, X, and Reddit block or login-wall datacenter IPs. The hosted demo routes them through a residential proxy, but the CLI on your own machine is the reliable path.
- This is a side project, maintained casually. Issues and PRs welcome, response times honest.

## License

[MIT](LICENSE)
