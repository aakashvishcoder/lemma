#!/usr/bin/env bash
# Installs everything (dev dependencies included) and prints what Vercel's
# environment looks like, so a missing-package build failure is diagnosable.
set -x
node -v
npm -v
env | grep -iE "^(NODE_ENV|NPM_CONFIG|npm_config)" || true
npm config get omit
npm ci --include=dev
ls node_modules | wc -l
ls node_modules/.bin | grep -E "^(vite|tsc)$" || echo "vite/tsc bin missing"
ls -d node_modules/vite node_modules/@vitejs/plugin-react apps/web/node_modules 2>&1 || true
