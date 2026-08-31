#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const { spawn } = require("node:child_process");
const { binaryPath } = require("../lib/platform");

function die(message) {
  console.error(`commitron: ${message}`);
  process.exit(1);
}

let binary;
try {
  binary = binaryPath();
} catch (err) {
  die(err.message);
}

if (!fs.existsSync(binary)) {
  die(
    "the binary was not downloaded during installation; " +
      "reinstall the package (without --ignore-scripts) or run `node install.js` inside it",
  );
}

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
