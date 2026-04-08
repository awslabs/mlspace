#!/usr/bin/env bash
# Run ESLint with the binary and config that match each package. Invokes at most three
# processes total (frontend paths, cypress paths, CDK/other paths) instead of one per file.
set -uo pipefail
root="$(git rev-parse --show-toplevel)"
cd "$root"

root_eslint="${root}/node_modules/.bin/eslint"
front_eslint="${root}/frontend/node_modules/.bin/eslint"
cypress_eslint="${root}/cypress/node_modules/.bin/eslint"

if [[ ! -x "$root_eslint" ]]; then
  echo "error: missing ${root_eslint} — run npm install at the repo root" >&2
  exit 1
fi
if [[ ! -x "$front_eslint" ]]; then
  echo "error: missing ${front_eslint} — run npm install in frontend/" >&2
  exit 1
fi

# Root + frontend still use .eslintrc (legacy). Cypress uses eslint.config.mjs in cypress/.
# If Cypress files were linted via the frontend binary, ESLint would walk up and apply the
# repo-root .eslintrc (spellcheck, etc.) — wrong for the e2e package.

front_paths=()
cypress_pkg_paths=()
root_paths=()

for arg in "$@"; do
  f="$arg"
  if [[ "$f" == "$root"/* ]]; then
    f="${f#"$root"/}"
  fi
  case "$f" in
    frontend/*)
      front_paths+=("${f#frontend/}")
      ;;
    cypress/*)
      cypress_pkg_paths+=("${f#cypress/}")
      ;;
    *)
      root_paths+=("$f")
      ;;
  esac
done

status=0
if [[ ${#front_paths[@]} -gt 0 ]]; then
  (cd "${root}/frontend" && ESLINT_USE_FLAT_CONFIG=false "$front_eslint" --fix "${front_paths[@]}") || status=$?
fi
if [[ ${#cypress_pkg_paths[@]} -gt 0 ]]; then
  if [[ ! -x "$cypress_eslint" ]]; then
    echo "error: missing ${cypress_eslint} — run npm install in cypress/" >&2
    exit 1
  fi
  (cd "${root}/cypress" && "$cypress_eslint" --fix "${cypress_pkg_paths[@]}") || status=$?
fi
if [[ ${#root_paths[@]} -gt 0 ]]; then
  (cd "$root" && ESLINT_USE_FLAT_CONFIG=false "$root_eslint" --fix "${root_paths[@]}") || status=$?
fi

exit "$status"
