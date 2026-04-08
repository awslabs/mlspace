#!/usr/bin/env bash
# Run ESLint with the binary that matches each package. Invokes at most three processes total
# (frontend paths, cypress paths, CDK/other paths) instead of one process per file.
set -uo pipefail
root="$(git rev-parse --show-toplevel)"
cd "$root"

root_eslint="${root}/node_modules/.bin/eslint"
front_eslint="${root}/frontend/node_modules/.bin/eslint"

if [[ ! -x "$root_eslint" ]]; then
  echo "error: missing ${root_eslint} — run npm install at the repo root" >&2
  exit 1
fi
if [[ ! -x "$front_eslint" ]]; then
  echo "error: missing ${front_eslint} — run npm install in frontend/" >&2
  exit 1
fi

export ESLINT_USE_FLAT_CONFIG=false

# Cypress configs live under cypress/; ESLint resolves plugins from that directory unless we point it
# at frontend/node_modules (where eslint-plugin-react and friends are installed).
front_plugin_root="${root}/frontend/node_modules"

front_paths=()
cypress_paths_rel=()
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
      # Same binary as frontend; run from frontend/ so ../cypress/... resolves (eslint ignores non-matching cwd).
      cypress_paths_rel+=("../$f")
      ;;
    *)
      root_paths+=("$f")
      ;;
  esac
done

status=0
if [[ ${#front_paths[@]} -gt 0 ]]; then
  (cd "${root}/frontend" && "$front_eslint" --fix "${front_paths[@]}") || status=$?
fi
if [[ ${#cypress_paths_rel[@]} -gt 0 ]]; then
  (cd "${root}/frontend" && \
    "$front_eslint" --resolve-plugins-relative-to "$front_plugin_root" --fix "${cypress_paths_rel[@]}") || status=$?
fi
if [[ ${#root_paths[@]} -gt 0 ]]; then
  (cd "$root" && "$root_eslint" --fix "${root_paths[@]}") || status=$?
fi

exit "$status"
