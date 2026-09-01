#!/usr/bin/env bash
set -euo pipefail

usage() {
  printf '%s\n' \
    'Usage: DEPLOY_HOST=root@46.225.59.22 server/deploy/deploy.sh [site|api|all]' \
    'Optional: DEPLOY_SSH_KEY=/path/to/key (default: ~/.ssh/strutty_hetzner)'
}

if (( $# > 1 )); then
  usage >&2
  exit 2
fi

target="${1:-all}"
case "$target" in
  site|api|all) ;;
  *)
    usage >&2
    exit 2
    ;;
esac

if [[ -z "${DEPLOY_HOST:-}" ]]; then
  usage >&2
  exit 2
fi

deploy_ssh_key="${DEPLOY_SSH_KEY:-${HOME}/.ssh/strutty_hetzner}"
script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd -- "${script_dir}/../.." && pwd)"
rsync_ssh_command="ssh -i $(printf '%q' "$deploy_ssh_key") -o IdentitiesOnly=yes"
ssh_command=(ssh -i "$deploy_ssh_key" -o IdentitiesOnly=yes)

deploy_site() {
  printf '%s\n' 'Building static site...'
  (
    cd "${repo_root}/web"
    bun install
    bun run build
  )

  printf '%s\n' 'Syncing static site...'
  rsync -az --delete \
    -e "$rsync_ssh_command" \
    "${repo_root}/web/out/" \
    "${DEPLOY_HOST}:/opt/strutty/infra/transcriptly-out/"

  printf '%s\n' 'Checking https://transcriptly.dev...'
  curl -fsS https://transcriptly.dev >/dev/null
  printf '%s\n' 'Static site is healthy.'
}

deploy_api() {
  printf '%s\n' 'Syncing API sources...'
  rsync -az --delete \
    -e "$rsync_ssh_command" \
    --exclude='node_modules/' \
    --exclude='web/' \
    --exclude='test/' \
    --exclude='.git/' \
    --exclude='.env' \
    --exclude='dist/' \
    --exclude='.cache/' \
    --exclude='.data/' \
    "${repo_root}/src" \
    "${repo_root}/server" \
    "${repo_root}/package.json" \
    "${repo_root}/bun.lock" \
    "${repo_root}"/tsconfig*.json \
    "${DEPLOY_HOST}:/opt/transcriptly/"

  printf '%s\n' 'Building and restarting API services...'
  "${ssh_command[@]}" "$DEPLOY_HOST" 'bash -s' <<'REMOTE_SCRIPT'
set -euo pipefail

cd /opt/strutty/infra
compose=(docker compose --env-file /etc/strutty/strutty.env -f docker-compose.prod.yml)
"${compose[@]}" up -d --build transcriptly-api bgutil-provider

deadline=$((SECONDS + 60))
while (( SECONDS < deadline )); do
  if "${compose[@]}" exec -T transcriptly-api \
    curl -fsS http://127.0.0.1:8787/api/health >/dev/null; then
    printf '%s\n' 'API is healthy.'
    exit 0
  fi
  sleep 2
done

printf '%s\n' 'API health check failed; recent container logs:' >&2
"${compose[@]}" logs --tail=100 transcriptly-api bgutil-provider >&2
exit 1
REMOTE_SCRIPT
}

case "$target" in
  site)
    deploy_site
    ;;
  api)
    deploy_api
    ;;
  all)
    deploy_site
    deploy_api
    ;;
esac
