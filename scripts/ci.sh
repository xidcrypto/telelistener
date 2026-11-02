#!/usr/bin/env bash

set -e

echo "=== Installing dependencies ==="
npm ci

echo "=== Building TypeScript ==="
npm run build

echo "=== Running tests ==="
npm run test

echo "=== Running lint ==="
npm run lint

echo "=== Running typecheck ==="
npm run typecheck

echo "=== All checks passed ==="