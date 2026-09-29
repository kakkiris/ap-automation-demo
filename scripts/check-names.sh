#!/usr/bin/env bash
# Leak guard for names. Real names that must never appear in the repo (companies, people,
# places, systems) are kept outside it, at ../forbidden-names.txt or FORBIDDEN_NAMES_FILE, so
# the list itself never ships, and scanned over the whole repo. Real-world figures are a
# separate list and a separate script: npm run check:figures.
set -u
NAMES="${FORBIDDEN_NAMES_FILE:-../forbidden-names.txt}"
if [[ ! -f "$NAMES" ]]; then echo "check:names skipped: no forbidden names list at $NAMES"; exit 0; fi
EXCLUDES=(--exclude-dir=node_modules --exclude-dir=.next --exclude-dir=.open-next --exclude-dir=.wrangler --exclude-dir=.git --exclude-dir=test-results --exclude-dir=playwright-report --exclude=package-lock.json)
hits=0
while IFS= read -r term; do
  [[ -z "$term" || "$term" == \#* ]] && continue
  if grep -rIniw "${EXCLUDES[@]}" -- "$term" . >/dev/null 2>&1; then
    echo "NAME HIT: $term"; grep -rIniw "${EXCLUDES[@]}" -- "$term" . | head -5; hits=1
  fi
done < "$NAMES"
[[ $hits -eq 0 ]] && echo "check:names clean" && exit 0
exit 1
