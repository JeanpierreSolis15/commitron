"use strict";

const path = require("node:path");

const REPO = "JeanpierreSolis15/commitron";

const TARGETS = {
  "darwin-arm64": { os: "darwin", arch: "arm64" },
  "darwin-x64": { os: "darwin", arch: "amd64" },
  "linux-arm64": { os: "linux", arch: "arm64" },
  "linux-x64": { os: "linux", arch: "amd64" },
  "win32-arm64": { os: "windows", arch: "arm64" },
  "win32-x64": { os: "windows", arch: "amd64" },
};

function target() {
  const key = `${process.platform}-${process.arch}`;
  const found = TARGETS[key];
  if (!found) {
    throw new Error(
      `${key} has no prebuilt binary; use "go install github.com/${REPO}@latest" instead`,
    );
  }
  return { ...found, ext: found.os === "windows" ? ".exe" : "" };
}

function binaryPath() {
  return path.join(__dirname, "..", "vendor", `commitron${target().ext}`);
}

module.exports = { REPO, target, binaryPath };
