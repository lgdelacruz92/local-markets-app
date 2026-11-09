#!/usr/bin/env bash
set -euo pipefail

# Real requests to the local auth service. This curl session is separate from
# your browser's session; it cannot complete Google's interactive sign-in.
AUTH_URL="http://localhost:3001"
umask 077
COOKIE_JAR=$(mktemp "${TMPDIR:-/tmp}/auth-cookies.XXXXXXXX")
trap 'rm -f "$COOKIE_JAR"' EXIT

printf 'GET %s/api/session\n' "$AUTH_URL"
curl --silent --show-error --fail --max-time 10 \
  --cookie-jar "$COOKIE_JAR" \
  "$AUTH_URL/api/session" | node -e '
    let body = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", chunk => body += chunk); // ass you add byte streams you append to body
    process.stdin.on("end", () => {
      try {
        const session = JSON.parse(body);
        if (session.user !== null || typeof session.csrfToken !== "string" || !session.csrfToken) {
          throw new Error("unexpected session response");
        }
        console.log("OK: anonymous session and CSRF token received (values hidden)");
      } catch {
        console.error("Unexpected session response");
        process.exitCode = 1;
      }
    });
  '

printf '\nGET %s/api/auth/google/start\n' "$AUTH_URL"
# Do not follow the redirect: curl cannot sign in to Google interactively.
# Keep the URL private because it contains OAuth state and a PKCE challenge.
result=$(curl --silent --show-error --max-time 10 \
  --cookie "$COOKIE_JAR" --cookie-jar "$COOKIE_JAR" \
  --output /dev/null --write-out '%{http_code}\n%{redirect_url}' \
  "$AUTH_URL/api/auth/google/start")
status=${result%%$'\n'*}
redirect=${result#*$'\n'}

if [[ "$status" != 302 ]]; then
  printf 'FAILED: expected HTTP 302, got %s. HTTP 503 means Google is not configured.\n' "$status" >&2
  exit 1
fi
if [[ "$redirect" != 'https://accounts.google.com/o/oauth2/v2/auth?'* ]]; then
  printf 'FAILED: redirect did not point to the expected Google authorization endpoint.\n' >&2
  exit 1
fi
printf 'OK: HTTP 302 redirects to Google (OAuth parameters hidden)\n'

cat <<'NEXT'

These checks do not prove Google login works end to end. To test that:
1. In a browser, open http://localhost:3001/api/auth/google/start and sign in.
2. Google redirects to the configured callback on localhost:3000. That origin
   must route /api/auth/* and /api/session to this auth service.
3. On the app origin, check /api/session in the same browser. A non-null user
   confirms login. The curl cookie above is not the browser's cookie.
NEXT
