#!/usr/bin/env bash
#
# Checks that the npm Trusted Publishing configuration for this package accepts
# an OIDC token minted by this workflow.
#
# It performs exactly the exchange the npm CLI performs before `npm publish`
# (see npm's lib/utils/oidc.js): ask GitHub for an ID token with the audience
# `npm:registry.npmjs.org`, then POST it to the registry's package exchange
# endpoint. A `token` field in the response (npm answers 201) means the trust
# relationship is in place and `npm publish` will authenticate; anything else
# means npmjs.com has no (or a mismatching) trusted publisher for this
# repository + workflow file.
#
# The exchanged credential is deliberately never printed: only the HTTP status
# and npm's error message are shown.
#
# Requires: a job with `permissions: id-token: write`, node, curl, bash.

set -euo pipefail

audience='npm:registry.npmjs.org'
registry="${NPM_CONFIG_REGISTRY:-https://registry.npmjs.org}"
registry="${registry%/}"
package="$(node -p "require('./package.json').name")"
workflow="${GITHUB_WORKFLOW_REF:-${GITHUB_WORKFLOW:-unknown workflow}}"

if [ -z "${ACTIONS_ID_TOKEN_REQUEST_URL:-}" ] || [ -z "${ACTIONS_ID_TOKEN_REQUEST_TOKEN:-}" ]; then
  echo "::error::GitHub exposed no OIDC request endpoint - the job needs 'permissions: id-token: write'"
  exit 1
fi

read_json() {
  # read_json <file> <js expression over `data`>
  node -e "let data; try { data = JSON.parse(require('fs').readFileSync(process.argv[1], 'utf8')) } catch { data = {} } process.stdout.write(String($2))" "$1"
}

id_token="$(curl -sS -H "Authorization: Bearer ${ACTIONS_ID_TOKEN_REQUEST_TOKEN}" \
  "${ACTIONS_ID_TOKEN_REQUEST_URL}&audience=${audience}" \
  | node -e "let raw = ''; process.stdin.on('data', (c) => { raw += c }).on('end', () => {
      let value = ''
      try { value = JSON.parse(raw).value || '' } catch { value = '' }
      if (!value) {
        console.error('::error::GitHub did not return an OIDC token (is id-token: write set?)')
        process.exit(1)
      }
      process.stdout.write(value)
    })")"

body="$(mktemp)"
status="$(curl -sS -o "$body" -w '%{http_code}' -X POST \
  -H "Authorization: Bearer ${id_token}" \
  "${registry}/-/npm/v1/oidc/token/exchange/package/${package}")"

# The token in a successful response is a live credential: success is decided by
# its presence, and no branch ever echoes the response body itself.
if [ "$(read_json "$body" "data.token ? 'yes' : 'no'")" = 'yes' ]; then
  echo "trusted publisher OK (HTTP ${status}): npm issued a short-lived publish token for ${package} to ${workflow}"
  echo "- npm trusted publisher verified for \`${package}\` (${workflow}), HTTP ${status}" >> "${GITHUB_STEP_SUMMARY:-/dev/null}"
  exit 0
fi

message="$(read_json "$body" "data.message || data.error || 'unexpected response body'")"
echo "::error::npm rejected the OIDC exchange with HTTP ${status}: ${message}"
{
  echo "### npm trusted publisher check failed"
  echo
  echo "HTTP ${status}: ${message}"
  echo
  echo "Check npmjs.com -> ${package} -> Settings -> Trusted publishing: the GitHub Actions"
  echo "entry must name \`Yaronluo\` / \`dsh-plugin-git-workbench\` / \`publish.yml\` and allow"
  echo "\`npm publish\`. Configurations that never publish successfully expire after 2 days."
} >> "${GITHUB_STEP_SUMMARY:-/dev/null}"
exit 1
