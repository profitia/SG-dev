set -euo pipefail

repo=profitia/SG-dev
workflow=.github/workflows/platform-contracts-ci.yml
[[ "$APPROVED_WORKFLOW_BLOB" =~ ^[a-f0-9]{40}$ ]]
test "$GITHUB_REPOSITORY" = "$repo"
test "$GITHUB_REF" = refs/heads/governance/gv01b-control
test "$(git rev-parse HEAD)" = "$GITHUB_SHA"
test "$(git rev-parse "HEAD:$workflow")" = "$APPROVED_WORKFLOW_BLOB"
test "$(gh api "repos/$repo/git/ref/heads/governance/gv01b-control" --jq .object.sha)" = "$GITHUB_SHA"
test "$(gh api "repos/$repo/git/ref/heads/main" --jq .object.sha)" = 58e6891e4232111ac2e6932a30b0c6b4d4372faf
gh api "repos/$repo/rules/branches/governance%2Fgv01b-control" |
  jq -e '[.[] | select(.ruleset_id == 28054321) | .type] | index("update") != null and index("deletion") != null and index("non_fast_forward") != null' >/dev/null
status=$(curl --silent --show-error --max-time 15 --output /dev/null --write-out '%{http_code}' \
  -H "Authorization: Bearer $GH_TOKEN" "https://api.github.com/repos/$repo/actions/permissions")
case "$status" in
  401|403|404) ;;
  *) echo 'Expected denial of administrative Actions API' >&2; exit 1 ;;
esac
# Fetch public Git objects without changing the checkout or running PR code.
git fetch --no-tags --no-recurse-submodules "https://github.com/$repo.git" refs/heads/main refs/pull/1325/head refs/pull/1325/merge
test -f scripts/governance/source-admission/solo-trust.json
