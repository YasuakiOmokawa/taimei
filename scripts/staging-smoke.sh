#!/usr/bin/env bash
set -u

base="${1:-}"
auth_base="${2:-}"
version="${3:-}"
if [ -z "$base" ] || [ -z "$auth_base" ] || [ -z "$version" ]; then
  echo "usage: $0 <base-url> <auth-url> <version-id>" >&2
  exit 2
fi
if [ -z "${ACCESS_CLIENT_ID:-}" ] || [ -z "${ACCESS_CLIENT_SECRET:-}" ]; then
  echo "ACCESS_CLIENT_ID and ACCESS_CLIENT_SECRET are required" >&2
  exit 2
fi
base="${base%/}"
auth_base="${auth_base%/}"
access_headers=(-H "CF-Access-Client-Id: $ACCESS_CLIENT_ID" -H "CF-Access-Client-Secret: $ACCESS_CLIENT_SECRET")
version_wait_seconds=60
body_file=$(mktemp)
headers_file=$(mktemp)
trap 'rm -f "$body_file" "$headers_file"' EXIT
fails=0

fail() {
  echo "FAIL: $1" >&2
  fails=$((fails + 1))
}

probe() {
  curl -sS --max-time 30 "${access_headers[@]}" -D "$headers_file" -o "$body_file" -w '%{http_code}' "$base$1" 2>/dev/null
}

header_value() {
  tr -d '\r' <"$headers_file" | grep -i "^$1:" | tail -1 | sed 's/^[^:]*: *//'
}

echo "staging smoke: $base (version $version)"

deadline=$((SECONDS + version_wait_seconds))
while :; do
  status=$(probe /api/teams)
  served=$(header_value Taimei-Staging-Version)
  if [ "$served" = "$version" ]; then
    echo "/api/teams is served by $version"
    break
  fi
  if [ "$SECONDS" -ge "$deadline" ]; then
    fail "/api/teams is served by \"$served\" (status $status) after ${version_wait_seconds}s, expected $version"
    break
  fi
  sleep 2
done

body=$(tr -d '\n' <"$body_file")
if [ "$status" = "401" ] && [ "$body" = '{"_tag":"Unauthenticated"}' ]; then
  echo "/api/teams (no cookie): 401 $body"
else
  fail "/api/teams (no cookie) -> $status $body (expected 401 {\"_tag\":\"Unauthenticated\"})"
fi

status=$(probe /auth)
location=$(header_value Location)
case "$status:$location" in
  302:"$auth_base"/*) echo "/auth: 302 to $auth_base" ;;
  *) fail "/auth -> $status $location (expected 302 to $auth_base/)" ;;
esac

status=$(curl -sS --max-time 30 -D "$headers_file" -o /dev/null -w '%{http_code}' "$base/api/teams" 2>/dev/null)
location=$(header_value Location)
case "$status:$location" in
  302:*.cloudflareaccess.com/* | 403:*) echo "/api/teams (no Access token): blocked ($status)" ;;
  *) fail "/api/teams (no Access token) -> $status $location (expected 302 to *.cloudflareaccess.com or 403)" ;;
esac

if [ "$fails" -gt 0 ]; then
  echo "staging smoke: $fails failure(s)" >&2
  exit 1
fi
echo "staging smoke: OK"
