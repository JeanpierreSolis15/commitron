"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { REPO, target, binaryPath } = require("./platform");
const { version } = require("../package.json");

async function fetchBuffer(url) {
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

async function download() {
  if (version.endsWith("-dev")) {
    throw new Error("this is a development checkout; build the binary into npm/vendor first (see CONTRIBUTING.md)");
  }

  const { os, arch, ext } = target();
  const asset = `commitron_${version}_${os}_${arch}${ext}`;
  const base = `https://github.com/${REPO}/releases/download/v${version}`;
  console.error(`commitron: downloading ${asset} from the v${version} release`);

  const [binary, checksums] = await Promise.all([
    fetchBuffer(`${base}/${asset}`),
    fetchBuffer(`${base}/checksums.txt`),
  ]);

  const expected = expectedChecksum(checksums.toString("utf8"), asset);
  const actual = crypto.createHash("sha256").update(binary).digest("hex");
  if (actual !== expected) {
    throw new Error(`${asset} does not match its published checksum`);
  }

  const dest = binaryPath();
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const partial = `${dest}.${process.pid}.part`;
  fs.writeFileSync(partial, binary, { mode: 0o755 });
  fs.renameSync(partial, dest);
  return dest;
}

module.exports = { download };
