#!/usr/bin/env bash
set -e

echo "Running TypeScript tests..."
npx vitest run "$@"
