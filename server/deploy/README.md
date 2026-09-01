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
   ```

   Optionally place a Netscape-format cookies file at
   `/etc/transcriptly/cookies.txt`; it is mounted read-only and automatically
   used by every `yt-dlp` invocation. Restrict it with
   `chmod 600 /etc/transcriptly/cookies.txt`.

4. Create DNS-only records (disable proxying): an `A` record for
   `transcriptly.dev` pointing to `46.225.59.22`, and a `CNAME` record for
   `www` pointing to `transcriptly.dev`. Caddy will obtain the TLS certificates.

5. From this repository, run the first deployment:

   ```bash
   DEPLOY_HOST=root@46.225.59.22 server/deploy/deploy.sh all
   ```

   Override the default key with `DEPLOY_SSH_KEY=/path/to/key` when needed.

6. Check service logs on the box from `/opt/strutty/infra`:

   ```bash
   docker compose --env-file /etc/strutty/strutty.env -f docker-compose.prod.yml logs -f --tail=100 transcriptly-api bgutil-provider caddy
   ```
