/**
 * Some platforms block or login-wall requests from datacenter IPs. Deployments
 * can set YTDLP_PROXY_URL (typically a residential proxy) and every yt-dlp call
 * for one of those platforms is routed through it. Everything else (TikTok,
 * direct media URLs, local files) never touches the proxy.
 */

const PROXIED_HOSTS = [
  "youtube.com",
  "youtu.be",
  "youtube-nocookie.com",
  "instagram.com",
  "facebook.com",
  "fb.watch",
  "x.com",
  "twitter.com",
  "reddit.com",
  "redd.it",
];

export function needsProxy(input: string): boolean {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return false;
  }
  const host = url.hostname.toLowerCase();
  return PROXIED_HOSTS.some((known) => host === known || host.endsWith(`.${known}`));
}

export function ytDlpProxyArgs(
  source: string,
  env: Record<string, string | undefined> = process.env,
): string[] {
  const proxy = env.YTDLP_PROXY_URL?.trim();
  if (!proxy || !needsProxy(source)) return [];
  return ["--proxy", proxy];
}
