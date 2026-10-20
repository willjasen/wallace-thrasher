#!/bin/sh
set -eu

version="v0.5.1"
install_dir="${DOCFIND_INSTALL_DIR:-$HOME/.local/bin}"
binary="$install_dir/docfind"

if [ -x "$binary" ] && [ "$("$binary" --version)" = "docfind 0.5.1" ]; then
  printf '%s\n' "$binary"
  exit 0
fi

system_name=$(uname -s)
machine=$(uname -m)
case "$system_name/$machine" in
  Darwin/arm64|Darwin/aarch64)
    asset="docfind-aarch64-apple-darwin.tar.gz"
    checksum="5c7869f8d1c7d4ea0fa8afceda8b4b2293d41be1d8619f87c1f194b1673c1c62"
    ;;
  Darwin/x86_64)
    asset="docfind-x86_64-apple-darwin.tar.gz"
    checksum="17726d7c7c4dddfadf8992e4f837d1a054622f7016656ce02aa59793c00cdddb"
    ;;
  Linux/x86_64)
    asset="docfind-x86_64-unknown-linux-gnu.tar.gz"
    checksum="8505d4a0a79d9f28b63dae6a213a46144bae73cdc51ef617a9b823a5ff0d46db"
    ;;
  Linux/aarch64|Linux/arm64)
    asset="docfind-aarch64-unknown-linux-gnu.tar.gz"
    checksum="6b3c3641f2458e3e1a39ce4daf78690b3b62971de99e36d17cc2b93cb8e4ed29"
    ;;
  *)
    printf 'Unsupported platform for docfind: %s/%s\n' "$system_name" "$machine" >&2
    exit 1
    ;;
esac

temporary_dir=$(mktemp -d)
archive="$temporary_dir/$asset"
trap 'rm -f "$archive" "$temporary_dir/docfind"; rmdir "$temporary_dir" 2>/dev/null || true' EXIT HUP INT TERM
url="https://github.com/microsoft/docfind/releases/download/$version/$asset"

curl --fail --location --silent --show-error "$url" --output "$archive"
printf '%s  %s\n' "$checksum" "$archive" | shasum -a 256 --check --status || {
  printf 'Checksum verification failed for %s\n' "$asset" >&2
  exit 1
}
tar -xzf "$archive" -C "$temporary_dir" docfind

mkdir -p "$install_dir"
install -m 755 "$temporary_dir/docfind" "$binary"
printf '%s\n' "$binary"
