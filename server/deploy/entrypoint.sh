#!/bin/sh
set -eu

printf '%s\n' \
  '--extractor-args "youtubepot-bgutilhttp:base_url=http://bgutil-provider:4416"' \
  > /etc/yt-dlp.conf

if [ -f /etc/transcriptly/cookies.txt ]; then
  printf '%s\n' '--cookies /etc/transcriptly/cookies.txt' >> /etc/yt-dlp.conf
fi

exec bun run server/index.ts
