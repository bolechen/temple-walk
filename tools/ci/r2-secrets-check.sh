#!/usr/bin/env bash
# The four repository secrets the evidence mirror and its smoke test need (#247): says which of them is missing or empty by
# name, never by value. Reads the names the workflows export (AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY are R2_ACCESS_KEY_ID
# and R2_SECRET_ACCESS_KEY there). Exit 0 when all four are set, 1 when any is not.
missing=""
[ -n "${AWS_ACCESS_KEY_ID:-}" ] || missing="$missing R2_ACCESS_KEY_ID"
[ -n "${AWS_SECRET_ACCESS_KEY:-}" ] || missing="$missing R2_SECRET_ACCESS_KEY"
[ -n "${R2_ENDPOINT:-}" ] || missing="$missing R2_ENDPOINT"
[ -n "${R2_BUCKET:-}" ] || missing="$missing R2_BUCKET"
if [ -n "$missing" ]; then
  echo "::error::Repository secret(s) missing or empty:$missing"
  exit 1
fi
echo "All four secrets are set."
