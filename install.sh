#!/bin/sh
# Installs the latest commitron release.
#   curl -fsSL https://raw.githubusercontent.com/JeanpierreSolis15/commitron/main/install.sh | sh
# Honours COMMITRON_VERSION and COMMITRON_INSTALL_DIR.
set -eu

REPO="JeanpierreSolis15/commitron"
BIN="commitron"

say() { printf '%s\n' "$*" >&2; }
die() { printf 'error: %s\n' "$*" >&2; exit 1; }
need() { command -v "$1" >/dev/null 2>&1 || die "$1 is required but not installed"; }

need uname
need tar
need curl

os="$(uname -s | tr '[:upper:]' '[:lower:]')"
case "$os" in
	linux | darwin) ;;
	*) die "unsupported operating system: $os — use install.ps1 on Windows, or 'go install'" ;;
esac

arch="$(uname -m)"
case "$arch" in
	x86_64 | amd64) arch="amd64" ;;
	arm64 | aarch64) arch="arm64" ;;
	*) die "unsupported architecture: $arch" ;;
esac

version="${COMMITRON_VERSION:-}"
if [ -z "$version" ]; then
	version="$(curl -fsSL "https://api.github.com/repos/$REPO/releases/latest" |
		sed -n 's/.*"tag_name":[[:space:]]*"\([^"]*\)".*/\1/p' | head -n 1)"
	[ -n "$version" ] || die "could not work out the latest version; set COMMITRON_VERSION"
fi

asset="${BIN}_${version#v}_${os}_${arch}.tar.gz"
url="https://github.com/$REPO/releases/download/$version/$asset"

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

say "downloading $asset"
curl -fsSL "$url" -o "$tmp/$asset" || die "download failed: $url"
tar -xzf "$tmp/$asset" -C "$tmp"
[ -f "$tmp/$BIN" ] || die "the archive did not contain $BIN"

dir="${COMMITRON_INSTALL_DIR:-}"
if [ -z "$dir" ]; then
	if [ -w /usr/local/bin ]; then dir="/usr/local/bin"; else dir="$HOME/.local/bin"; fi
fi
mkdir -p "$dir"
cp "$tmp/$BIN" "$dir/$BIN"
chmod 0755 "$dir/$BIN"

say "installed $version to $dir/$BIN"
case ":$PATH:" in
	*":$dir:"*) ;;
	*) say "note: $dir is not on your PATH" ;;
esac
