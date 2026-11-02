#!/usr/bin/env bash

set -e

echo "=== Docker Build ==="
 docker build -t telegram-monitor:latest .

echo "=== Running Tests ==="
 npm run test

echo "=== Running Lint ==="
 npm run lint

echo "=== Running Type Check ==="
 npm run typecheck

echo "=== Building TypeScript ==="
 npm run build

echo "=== All checks passed ==="