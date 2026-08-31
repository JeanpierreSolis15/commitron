#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const { spawn } = require("node:child_process");
const { REPO, binaryPath } = require("../lib/platform");
const { download } = require("../lib/download");

function die(message) {
  console.error(`commitron: ${message}`);
  process.exit(1);
}

function run(binary) {
  let child;
  try {
    child = spawn(binary, process.argv.slice(2), { stdio: "inherit" });
  } catch (err) {
    die(`could not start ${binary}: ${err.message}`);
  }

  for (const signal of ["SIGINT", "SIGTERM"]) {
    process.on(signal, () => {});
  }

  child.on("error", (err) => die(`could not start ${binary}: ${err.message}`));
  child.on("exit", (code, signal) => process.exit(signal ? 1 : code ?? 1));
}

async function main() {
  const binary = binaryPath();
  if (!fs.existsSync(binary)) {
    try {
      await download();
    } catch (err) {
      console.error(`commitron: could not download the binary: ${err.message}`);
      die(`other ways to install it: https://github.com/${REPO}#install`);
    }
  }
  run(binary);
}

main().catch((err) => die(err.message));
