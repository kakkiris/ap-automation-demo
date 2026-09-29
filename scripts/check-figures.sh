#!/usr/bin/env bash
# Leak guard for figures. Real-world figures heard in discovery must never be presented as
# fact on screen. The list is kept outside the repo (../forbidden-figures.txt or
# FORBIDDEN_FIGURES_FILE) and scanned over client-facing
# sources only: app, components, packs/*/ui, packs/*/seed/canned, public/demo (text
# files), data/annotations.json, docs/*.md, README.md. Counts of seed things and
# seed-computed amounts labeled example data are allowed; the client's own numbers are not.
set -u
FIGURES="${FORBIDDEN_FIGURES_FILE:-../forbidden-figures.txt}"
if [[ ! -f "$FIGURES" ]]; then echo "check:figures skipped: no forbidden figures list at $FIGURES"; exit 0; fi
CLIENT_FACING=(app components data/annotations.json README.md)
for d in packs/*/ui packs/*/seed/canned public/demo; do [[ -d "$d" ]] && CLIENT_FACING+=("$d"); done
for f in docs/*.md; do [[ -f "$f" ]] && CLIENT_FACING+=("$f"); done
hits=0
while IFS= read -r term; do
  [[ -z "$term" || "$term" == \#* ]] && continue
  if grep -rIniF -- "$term" "${CLIENT_FACING[@]}" >/dev/null 2>&1; then
    echo "FIGURE HIT: $term"; grep -rIniF -- "$term" "${CLIENT_FACING[@]}" | head -5; hits=1
  fi
done < "$FIGURES"
[[ $hits -eq 0 ]] && echo "check:figures clean" && exit 0
exit 1
