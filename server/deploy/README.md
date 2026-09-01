# Transcriptly demo deployment

1. Merge the `services:` entries and the two top-level named volumes from
   `compose.snippet.yml` into
   `/opt/strutty/infra/docker-compose.prod.yml`. Under the existing Caddy
   service's `volumes:`, add:

   ```yaml
   - ./transcriptly-out:/srv/transcriptly:ro
   ```

   Then create the bind-mount source with
   `mkdir -p /opt/strutty/infra/transcriptly-out`.

2. Append the two site blocks from `Caddyfile.snippet` to the Caddyfile already
   mounted by the `strutty-infra` stack. Recreate or reload the Caddy service
   after editing the compose file and Caddyfile.

3. Create `/etc/transcriptly/env` on the box with exactly these variables and
   real secret values, then restrict it with `chmod 600 /etc/transcriptly/env`:

   ```dotenv
   GROQ_API_KEY=replace-me
   DISCORD_WEBHOOK_URL=replace-me
   ASR_ENGINE=groq
   PORT=8787
   YOUTUBE_PROXY_URL=replace-me-or-remove
   ```

   `YOUTUBE_PROXY_URL` (optional but recommended) routes YouTube-only yt-dlp
   traffic through a residential proxy, since YouTube blocks Hetzner IPs.

   Optionally place a Netscape-format cookies file at
   `/etc/transcriptly/cookies.txt`; it is mounted read-only and automatically
   used by every `yt-dlp` invocation. Restrict it with
   `chmod 600 /etc/transcriptly/cookies.txt`.

4. At the registrar's DNS panel, create an `A` record for `transcriptly.dev`
   (host `@`) pointing to `46.225.59.22`, and a `CNAME` record for `www`
   pointing to `transcriptly.dev`. Caddy obtains the TLS certificates itself,
   so if a proxying CDN (e.g. Cloudflare) is ever put in front, its records
   must stay DNS-only.

5. From this repository, run the first deployment:

   ```bash
   DEPLOY_HOST=root@46.225.59.22 server/deploy/deploy.sh all
   ```

   Override the default key with `DEPLOY_SSH_KEY=/path/to/key` when needed.

6. Check service logs on the box from `/opt/strutty/infra`:

   ```bash
   docker compose --env-file /etc/strutty/strutty.env -f docker-compose.prod.yml logs -f --tail=100 transcriptly-api bgutil-provider caddy
   ```

## Pre-warming the sample cache

The landing page's sample chips must work even when YouTube blocks the box.
Generate their cache entries locally (residential IP, needs `GROQ_API_KEY` in
`.env` plus yt-dlp and ffmpeg):

```bash
bun run server/deploy/prewarm.ts
```

Then ship them into the running container's cache volume:

```bash
rsync -avz server/deploy/prewarm-out/ root@46.225.59.22:/opt/transcriptly-prewarm/
ssh root@46.225.59.22 "cd /opt/strutty/infra && docker compose --env-file /etc/strutty/strutty.env -f docker-compose.prod.yml cp /opt/transcriptly-prewarm/. transcriptly-api:/data/cache/"
```

Re-run both steps whenever the sample urls in `web/components/demo.tsx` change
(the cache key hashes the raw source string).
