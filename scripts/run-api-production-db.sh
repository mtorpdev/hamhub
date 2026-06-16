#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${1:-$ROOT_DIR/.env.production.local}"

if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

if [[ -n "${HAMHUB_DB_CONNECTION_STRING:-}" && -z "${ConnectionStrings__DefaultConnection:-}" ]]; then
  export ConnectionStrings__DefaultConnection="$HAMHUB_DB_CONNECTION_STRING"
fi

if [[ -z "${ConnectionStrings__DefaultConnection:-}" ]]; then
  echo "Missing ConnectionStrings__DefaultConnection."
  echo "Create $ENV_FILE from .env.example, or export HAMHUB_DB_CONNECTION_STRING."
  exit 1
fi

export ASPNETCORE_ENVIRONMENT="${ASPNETCORE_ENVIRONMENT:-Development}"
export DOTNET_ROOT="${DOTNET_ROOT:-/opt/homebrew/opt/dotnet@8/libexec}"

cd "$ROOT_DIR"
exec dotnet run --project backend/HamHub.Api/HamHub.Api.csproj --urls http://localhost:5085
