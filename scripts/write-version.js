// Writes public/version.json at build time so installed PWAs can detect a new deploy.
const fs = require("fs");
const path = require("path");

const pkg = require("../package.json");
const version = {
  version: pkg.version || "0.1.0",
  buildId: process.env.VERCEL_GIT_COMMIT_SHA
    || process.env.GITHUB_SHA
    || `local-${Date.now()}`,
  builtAt: new Date().toISOString(),
};

const out = path.join(__dirname, "..", "public", "version.json");
fs.writeFileSync(out, JSON.stringify(version, null, 2) + "\n", "utf8");
console.log("[write-version]", version.buildId);
