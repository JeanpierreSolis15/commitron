"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { REPO, target, binaryPath } = require("./lib/platform");
const { version } = require("./package.json");

async function download(url) {
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) {
    throw new Error(`${url} answered HTTP ${res.status}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

function expectedChecksum(checksums, asset) {
  for (const line of checksums.split("\n")) {
    const [hash, name] = line.trim().split(/\s+/);
    if (name === asset) {
      return hash;
    }
  }
  throw new Error(`checksums.txt has no entry for ${asset}`);
}

async function main() {
  if (version.endsWith("-dev")) {
    console.log("commitron: development checkout, skipping the binary download");
    return;
  }

  const { os, arch, ext } = target();
  const asset = `commitron_${version}_${os}_${arch}${ext}`;
  const base = `https://github.com/${REPO}/releases/download/v${version}`;

  const [binary, checksums] = await Promise.all([
    download(`${base}/${asset}`),
    download(`${base}/checksums.txt`),
  ]);

  const expected = expectedChecksum(checksums.toString("utf8"), asset);
  const actual = crypto.createHash("sha256").update(binary).digest("hex");
  if (actual !== expected) {
    throw new Error(`${asset} does not match its published checksum`);
  }

  const dest = binaryPath();
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, binary, { mode: 0o755 });
  console.log(`commitron ${version}: installed ${asset}`);
}

main().catch((err) => {
  console.error(`commitron: could not install the binary: ${err.message}`);
  console.error(`other ways to install it: https://github.com/${REPO}#install`);
  process.exit(1);
});
