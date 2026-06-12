/* eslint-disable */
// scripts/clean-nul.js
// ---------------------------------------------------------------------------
// Removes TRAILING NUL-byte padding that some Windows sync/AV tools append to
// source files on save (it causes Next.js "Invalid character" build failures).
//
// Safety: only strips a contiguous run of NUL bytes at the VERY END of a file.
// If a file has NUL bytes in the middle of real content, it is NOT modified —
// we warn instead, because that would indicate genuine corruption worth a look.
// The script never fails the build (always exits 0).
//
// Wired to run automatically before `npm run build` via the "prebuild" script.
// ---------------------------------------------------------------------------
const fs = require("fs");
const path = require("path");

const ROOTS = ["src"];                       // directories to scan
const SKIP  = new Set(["node_modules", ".next", ".git", "out", "dist", "build"]);
const EXTS  = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".json", ".css", ".scss", ".md"]);

let cleaned = 0, warned = 0;

function walk(dir) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    if (SKIP.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (EXTS.has(path.extname(e.name))) clean(p);
  }
}

function clean(file) {
  const buf = fs.readFileSync(file);
  const first = buf.indexOf(0);
  if (first === -1) return;                  // no NULs — fine

  // Find where the trailing NUL run begins.
  let i = buf.length;
  while (i > 0 && buf[i - 1] === 0) i--;

  if (first === i) {
    // The only NULs are a contiguous trailing run — safe to strip.
    let end = i;
    while (end > 0 && (buf[end - 1] === 0x0a || buf[end - 1] === 0x0d)) end--;
    fs.writeFileSync(file, Buffer.concat([buf.subarray(0, end), Buffer.from("\n")]));
    cleaned++;
    console.log("  cleaned trailing NULs:", path.relative(process.cwd(), file));
  } else {
    warned++;
    console.warn("  ⚠ NULs found mid-content (NOT auto-fixed):", path.relative(process.cwd(), file));
  }
}

for (const r of ROOTS) {
  const d = path.join(process.cwd(), r);
  if (fs.existsSync(d)) walk(d);
}

if (cleaned) console.log(`[clean-nul] stripped trailing NUL padding from ${cleaned} file(s).`);
if (warned)  console.log(`[clean-nul] ${warned} file(s) have mid-content NULs — please inspect.`);
if (!cleaned && !warned) console.log("[clean-nul] no NUL corruption found.");

process.exit(0); // never block the build
