#!/usr/bin/env bash
# Load local secrets from backend/.env and start the Spring Boot application.
set -euo pipefail

cd "$(dirname "$0")"

if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env
  set +a
fi

if [ -z "${JWT_SECRET:-}" ]; then
  echo "JWT_SECRET is not set. Copy .env.example to .env and set a strong secret." >&2
  exit 1
fi

exec mvn spring-boot:run
