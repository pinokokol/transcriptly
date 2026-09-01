FROM oven/bun:1.4.0

USER root

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ca-certificates \
        curl \
        ffmpeg \
        python3 \
        python3-pip \
        python3-venv \
    && python3 -m venv /opt/yt-dlp \
    && /opt/yt-dlp/bin/python -m pip install --no-cache-dir --upgrade pip \
    && /opt/yt-dlp/bin/python -m pip install --no-cache-dir \
        yt-dlp \
        bgutil-ytdlp-pot-provider \
    && rm -rf /var/lib/apt/lists/*

ENV PATH="/opt/yt-dlp/bin:${PATH}"

WORKDIR /app

COPY package.json bun.lock tsconfig.json ./
RUN bun install --production --frozen-lockfile

COPY src/ ./src/
COPY server/*.ts ./server/
COPY server/deploy/entrypoint.sh /usr/local/bin/transcriptly-entrypoint

RUN chmod 0755 /usr/local/bin/transcriptly-entrypoint

EXPOSE 8787

ENTRYPOINT ["/usr/local/bin/transcriptly-entrypoint"]
