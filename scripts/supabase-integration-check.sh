#!/usr/bin/env bash

set -euo pipefail

root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
tmp_project_dir="$(mktemp -d "${TMPDIR:-/tmp}/alea-supabase-check.XXXXXX")"
tmp_types_file="$(mktemp "${TMPDIR:-/tmp}/alea-supabase-types.XXXXXX")"
tmp_expected_types_file="$(mktemp "${TMPDIR:-/tmp}/alea-supabase-expected-types.XXXXXX")"
tmp_project_id="$(basename "${tmp_project_dir}" | tr -cd '[:alnum:]-' | tr '[:upper:]' '[:lower:]')"

cleanup() {
  supabase --workdir "${tmp_project_dir}" stop --no-backup >/dev/null 2>&1 || true
  rm -rf "${tmp_project_dir}" "${tmp_types_file}" "${tmp_expected_types_file}"
}

trap cleanup EXIT

retry() {
  local max_attempts="$1"
  shift

  local attempt=1
  until "$@"; do
    if [[ "${attempt}" -ge "${max_attempts}" ]]; then
      return 1
    fi

    attempt=$((attempt + 1))
    sleep 2
  done
}

pick_port_base() {
  echo "$((61000 + RANDOM % 1000))"
}

rewrite_temp_config() {
  local port_base="$1"
  local shadow_port="${port_base}"
  local api_port="$((port_base + 1))"
  local db_port="$((port_base + 2))"
  local studio_port="$((port_base + 3))"

  cp -R "${root_dir}/supabase" "${tmp_project_dir}/supabase"
  rm -rf "${tmp_project_dir}/supabase/.temp" "${tmp_project_dir}/supabase/.branches"
  perl -0pi -e "s/^project_id = \".*\"$/project_id = \"${tmp_project_id}\"/m" "${tmp_project_dir}/supabase/config.toml"
  perl -0pi -e "s/^\\[api\\]\\nenabled = true\\nport = \\d+/[api]\\nenabled = true\\nport = ${api_port}/m" "${tmp_project_dir}/supabase/config.toml"
  perl -0pi -e "s/^\\[db\\]\\nport = \\d+\\nshadow_port = \\d+/[db]\\nport = ${db_port}\\nshadow_port = ${shadow_port}/m" "${tmp_project_dir}/supabase/config.toml"
  perl -0pi -e "s/^\\[studio\\]\\nenabled = true\\nport = \\d+/[studio]\\nenabled = true\\nport = ${studio_port}/m" "${tmp_project_dir}/supabase/config.toml"
  perl -0pi -e "s/^\\[inbucket\\]\\nenabled = true\\nport = \\d+/[inbucket]\\nenabled = true\\nport = $((studio_port + 1))/m" "${tmp_project_dir}/supabase/config.toml"
}

start_supabase() {
  local max_attempts="$1"
  local attempt=1

  while (( attempt <= max_attempts )); do
    rm -rf "${tmp_project_dir}/supabase"
    rewrite_temp_config "$(pick_port_base)"

    if supabase --workdir "${tmp_project_dir}" start \
      --exclude gotrue,realtime,storage-api,imgproxy,kong,mailpit,postgrest,postgres-meta,studio,edge-runtime,logflare,vector,supavisor; then
      return 0
    fi

    if (( attempt >= max_attempts )); then
      return 1
    fi

    supabase --workdir "${tmp_project_dir}" stop --no-backup >/dev/null 2>&1 || true
    attempt=$((attempt + 1))
    sleep 2
  done
}

start_supabase 10
retry 20 supabase --workdir "${tmp_project_dir}" db reset --local
retry 10 supabase --workdir "${tmp_project_dir}" db lint --local
retry 10 sh -c 'supabase --workdir "$1" gen types typescript --local > "$2"' _ "${tmp_project_dir}" "${tmp_types_file}"

cp "${root_dir}/lib/supabase/types.ts" "${tmp_expected_types_file}"
perl -0pi -e 's/\n*\z/\n/' "${tmp_expected_types_file}" "${tmp_types_file}"

diff -u "${tmp_expected_types_file}" "${tmp_types_file}"
