#!/usr/bin/env bash
set -u
if grep -rIn --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=.open-next --exclude-dir=.wrangler --exclude-dir=.git --exclude=package-lock.json --exclude=AGENTS.md -- $'\xe2\x80\x94' . ; then
  echo "em dashes found"; exit 1
fi
echo "check:dashes clean"
